// natural-scroll-switch — macOS natural scrolling that follows the pointing device you are using.
//
//   third-party mouse connected                   → natural scrolling OFF
//   only trackpads / Apple Magic devices present   → natural scrolling ON
//
// Design in four parts, one file each:
//   HIDDevices.swift      read-only IOKit registry walk + classification (no device is opened → no TCC prompt)
//   Watcher.swift         IOServiceAddMatchingNotification triggers, debounced (no polling)
//   ScrollPreference.swift  live apply through the same private call System Settings uses
//   AgentInstall.swift    launchd user agent install/uninstall
//
// Usage: natural-scroll-switch [watch|status|apply|on|off|install|uninstall|help]

import Foundation

// MARK: - Status output

func statusReport(_ cfg: Config) -> String {
    let ev = evaluate(cfg)
    var out: [String] = []
    let currentText = ev.current.map(onOff) ?? "unset (macOS default = ON)"
    let sync = ev.needsChange ? "← OUT OF SYNC (run `\(App.toolName) apply`)" : "✓ in sync"
    out.append("natural scrolling : \(currentText)   desired: \(onOff(ev.desired))   \(sync)")
    out.append("reason            : \(ev.summary)")
    out.append("launch agent      : \(Installer.state().describe)")
    out.append("config            : \(cfg.source)")
    out.append("apply via         : \(applyMechanism)")
    out.append("")
    out.append("HID pointing devices (Mouse usage 1,2):")
    if ev.devices.isEmpty { out.append("  (none)") }
    for (d, v) in ev.devices {
        let tag = v.isMouse ? "MOUSE  " : "ignored"
        let ids = d.vendorID == 0 && d.productID == 0 ? "" : "  vid=\(hex(d.vendorID)) pid=\(hex(d.productID))"
        let maker = d.manufacturer.isEmpty ? "-" : d.manufacturer
        out.append("  \(tag)  \(sanitize(d.displayName))  [\(sanitize(maker)), \(d.transport)\(d.builtIn ? ", built-in" : "")\(ids)]")
        out.append("           pairs=\(d.usagePairs.map(\.description).joined())  → \(v.reason)")
    }
    return out.joined(separator: "\n")
}

/// Short, non-technical summary used by the app's dialog.
func friendlyStatus(_ cfg: Config) -> String {
    let ev = evaluate(cfg)
    let devices = ev.devices.map { $0.0 }
    let trackpads = devices.filter { d in !ev.mice.contains(where: { $0.registryID == d.registryID }) }
    var lines: [String] = []
    lines.append("Natural scrolling is currently \(onOff(ev.desired)).")
    if ev.mice.isEmpty {
        lines.append(trackpads.isEmpty
            ? "No pointing device was detected."
            : "In use: \(trackpads.map { sanitize($0.displayName) }.joined(separator: ", ")).")
    } else {
        lines.append("Mouse connected: \(ev.mice.map { sanitize($0.displayName) }.joined(separator: ", ")).")
    }
    return lines.joined(separator: "\n")
}

func printHelp() {
    print("""
    \(App.displayName) — natural scrolling that follows the device you are using.

      third-party mouse connected                  → natural scrolling OFF
      only trackpads / Apple Magic devices present → natural scrolling ON

    usage: \(App.toolName) <command>
      install    install and start the background agent (runs at every login)
      uninstall  stop and remove the agent (your current setting is left as-is)
      status     show the current setting, every detected device and why it counted
      apply      evaluate once and (re)apply the setting live
      on | off   force natural scrolling on/off now (the next device event re-applies the policy)
      watch      run in the foreground and react to devices (this is what the agent runs)
      help       this text

    config (optional): \(App.configPath)
      { "ignorePatterns": ["<extra regexes, merged with the built-in list>"],
        "forceMousePatterns": [], "debounceMs": 500, "reconcileIntervalSec": 0,
        "appleDevicesUseNatural": true, "naturalWithMouse": false, "naturalWithoutMouse": true }

    log: \(App.logPath)
    """)
}

// MARK: - Entry point

let args = CommandLine.arguments.dropFirst()
let command = args.first ?? "help"

switch command {
case "watch":
    Watcher.shared.run()

case "status", "list":
    print(statusReport(Config.load()))

// Machine-readable helpers used by the double-clickable app.
case "status-brief":
    print(friendlyStatus(Config.load()))

case "agent-state":
    switch Installer.state() {
    case .notInstalled: print("not-installed")
    case .running: print("running")
    case .loadedNotRunning: print("loaded-not-running")
    }

case "apply":
    reconcile(Config.load(), reason: "manual apply", reassert: true)

case "on", "off":
    let target = (command == "on")
    let before = readNaturalScrolling()
    writeNaturalScrolling(target)
    log("natural scrolling \(before.map(onOff) ?? "unset") → \(onOff(target))  [manual \(command)]")

case "install":
    do {
        try Installer.install()
        print("")
        print(statusReport(Config.load()))
        print("")
        print("Done. \(App.displayName) is running and will start again at every login.")
    } catch {
        fail(error.localizedDescription)
    }

case "uninstall":
    Installer.uninstall()
    let current = readNaturalScrolling().map(onOff) ?? "unset (ON)"
    print("Removed. Natural scrolling is currently \(current) and was left unchanged.")

case "help", "-h", "--help":
    printHelp()

default:
    printHelp()
    fail("unknown command '\(command)'")
}
