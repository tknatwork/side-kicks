// Installing / removing the launchd user agent.
//
// The same code backs `natural-scroll-switch install` in Terminal and the double-clickable app, so there is
// exactly one implementation of the tricky parts (the bootout→bootstrap race, the disabled-in-Login-Items
// record, and copying the binary out of the .app so deleting the app cannot break the agent).

import Foundation

struct StepLog {
    private(set) var lines: [String] = []
    mutating func note(_ s: String) { lines.append(s); log(s) }
    var text: String { lines.joined(separator: "\n") }
}

enum InstallError: LocalizedError {
    case copyFailed(String)
    case plistFailed(String)
    case bootstrapFailed(String)
    case disabledInLoginItems

    var errorDescription: String? {
        switch self {
        case .copyFailed(let s): return "Could not install the program file: \(s)"
        case .plistFailed(let s): return "Could not write the launch agent: \(s)"
        case .disabledInLoginItems:
            return "macOS has this item switched off in System Settings → General → Login Items & Extensions "
                 + "→ Allow in the Background. Turn it on there, then run the installer again."
        case .bootstrapFailed(let s): return "launchd refused to start the agent: \(s)"
        }
    }
}

enum AgentState {
    case notInstalled
    case running(pid: String)
    case loadedNotRunning(state: String)

    var isInstalled: Bool { if case .notInstalled = self { return false } else { return true } }
    var describe: String {
        switch self {
        case .notInstalled: return "not installed"
        case .running(let pid): return "loaded and running (pid \(pid))"
        case .loadedNotRunning(let s): return "loaded but NOT running (state \(s)) — check the log"
        }
    }
}

enum Installer {
    static var uid: uid_t { getuid() }
    static var serviceTarget: String { "gui/\(uid)/\(App.launchdLabel)" }
    static var domainTarget: String { "gui/\(uid)" }

    /// Where this very executable lives, with symlinks resolved.
    static var currentExecutablePath: String {
        let p = Bundle.main.executablePath ?? CommandLine.arguments[0]
        return URL(fileURLWithPath: p).resolvingSymlinksInPath().path
    }

    // MARK: State

    static func state() -> AgentState {
        let r = run("/bin/launchctl", ["print", serviceTarget])
        guard r.status == 0 else { return .notInstalled }   // non-zero = no such service in this domain
        var pid = "?", state = "?"
        for line in r.out.split(separator: "\n") {   // top-level keys only; coalition blocks nest deeper
            if line.hasPrefix("\tpid = ") { pid = String(line.dropFirst(7)) }
            if line.hasPrefix("\tstate = ") { state = String(line.dropFirst(9)) }
        }
        return state == "running" ? .running(pid: pid) : .loadedNotRunning(state: state)
    }

    static func isLoaded(_ label: String) -> Bool {
        run("/bin/launchctl", ["print", "gui/\(uid)/\(label)"]).status == 0
    }

    // MARK: Install

    @discardableResult
    static func install() throws -> StepLog {
        var steps = StepLog()
        let fm = FileManager.default

        for dir in [App.supportDir, App.logDir, App.launchAgentsDir] {
            try? fm.createDirectory(atPath: dir, withIntermediateDirectories: true)
        }

        // 1. Put the program somewhere permanent (not inside the .app, which the user may move or delete).
        let source = currentExecutablePath
        if source != App.installedBinary {
            let staging = App.installedBinary + ".new"
            try? fm.removeItem(atPath: staging)
            do {
                try fm.copyItem(atPath: source, toPath: staging)
                // copyItem and replaceItemAt both preserve extended attributes. When the app was downloaded,
                // the bundled binary carries com.apple.quarantine; the copy escapes the bundle's Gatekeeper
                // approval but keeps the flag, and launchd then cannot exec it. Strip it (ENOATTR is fine).
                _ = staging.withCString { removexattr($0, "com.apple.quarantine", XATTR_NOFOLLOW) }
                try fm.setAttributes([.posixPermissions: 0o755], ofItemAtPath: staging)
                // Atomic swap: a running agent keeps its old inode until it is restarted below.
                _ = try fm.replaceItemAt(URL(fileURLWithPath: App.installedBinary),
                                         withItemAt: URL(fileURLWithPath: staging))
            } catch {
                throw InstallError.copyFailed(error.localizedDescription)
            }
            steps.note("installed program: \(App.installedBinary)")
        } else {
            steps.note("program already in place: \(App.installedBinary)")
        }

        // 2. The launch agent definition.
        let plist: [String: Any] = [
            "Label": App.launchdLabel,
            "ProgramArguments": [App.installedBinary, "watch"],
            "RunAtLoad": true,          // start at every login and apply the right state immediately
            "KeepAlive": true,          // restart if it ever dies
            "ThrottleInterval": 10,
            "LimitLoadToSessionType": "Aqua",   // the setting is per-user and needs the GUI session
            "ProcessType": "Interactive",       // so the flip lands the moment a device appears
            "StandardOutPath": App.logPath,
            "StandardErrorPath": App.logPath,
        ]
        do {
            let data = try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0)
            try data.write(to: URL(fileURLWithPath: App.plistPath), options: .atomic)
        } catch {
            throw InstallError.plistFailed(error.localizedDescription)
        }
        steps.note("wrote launch agent: \(App.plistPath)")

