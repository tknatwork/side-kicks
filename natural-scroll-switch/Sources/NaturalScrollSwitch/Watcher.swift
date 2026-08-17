// The long-running mode: react to HID devices arriving and leaving.
//
// IOServiceAddMatchingNotification gives instant first-match / terminated callbacks for USB and Bluetooth
// devices, so there is no polling. One physical device registers several HID interfaces, so callbacks are
// coalesced before the policy runs.

import Foundation
import IOKit

final class Watcher {
    static let shared = Watcher()

    var cfg = Config()
    private var pending: DispatchWorkItem?
    private var notifyPort: IONotificationPortRef?
    private var addedIterator: io_iterator_t = 0
    private var removedIterator: io_iterator_t = 0

    func scheduleReconcile(reason: String) {
        pending?.cancel()
        let item = DispatchWorkItem { [weak self] in
            guard let self = self else { return }
            // Re-assert rather than compare against the preference file: it can be changed out of band with
            // `defaults write`, which leaves WindowServer's live flag stale — a device event must heal that.
            reconcile(self.cfg, reason: reason, quiet: true, reassert: true)
        }
        pending = item
        DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(cfg.debounceMs), execute: item)
    }

    func run() {
        cfg = Config.load()
        log("starting watch mode (pid \(getpid()), config: \(cfg.source), debounce \(cfg.debounceMs)ms)")
        log("apply mechanism: \(applyMechanism)")
        if !hasLiveApplyMechanism {
            log("WARN this macOS exposes neither PreferencePanesSupport nor SkyLight scroll SPI; " +
                "the preference will still be written but only takes effect after the next login")
        }

        // Exit cleanly on SIGTERM (launchctl bootout / kickstart -k). Installed before any other work so an
        // early termination still produces a log line.
        signal(SIGTERM, SIG_IGN)
        let sigSource = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
        sigSource.setEventHandler { log("SIGTERM received, exiting"); exit(0) }
        sigSource.resume()

        guard let port = IONotificationPortCreate(kIOMainPortDefault) else { fail("IONotificationPortCreate failed") }
        notifyPort = port
        let source = IONotificationPortGetRunLoopSource(port).takeUnretainedValue()
        CFRunLoopAddSource(CFRunLoopGetMain(), source, .defaultMode)

        // The matching dictionary is consumed by IOServiceAddMatchingNotification, so build one per call.
        let onAdded: IOServiceMatchingCallback = { _, iterator in
            drain(iterator)
            Watcher.shared.scheduleReconcile(reason: "HID device attached")
        }
        let onRemoved: IOServiceMatchingCallback = { _, iterator in
            drain(iterator)
            Watcher.shared.scheduleReconcile(reason: "HID device detached")
        }

        var kr = IOServiceAddMatchingNotification(port, kIOFirstMatchNotification, IOServiceMatching("IOHIDDevice"),
                                                  onAdded, nil, &addedIterator)
        guard kr == KERN_SUCCESS else { fail("IOServiceAddMatchingNotification(firstMatch) failed: \(kr)") }
        drain(addedIterator)   // arm: the iterator must be exhausted once before notifications start

        kr = IOServiceAddMatchingNotification(port, kIOTerminatedNotification, IOServiceMatching("IOHIDDevice"),
                                              onRemoved, nil, &removedIterator)
        guard kr == KERN_SUCCESS else { fail("IOServiceAddMatchingNotification(terminated) failed: \(kr)") }
        drain(removedIterator)

        // Initial state (login or agent restart): always re-assert so WindowServer matches the policy.
        reconcile(cfg, reason: "startup", reassert: true)

        if cfg.reconcileIntervalSec > 0 {
            let t = Timer(timeInterval: TimeInterval(cfg.reconcileIntervalSec), repeats: true) { [weak self] _ in
                guard let self = self else { return }
                reconcile(self.cfg, reason: "periodic", quiet: true, reassert: true)
            }
            RunLoop.main.add(t, forMode: .default)
            log("periodic reconcile every \(cfg.reconcileIntervalSec)s enabled")
        }

        CFRunLoopRun()
    }
}

func drain(_ iterator: io_iterator_t) {
    var e = IOIteratorNext(iterator)
    while e != 0 { IOObjectRelease(e); e = IOIteratorNext(iterator) }
}
