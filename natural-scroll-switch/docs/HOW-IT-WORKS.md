# How it works

Four questions decide the whole design: *what is plugged in*, *when did that change*, *what should the
setting be*, and *how do you actually change it*. The last one is where every obvious answer is wrong.

---

## 1. What is plugged in

The tool walks the IOKit registry for `IOHIDDevice` entries that advertise the HID **Mouse** usage
(usage page 1, usage 2) — the same data behind `ioreg -c IOHIDDevice` and `hidutil list`.

It reads properties only. It never calls `IOHIDDeviceOpen`, and that is deliberate: `IOHIDDevice.cpp`
tags keyboards, mice and touchpads with `kIOHIDRequiresTCCAuthorizationKey`, and `IOHIDDeviceOpen`
consequently triggers an **Input Monitoring** permission prompt. A registry read does not. That is why
this tool needs no permissions at all.

If the registry read ever fails, the result is marked as failed rather than empty — a failed lookup
must never be mistaken for "no mouse attached", which would silently turn natural scrolling on.

## 2. When did that change

`IOServiceAddMatchingNotification` with `kIOFirstMatchNotification` and `kIOTerminatedNotification` on
`IOHIDDevice` delivers attach and detach callbacks for USB and Bluetooth devices. No polling.

Two details matter:

- Each iterator **must be drained once** after registration or no notifications are ever delivered.
- One physical device registers **several HID interfaces**, so a single plug-in fires several
  callbacks. They are coalesced (`debounceMs`, default 500 ms) before the policy runs.

`launchd`'s own `LaunchEvents`/`com.apple.iokit.matching` was rejected: it fires on device *arrival*
only, so unplugging would never be noticed.

## 3. What should the setting be

See [the classification rules in the README](../README.md#how-it-decides). Two notes on why the rules
are shaped the way they are:

- **The Digitizer test does the real work.** Every trackpad — built-in, and the Magic Trackpad over
  USB — publishes a Digitizer (page 13) collection alongside its Mouse collection. Mice do not.
- **Apple trackpads are also matched by product ID**, because the first-generation Magic Trackpad has
  no Digitizer collection at all and the Bluetooth report map of later ones could not be verified.
  Name and ID matching are the belt to the Digitizer test's braces.

## 4. How you actually change it

This is the part that looks simple and is not. What genuinely happens on macOS:

```
~/Library/Preferences/.GlobalPreferences.plist        ← read ONLY at login
        │  com.apple.swipescrolldirection (CFBoolean)
        ▼   loginwindow → activateSettings
WindowServer: one global flag  ← the live value; there is no getter
        ▲
        └── SLSSetSwipeScrollDirection(connection, 0|1)     (SkyLight, private)
```

So:

| Approach | Result |
|---|---|
| `defaults write -g com.apple.swipescrolldirection …` | Persists, but **nothing changes until you log out and back in**. |
| Posting `SwipeScrollDirectionDidChangeNotification` | Does **not** flip scrolling. It only tells System Settings, Control Center and Accessibility Zoom to re-read the preference. |
| `SLSSetSwipeScrollDirection` (SkyLight SPI) | Flips it instantly, but does not persist across login. |
| `PreferencePanesSupport.setSwipeScrollDirection(BOOL)` | Does all three: WindowServer flag, preference write, notification. **This is what the System Settings toggle itself calls**, and what this tool calls. |

Both symbols are resolved with `dlsym`, so a future macOS that removes them degrades instead of
crashing: SkyLight + `CFPreferences` + notification first, then preference-only (effective at next
login) as a last resort. `status` always prints which path is live under **apply via**.

Two consequences worth knowing:

- **The live flag cannot be read back.** `status` compares against the preference file, so an
  out-of-band `defaults write` can leave the file and the live value disagreeing. That is why startup,
  `apply` and every device event **re-assert** the desired state rather than trusting the file.
- **A GUI session is required**, since the WindowServer connection is per-session. Hence
  `LimitLoadToSessionType = Aqua` in the launch agent, and why this is a LaunchAgent, never a
  LaunchDaemon.

There is no per-device natural-scrolling preference to use instead: the live state is a single global
byte in WindowServer, so one shared toggle is an architectural fact of macOS, not an oversight.

## 5. Running as a launch agent

`RunAtLoad` + `KeepAlive`, `ProcessType = Interactive`, output to
`~/Library/Logs/NaturalScrollSwitch/`. Two launchd behaviours the installer has to work around, both
observed in the wild rather than theorised:

- **`bootout` returns before the service is gone.** Bootstrapping the same label immediately after
  fails with *"Operation already in progress"*. The installer polls `launchctl print` until the label
  disappears.
- **`bootstrap` already starts the job** (`RunAtLoad`). A `kickstart -k` right afterwards kills that
  fresh instance, and launchd then defers the respawn by `ThrottleInterval` — a ten-second window with
  no agent running. The installer does not kickstart.

Switching the item off under **System Settings → General → Login Items & Extensions** writes a
`disabled` record that survives uninstall, so the installer always runs `launchctl enable` first and
reports that specific cause if `bootstrap` still refuses.

## 6. Distribution

The binary is universal (arm64 + x86_64) and **ad-hoc signed**. An arm64 Mach-O must carry at least an
ad-hoc signature to run at all, and `lipo` does **not** carry the per-slice signatures across — so
signing happens after the fat file is produced and again after the bundle is assembled, with both
slices verified.

The build deliberately uses `swiftc` + `lipo` instead of `swift build --arch arm64 --arch x86_64`. The
SwiftPM multi-arch path needs XCBuild, so on a Mac with only the Command Line Tools it fails with
*"xcbuild executable ... does not exist"*. `Package.swift` remains the canonical layout for `swift
build` and IDEs.

Without a paid Apple Developer ID the app cannot be notarized, so a downloaded copy is quarantined and
needs one **Open Anyway** in System Settings → Privacy & Security. Anything built or cloned locally
carries no quarantine flag and opens with no prompt. If a Developer ID ever becomes available,
`scripts/build-app.sh` picks it up automatically and signs with a hardened runtime and timestamp,
ready for `notarytool`.
