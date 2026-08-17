# Changelog: natural-scroll-switch

All notable changes to this project. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-17

First public release.

### Added
- Background launch agent that switches macOS natural scrolling by pointing device: OFF for third-party
  mice, ON for trackpads and Apple Magic devices. Reacts to attach/detach via IOKit notifications
  (`IOServiceAddMatchingNotification`), debounced; no polling.
- Instant application through `PreferencePanesSupport.setSwipeScrollDirection` — the same call the
  System Settings toggle makes — with a SkyLight SPI fallback and a preference-only last resort. All
  private symbols are resolved with `dlsym`, and `status` reports which path is active.
- Double-clickable **Natural Scroll Switch.app**: installs, reports status, and uninstalls. No Terminal
  required.
- `natural-scroll-switch` CLI: `install`, `uninstall`, `status`, `apply`, `on`, `off`, `watch`.
- Device classification with a Digitizer-usage test, Apple vendor/product rules, and user-extensible
  `ignorePatterns` / `forceMousePatterns` (merged with the built-in list, matched against manufacturer,
  product and vendor/product IDs).
- Optional configuration at `~/.config/natural-scroll-switch/config.json`.
- Universal binary (arm64 + x86_64), ad-hoc signed; `.zip` and `.dmg` artifacts with SHA-256 checksums,
  produced by `scripts/build-app.sh` and the release workflow.
- Generated app icon (`scripts/make-icon.swift`) — no binary assets in the repository.

### Fixed before release
- The installer stripped no extended attributes, so installing from a downloaded (quarantined) app copied
  `com.apple.quarantine` onto the binary registered with launchd. Now removed during install.
- `install` reported success even when the agent never started; it now verifies the running state and
  reports a clear error pointing at the log.
- The command-line symlink was silently skipped on Macs without Homebrew (no candidate directory is
  user-writable); the installer now creates `~/.local/bin` and says when it is not on your `PATH`.
- `launchctl` diagnostics go to stderr, which was discarded — bootstrap failures reported only an exit
  code and the "disabled in Login Items" hint could never appear.
- Device-supplied names reached `status` output unsanitised through one code path.

### Notes
- Requires macOS 12 or later. macOS 12–13 are best-effort: the instant-apply call was verified on
  macOS 26 and degrades gracefully if absent.
- Releases are ad-hoc signed but not notarized (no paid Apple Developer account), so a downloaded copy
  needs one "Open Anyway" in System Settings → Privacy & Security. Locally built copies do not.