        // 3. Retire any older build so two agents never fight over the setting.
        for legacy in App.legacyLabels where isLoaded(legacy) {
            run("/bin/launchctl", ["bootout", "gui/\(uid)/\(legacy)"])
            let legacyPlist = "\(App.launchAgentsDir)/\(legacy).plist"
            try? fm.removeItem(atPath: legacyPlist)
            steps.note("removed previous version: \(legacy)")
        }

        // 4. Restart cleanly. `bootout` returns before the process is actually gone, and bootstrapping the
        //    same label too early fails with "Operation already in progress", so wait for it to disappear.
        if isLoaded(App.launchdLabel) {
            run("/bin/launchctl", ["bootout", serviceTarget])
            waitUntilUnloaded()
        }
        // If the item was ever switched off in Login Items, launchd keeps a "disabled" record that outlives
        // uninstall; clear it or bootstrap fails with error 125.
        run("/bin/launchctl", ["enable", serviceTarget])

        let boot = run("/bin/launchctl", ["bootstrap", domainTarget, App.plistPath])
        if boot.status != 0 {
            // launchctl reports this on stderr, which run() now captures:
            //   "Bootstrap failed: 125: Domain does not support specified action"
            let text = boot.out.lowercased()
            if text.contains("125") || text.contains("disabled") || text.contains("does not support") {
                throw InstallError.disabledInLoginItems
            }
            throw InstallError.bootstrapFailed(boot.out.trimmingCharacters(in: .whitespacesAndNewlines)
                                                 .isEmpty ? "exit \(boot.status)" : boot.out)
        }
        steps.note("started launch agent: \(App.launchdLabel)")
        // RunAtLoad already spawns the watcher; a `kickstart -k` here would kill that fresh instance and
        // launchd would then throttle the respawn by ThrottleInterval.

        // 5. Convenience symlink so `natural-scroll-switch` works in Terminal. On a Mac without Homebrew
        //    none of the standard directories are user-writable, so fall back to creating ~/.local/bin —
        //    which is NOT on the default macOS PATH, hence the extra note.
        var linkDir = App.binDirCandidates.first(where: { isWritableDir($0) })
        var createdFallback = false
        if linkDir == nil {
            let fallback = "\(App.home)/.local/bin"
            try? fm.createDirectory(atPath: fallback, withIntermediateDirectories: true)
            if isWritableDir(fallback) { linkDir = fallback; createdFallback = true }
        }
        if let dir = linkDir {
            let link = "\(dir)/\(App.toolName)"
            try? fm.removeItem(atPath: link)
            try? fm.createSymbolicLink(atPath: link, withDestinationPath: App.installedBinary)
            if fm.fileExists(atPath: link) {
                steps.note(createdFallback
                    ? "command-line tool: \(link)  (add \(dir) to your PATH to use the short name)"
                    : "command-line tool: \(link)")
            }
        } else {
            steps.note("command-line tool: \(App.installedBinary)  (no writable bin directory was found)")
        }

        // bootstrap returning 0 only means launchd accepted the job — not that the process survived.
        // Warn rather than throw: this also acts as a settle-wait before the caller prints status, and a
        // slow machine (or a future change to `launchctl print`'s output) must not fail an install that
        // actually worked.
        if !waitUntilRunning() {
            steps.note("WARNING the agent was registered but is not reporting as running yet — "
                       + "check \(App.logPath)")
        }
        return steps
    }

    // MARK: Uninstall

    @discardableResult
    static func uninstall() -> StepLog {
        var steps = StepLog()
        let fm = FileManager.default

        for label in [App.launchdLabel] + App.legacyLabels where isLoaded(label) {
            run("/bin/launchctl", ["bootout", "gui/\(uid)/\(label)"])
            steps.note("stopped \(label)")
        }
        for label in [App.launchdLabel] + App.legacyLabels {
            let p = "\(App.launchAgentsDir)/\(label).plist"
            if fm.fileExists(atPath: p) { try? fm.removeItem(atPath: p); steps.note("removed \(p)") }
        }
        for dir in App.binDirCandidates {
            let link = "\(dir)/\(App.toolName)"
            var isDir: ObjCBool = false
            if fm.fileExists(atPath: link, isDirectory: &isDir) || isSymlink(link) {
                try? fm.removeItem(atPath: link)
                steps.note("removed \(link)")
            }
        }
        // The binary may be the one currently executing; unlinking it is fine on macOS.
        if fm.fileExists(atPath: App.supportDir) {
            try? fm.removeItem(atPath: App.supportDir)
            steps.note("removed \(App.supportDir)")
        }
        if fm.fileExists(atPath: App.logDir) {
            try? fm.removeItem(atPath: App.logDir)
            steps.note("removed \(App.logDir)")
        }
        steps.note("your settings file was left in place: \(App.configPath)")
        return steps
    }

    // MARK: Helpers

    private static func waitUntilUnloaded(timeout: TimeInterval = 10) {
        let deadline = Date().addingTimeInterval(timeout)
        while isLoaded(App.launchdLabel) && Date() < deadline { usleep(100_000) }
    }

    private static func waitUntilRunning(timeout: TimeInterval = 8) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if case .running = state() { return true }
            usleep(150_000)
        }
        return false
    }

    private static func isWritableDir(_ path: String) -> Bool {
        var isDir: ObjCBool = false
        guard FileManager.default.fileExists(atPath: path, isDirectory: &isDir), isDir.boolValue else {
            return false
        }
        return FileManager.default.isWritableFile(atPath: path)
    }

    private static func isSymlink(_ path: String) -> Bool {
        (try? FileManager.default.attributesOfItem(atPath: path)[.type] as? FileAttributeType) == .typeSymbolicLink
    }
}
