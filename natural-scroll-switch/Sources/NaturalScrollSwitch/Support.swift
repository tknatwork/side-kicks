// Shared constants, logging and configuration.

import Foundation

// MARK: - Identity

enum App {
    static let toolName = "natural-scroll-switch"
    static let displayName = "Natural Scroll Switch"
    static let launchdLabel = "io.github.tknatwork.natural-scroll-switch"
    /// Earlier private build; the installer boots it out so two agents never fight over the setting.
    static let legacyLabels = ["com.tusharkant.natural-scroll-switch"]

    static let home = FileManager.default.homeDirectoryForCurrentUser.path
    static var supportDir: String { "\(home)/Library/Application Support/NaturalScrollSwitch" }
    static var installedBinary: String { "\(supportDir)/\(toolName)" }
    static var launchAgentsDir: String { "\(home)/Library/LaunchAgents" }
    static var plistPath: String { "\(launchAgentsDir)/\(launchdLabel).plist" }
    static var logDir: String { "\(home)/Library/Logs/NaturalScrollSwitch" }
    static var logPath: String { "\(logDir)/\(toolName).log" }
    static var configDir: String { "\(home)/.config/natural-scroll-switch" }
    static var configPath: String { "\(configDir)/config.json" }
    /// Candidate directories for the optional `natural-scroll-switch` CLI symlink, best first.
    static var binDirCandidates: [String] { ["/opt/homebrew/bin", "/usr/local/bin", "\(home)/.local/bin"] }
}

// MARK: - Logging

private let isoFormatter: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime]
    f.timeZone = TimeZone.current
    return f
}()

/// One timestamped line on stdout. Under launchd stdout is redirected to the log file.
func log(_ message: String) {
    let line = "\(isoFormatter.string(from: Date())) [\(App.toolName)] \(sanitize(message))\n"
    FileHandle.standardOutput.write(Data(line.utf8))
}

/// Device-supplied strings (Product/Manufacturer) reach the log, so strip control characters that could
/// forge log lines or emit terminal escape sequences.
func sanitize(_ s: String) -> String {
    String(s.unicodeScalars.map { scalar in
        if scalar == "\t" { return Character(" ") }
        return scalar.properties.generalCategory == .control ? Character("\u{FFFD}") : Character(scalar)
    })
}

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data("\(App.toolName): \(message)\n".utf8))
    exit(1)
}

func hex(_ v: Int) -> String { String(format: "0x%04x", v) }

func onOff(_ b: Bool) -> String { b ? "ON" : "OFF" }

// MARK: - Config

/// Optional overrides at ~/.config/natural-scroll-switch/config.json. Every key is optional.
struct Config {
    /// Case-insensitive regexes tested against "<Manufacturer> <Product> vid=0x… pid=0x…"; matches are never
    /// mice. User-supplied entries are MERGED with these built-ins (use forceMousePatterns to un-ignore).
    var ignorePatterns: [String] = ["trackpad", "touchpad", "karabiner", "virtual", "keyboard(?!.*mouse)",
                                    "wacom", "huion", "xp-?pen", "gaomon", "veikk", "ugee", "artisul"]
    /// Case-insensitive regexes (same subject string); matches are ALWAYS mice (wins over every other rule).
    var forceMousePatterns: [String] = []
    /// Coalesce bursts of HID callbacks (one physical device registers several HID interfaces).
    var debounceMs: Int = 500
    /// Optional safety-net re-evaluation timer. 0 = event-driven only (default).
    var reconcileIntervalSec: Int = 0
    /// Apple pointing devices (Magic Mouse, Magic Trackpad) count as trackpads, i.e. they keep natural
    /// scrolling; only third-party mice turn it off. Set false to treat a Magic Mouse like any other mouse.
    var appleDevicesUseNatural: Bool = true
    /// Desired natural-scrolling value when at least one mouse is present.
    var naturalWithMouse: Bool = false
    /// Desired natural-scrolling value when no mouse is present (trackpad only).
    var naturalWithoutMouse: Bool = true

    var source: String = "built-in defaults"

    static func load() -> Config {
        var cfg = Config()
        guard FileManager.default.fileExists(atPath: App.configPath) else { return cfg }
        do {
            let data = try Data(contentsOf: URL(fileURLWithPath: App.configPath))
            guard let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                log("WARN config is not a JSON object, using defaults: \(App.configPath)")
                return cfg
            }
            if let v = obj["ignorePatterns"] as? [String] {
                for p in v where !cfg.ignorePatterns.contains(p) { cfg.ignorePatterns.append(p) }
            }
            if let v = obj["forceMousePatterns"] as? [String] { cfg.forceMousePatterns = v }
            if let v = obj["debounceMs"] as? Int { cfg.debounceMs = max(0, v) }
            if let v = obj["reconcileIntervalSec"] as? Int { cfg.reconcileIntervalSec = max(0, v) }
            if let v = obj["appleDevicesUseNatural"] as? Bool { cfg.appleDevicesUseNatural = v }
            if let v = obj["naturalWithMouse"] as? Bool { cfg.naturalWithMouse = v }
            if let v = obj["naturalWithoutMouse"] as? Bool { cfg.naturalWithoutMouse = v }
            cfg.source = App.configPath
            cfg.warnAboutInvalidPatterns()
        } catch {
            log("WARN could not read config (\(error.localizedDescription)), using defaults")
        }
        return cfg
    }

    /// A malformed regex silently never matches, which shows up as "my mouse is ignored" much later.
    private func warnAboutInvalidPatterns() {
        for p in ignorePatterns + forceMousePatterns where (try? NSRegularExpression(pattern: p)) == nil {
            log("WARN config pattern is not a valid regex and will never match: \(p)")
        }
    }
}

// MARK: - Process helper

/// Run a tool and capture its output. Used for launchctl; never for anything with untrusted input.
///
/// stdout and stderr share one pipe on purpose: `launchctl` reports every failure on stderr ("Bootstrap
/// failed: 125: …"), so error detection needs it, and a second unread pipe could fill and deadlock.
@discardableResult
func run(_ launchPath: String, _ args: [String]) -> (status: Int32, out: String) {
    let p = Process()
    p.executableURL = URL(fileURLWithPath: launchPath)
    p.arguments = args
    let pipe = Pipe()
    p.standardOutput = pipe
    p.standardError = pipe
    do { try p.run() } catch { return (-1, "") }
    let data = pipe.fileHandleForReading.readDataToEndOfFile()
    p.waitUntilExit()
    return (p.terminationStatus, String(data: data, encoding: .utf8) ?? "")
}
