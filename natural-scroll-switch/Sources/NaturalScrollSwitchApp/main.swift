// The double-clickable front end.
//
// Deliberately tiny: it locates the `natural-scroll-switch` binary shipped inside the app bundle and drives
// it with the same commands a Terminal user would type, so there is one implementation of the real work.
// No window, no menu bar item — one dialog, then it quits.

import AppKit

let toolName = "natural-scroll-switch"
let displayName = "Natural Scroll Switch"

// MARK: - Locating the worker binary

/// Prefer the copy inside this app bundle; fall back to an already-installed one.
func locateTool() -> String? {
    let fm = FileManager.default
    var candidates: [String] = []
    if let res = Bundle.main.resourceURL?.appendingPathComponent(toolName).path { candidates.append(res) }
    if let exeDir = Bundle.main.executableURL?.deletingLastPathComponent()
        .appendingPathComponent(toolName).path { candidates.append(exeDir) }
    candidates.append(fm.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Application Support/NaturalScrollSwitch/\(toolName)").path)
    return candidates.first { fm.isExecutableFile(atPath: $0) }
}

@discardableResult
func runTool(_ tool: String, _ args: [String]) -> (status: Int32, out: String, err: String) {
    let p = Process()
    p.executableURL = URL(fileURLWithPath: tool)
    p.arguments = args
    let outPipe = Pipe(), errPipe = Pipe()
    p.standardOutput = outPipe
    p.standardError = errPipe
    do { try p.run() } catch { return (-1, "", error.localizedDescription) }
    let out = String(data: outPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
    let err = String(data: errPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
    p.waitUntilExit()
    return (p.terminationStatus, out.trimmingCharacters(in: .whitespacesAndNewlines),
            err.trimmingCharacters(in: .whitespacesAndNewlines))
}

// MARK: - Dialogs

/// - escapeIndex: button that Escape should trigger. Only ever point this at a harmless button; the first
///   button already answers to Return, so setting Escape on index 0 would take Return away from it.
/// - destructiveIndex: drawn in red, so the dangerous choice is distinguishable even before the window
///   becomes key (this alert stacks its buttons vertically, which removes the usual positional cue).
@discardableResult
func alert(_ title: String, _ body: String, buttons: [String],
           style: NSAlert.Style = .informational,
           escapeIndex: Int? = nil, destructiveIndex: Int? = nil) -> Int {
    let a = NSAlert()
    a.alertStyle = style
    a.messageText = title
    a.informativeText = body
    for b in buttons { a.addButton(withTitle: b) }
    if let icon = NSApp.applicationIconImage { a.icon = icon }
    if let e = escapeIndex, a.buttons.indices.contains(e) { a.buttons[e].keyEquivalent = "\u{1b}" }
    if let d = destructiveIndex, a.buttons.indices.contains(d) { a.buttons[d].hasDestructiveAction = true }
    // Order the window in FIRST: macOS drops an activation request from a process that has no window on
    // screen, and this is an accessory app — no Dock icon and no Cmd-Tab entry to recover focus with. Without
    // this the alert appears but never becomes key, so Return/Escape do nothing and a keyboard-only or
    // VoiceOver user cannot operate or dismiss it.
    a.window.orderFrontRegardless()
    NSApp.activate(ignoringOtherApps: true)
    return a.runModal().rawValue - NSApplication.ModalResponse.alertFirstButtonReturn.rawValue
}

let explainer = """
This installs a small background helper that switches macOS "natural scrolling" to match whatever you are \
using:

• a third-party mouse is connected → natural scrolling turns OFF
• only a trackpad, Magic Trackpad or Magic Mouse → natural scrolling turns ON

It starts automatically when you log in, uses no network, and can be removed at any time by opening this \
app again and choosing Uninstall.
"""

// MARK: - Main

let app = NSApplication.shared
app.setActivationPolicy(.accessory)   // no Dock icon; the dialog is brought to the front explicitly

guard let tool = locateTool() else {
    alert("\(displayName) is incomplete",
          "The helper program could not be found inside this app. Please download \(displayName) again.",
          buttons: ["Quit"], style: .critical)
    exit(1)
}

let state = runTool(tool, ["agent-state"]).out

func doInstall() {
    let r = runTool(tool, ["install"])
    if r.status == 0 {
        let brief = runTool(tool, ["status-brief"]).out
        alert("\(displayName) is on",
              "\(brief)\n\nIt will keep running in the background and start again each time you log in.",
              buttons: ["Done"])
    } else {
        var detail = r.err.isEmpty ? r.out : r.err
        if detail.isEmpty {
            // The helper died without saying anything (e.g. killed by a signal) — never show an empty dialog.
            detail = "The helper stopped unexpectedly (status \(r.status)). If macOS blocked it, open "
                   + "System Settings → Privacy & Security and allow it, then try again."
        }
        alert("\(displayName) could not be installed", detail, buttons: ["OK"], style: .critical)
    }
}

func doUninstall() {
    let r = runTool(tool, ["uninstall"])
    alert(r.status == 0 ? "\(displayName) removed" : "Removal finished with warnings",
          (r.out.isEmpty ? r.err : r.out) + "\n\nYou can delete the app itself now if you like.",
          buttons: ["Done"], style: r.status == 0 ? .informational : .warning)
}

switch state {
case "running", "loaded-not-running":
    let brief = runTool(tool, ["status-brief"]).out
    let extra = state == "running" ? "" : "\n\nThe helper is installed but not running right now; " +
                                          "choosing Reinstall usually fixes that."
    // No escapeIndex here: Return already answers "Done" (index 0), which is the safe way out. Escape must
    // never be wired to "Uninstall", which sits in the bottom/dismiss slot of the vertical stack.
    switch alert("\(displayName) is installed", brief + extra,
                 buttons: ["Done", "Reinstall", "Uninstall"], destructiveIndex: 2) {
    case 1: doInstall()
    case 2:
        if alert("Remove \(displayName)?",
                 "The background helper will be stopped and removed. Your current scrolling setting and "
               + "your settings file are left exactly as they are.",
                 buttons: ["Remove", "Cancel"], style: .warning,
                 escapeIndex: 1, destructiveIndex: 0) == 0 {
            doUninstall()
        }
    default: break
    }
default:
    if alert("Install \(displayName)?", explainer, buttons: ["Install", "Not now"], escapeIndex: 1) == 0 {
        doInstall()
    }
}
exit(0)
