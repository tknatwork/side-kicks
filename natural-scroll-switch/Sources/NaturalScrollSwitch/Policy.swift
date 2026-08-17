// Turning "what is plugged in" into "what natural scrolling should be", and applying it.

import Foundation

struct Evaluation {
    let devices: [(HIDDevice, Verdict)]
    let mice: [HIDDevice]
    let desired: Bool
    let current: Bool?
    let scanFailed: Bool

    /// macOS treats an absent preference as natural.
    var effectiveCurrent: Bool { current ?? true }
    var needsChange: Bool { effectiveCurrent != desired }
    var summary: String {
        if scanFailed { return "device scan failed — leaving the setting alone" }
        return mice.isEmpty
            ? "no third-party mouse → natural scrolling should be \(onOff(desired))"
            : "mouse present (\(mice.map { sanitize($0.displayName) }.joined(separator: ", "))) → natural scrolling should be \(onOff(desired))"
    }
}

func evaluate(_ cfg: Config) -> Evaluation {
    let scan = scanPointingDevices()
    let classified = scan.devices.map { ($0, classify($0, cfg)) }
    let mice = classified.filter { $0.1.isMouse }.map { $0.0 }
    let desired = mice.isEmpty ? cfg.naturalWithoutMouse : cfg.naturalWithMouse
    return Evaluation(devices: classified, mice: mice, desired: desired,
                      current: readNaturalScrolling(), scanFailed: scan.failed)
}

/// Evaluate and apply.
/// - `reassert`: push the desired state even when the preference already matches. WindowServer's live flag
///   has no getter and is only loaded from the preference file at login, so it can drift out of sync (for
///   example after a bare `defaults write`). Startup, `apply` and every device event therefore re-assert.
@discardableResult
func reconcile(_ cfg: Config, reason: String, quiet: Bool = false, reassert: Bool = false) -> Bool {
    let ev = evaluate(cfg)
    // A failed registry read must never be mistaken for "no mouse attached".
    guard !ev.scanFailed else {
        log("skipped — \(ev.summary)  [\(reason)]")
        return false
    }
    if ev.needsChange {
        writeNaturalScrolling(ev.desired)
        log("natural scrolling \(onOff(ev.effectiveCurrent)) → \(onOff(ev.desired))  [\(reason)]  \(ev.summary)")
        return true
    }
    if reassert {
        writeNaturalScrolling(ev.desired)   // idempotent: one mach message plus a same-value preference write
        if !quiet { log("reasserted natural scrolling \(onOff(ev.desired)) live  [\(reason)]  \(ev.summary)") }
        return true
    }
    if !quiet { log("no change (natural scrolling \(onOff(ev.effectiveCurrent)))  [\(reason)]  \(ev.summary)") }
    return false
}
