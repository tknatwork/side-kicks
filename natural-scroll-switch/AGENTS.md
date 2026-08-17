<!-- === SYSTEM PAIRING ===
Consumed by: All AI builders (Claude Code, Cursor, Copilot, Aider, Continue, Gemini CLI, Codex)
Updated by: manual, on architectural or convention changes
Pairs with: CLAUDE.md (pointer), docs/HOW-IT-WORKS.md (mechanism rationale)
Update trigger: change to the apply mechanism, the classification rules, or the packaging/signing flow
Last verified: 2026-08-17 (v1.0.0 — initial packaging)
Index: README.md
=== END PAIRING === -->

# AGENTS.md — natural-scroll-switch

> Canonical AI-builder rules for the macOS utility in this folder.
> All builder LLMs read this file. [AGENTS.md is the Sourcegraph universal convention](https://agents.md).

**Project:** natural-scroll-switch — switches macOS natural scrolling by pointing device
**Repository:** [`tknatwork/side-kicks`](https://github.com/tknatwork/side-kicks) (this folder)
**Language:** Swift 5 (SwiftPM, two executable products), macOS 12+
**Version:** 1.0.0 · **License:** MIT ([LICENSE.md](LICENSE.md))

---

## Read this first

[docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md) explains the mechanism **and the approaches that look
right but fail**. Read it before touching anything under `Sources/NaturalScrollSwitch/`. The short
version of the trap: writing the preference does not change scrolling, and the distributed
notification does not either.

## Layout

| Path | What it is |
|---|---|
| `Sources/NaturalScrollSwitch/` | The CLI and launchd daemon. Foundation + IOKit only — **never import AppKit here**, the agent must stay lean. |
| `Sources/NaturalScrollSwitchApp/` | The double-clickable installer/status app (AppKit). It shells out to the CLI; it must contain **no policy logic**. |
| `scripts/build-app.sh` | Universal build → `.app` → sign → `.zip` + `.dmg` + checksums. Uses `swiftc` + `lipo`, **not** `swift build --arch`: the SwiftPM multi-arch path requires XCBuild (full Xcode) and fails on Command-Line-Tools-only Macs. Verified. |
| `scripts/make-icon.swift` | Generates `AppIcon.icns` at build time. The repo stores no binary assets. |
| `ci/` | Source of truth for the workflows GitHub runs from the **repository root** `.github/workflows/`. Edit here, then copy up — CI diffs the two and fails on drift. See `ci/README.md`. |
| `VERSION` | Single source of truth for the version. `build-app.sh` and `Info.plist` read it. |
| `dist/` | Build output. Never commit. |

## Invariants

1. **One implementation of the real work.** The app must never reimplement install, uninstall or
   classification — it runs `natural-scroll-switch <command>` and shows the result.
2. **No device is ever opened.** Classification reads IOKit registry properties only. Calling
   `IOHIDDeviceOpen`/`IOHIDManagerOpen` would trigger an Input Monitoring prompt and break the
   "no permissions" promise in the README.
3. **A failed device scan is not an empty device list.** `DeviceScan.failed` exists so a lookup error
   never reads as "no mouse attached". Keep that distinction in any new code path.
4. **Always re-assert, never trust the preference file.** WindowServer's live flag has no getter.
5. **Private symbols are `dlsym`-resolved, always with a fallback chain**, and `status` must keep
   reporting which path is active via `applyMechanism`.
6. **No network, ever.** No telemetry, no update check. The badge in the README says so.
7. **Device strings are untrusted input.** Product/Manufacturer strings reach the log and the terminal;
   they go through `sanitize()`.
8. **`lipo` discards signatures.** Any change to the build must keep a `codesign` step *after* the
   `lipo`, or the x86_64 slice ships unsigned and the app will not launch on Apple Silicon.
9. **Strip `com.apple.quarantine` from the installed binary.** `copyItem`/`replaceItemAt` preserve extended
   attributes (verified), so a downloaded app would register a quarantined binary with launchd that cannot
   be exec'd. `install()` calls `removexattr` on the staged copy — never remove that.
10. **Installation is only successful if the agent is actually running.** `bootstrap` returning 0 means
    launchd accepted the job, not that the process survived; `install()` polls and throws
    `registeredButNotRunning` otherwise. Do not downgrade that to a warning.

## launchd rules the installer must keep

- Poll `launchctl print` until the label is gone after `bootout` — bootstrapping too early fails with
  "Operation already in progress" (observed, not theoretical).
- Never `kickstart -k` straight after `bootstrap`: `RunAtLoad` has already started the job, and killing
  it triggers a `ThrottleInterval` respawn gap.
- Always `launchctl enable` before `bootstrap` — a Login Items opt-out survives uninstall.
- LaunchAgent, `LimitLoadToSessionType = Aqua`. Never a LaunchDaemon: the WindowServer connection is
  per-GUI-session.

## Testing

There is no unit-test target; the meaningful tests are behavioural and must be run on a real Mac:

```bash
swift build -c release && ./.build/release/natural-scroll-switch status   # classification + mechanism
./scripts/build-app.sh && open dist/*.app                                 # one-click flow
```

Physically unplug and replug a mouse and watch
`~/Library/Logs/NaturalScrollSwitch/natural-scroll-switch.log` for the flip in both directions. When
changing classification, extend the synthetic device cases in `docs/HOW-IT-WORKS.md` §3 reasoning with
a scratch harness that constructs `HIDDevice` values and asserts `classify()` — do not ship a harness
that requires the physical device.

## Release

1. Bump `VERSION` and add a `CHANGELOG.md` entry.
2. `./scripts/build-app.sh` locally and sanity-check `dist/`.
3. Tag `natural-scroll-switch-v<version>` and push — the workflow in `.github/workflows/` (copied from
   `ci/`) builds and publishes.
4. Update the project's row in the repository-root `README.md` table.

Signing: ad-hoc by default. If a Developer ID is ever added to the keychain, `build-app.sh` uses it
automatically (hardened runtime + timestamp) and the release becomes notarizable — then, and only
then, drop the Gatekeeper caveat from the README.
