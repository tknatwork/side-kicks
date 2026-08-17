# natural-scroll-switch

**Natural scrolling that follows the device in your hand.** macOS has a single "Natural scrolling"
setting shared by every pointing device, so anyone who uses both a trackpad and a mouse keeps changing
it by hand. This is a small background helper that changes it for you, the instant you plug something
in or unplug it.

![Platform](https://img.shields.io/badge/platform-macOS%2012%2B-black)
![Binary](https://img.shields.io/badge/binary-universal%20(arm64%20%2B%20x86__64)-informational)
![Network](https://img.shields.io/badge/network-none-2ea44f)
![Permissions](https://img.shields.io/badge/permissions-none%20required-2ea44f)
![License](https://img.shields.io/badge/license-MIT-yellow)

| What is connected | Natural scrolling |
|---|---|
| A third-party mouse (USB, Bluetooth, wireless receiver) | **OFF** — the wheel scrolls the classic way |
| Only trackpads or Apple devices — built-in trackpad, Magic Trackpad, Magic Mouse | **ON** — content follows your fingers |

It reacts in well under a second, starts itself at login, uses no network, needs no Accessibility or
Input Monitoring permission, and can be removed at any time.

📖 **AI builders:** read [AGENTS.md](AGENTS.md) before changing anything here.
🔬 **Why it is built this way:** [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md) — the real mechanism, and
the several plausible approaches that do not work.

---

## Install

Download **`NaturalScrollSwitch-<version>.dmg`** from
[Releases](https://github.com/tknatwork/side-kicks/releases), open it, drag **Natural Scroll Switch**
into Applications, and double-click it. It explains what it will do, installs itself when you agree,
and confirms it is running. No Terminal, no Xcode.

Open the app again any time to see what it is doing, or to remove it.

<details>
<summary><b>The one Gatekeeper prompt, and why it appears</b></summary>

Releases are **ad-hoc signed but not notarized**, because notarizing requires a paid Apple Developer
account. So macOS asks about it once, the first time you open it:

> *"Natural Scroll Switch" cannot be opened because Apple cannot check it for malicious software.*

Open **System Settings → Privacy & Security**, scroll down to Security, and click **Open Anyway** next
to the message about Natural Scroll Switch, then open the app again. macOS only asks once.

To avoid the prompt entirely, build it yourself — locally produced files are never quarantined:

```bash
git clone https://github.com/tknatwork/side-kicks.git
cd side-kicks/natural-scroll-switch && ./scripts/build-app.sh && open dist/*.app
```
</details>

## Everyday use

The app is enough for most people. There is also a command-line tool. The installer symlinks it into the
first writable directory of `/opt/homebrew/bin`, `/usr/local/bin` or `~/.local/bin` (creating the last one
if needed) and tells you which — if that directory is not on your `PATH`, either add it or call the tool by
its full path, `~/Library/Application\ Support/NaturalScrollSwitch/natural-scroll-switch`.

```bash
natural-scroll-switch status      # current setting, every detected device, and why it counted
natural-scroll-switch apply       # re-evaluate and re-apply right now
natural-scroll-switch on | off    # force it; the next device event re-applies the policy
natural-scroll-switch uninstall   # stop and remove the agent
tail -f ~/Library/Logs/NaturalScrollSwitch/natural-scroll-switch.log
```

`status` is what to read when something looks wrong — it prints every HID pointing device macOS
reports, and the exact rule that classified it:

```
natural scrolling : OFF   desired: OFF   ✓ in sync
reason            : mouse present (Gaming Mouse G502) → natural scrolling should be OFF
launch agent      : loaded and running (pid 60791)
config            : built-in defaults
apply via         : PreferencePanesSupport.setSwipeScrollDirection (same as System Settings)

HID pointing devices (Mouse usage 1,2):
  ignored  Apple Internal Keyboard / Trackpad  [Apple, FIFO, built-in]
           pairs=(1,2)(1,1)(13,5)(65280,12)  → built-in
  MOUSE    Gaming Mouse G502  [Logitech, USB  vid=0x046d pid=0xc332]
           pairs=(1,2)(1,1)  → external HID mouse
```

## How it decides

A device counts as a **mouse** when macOS reports it with the HID *Mouse* usage (page 1, usage 2) and
it is none of the following: built-in; an Apple Magic Trackpad (matched by vendor/product ID); an Apple
pointing device at all, Magic Mouse included (see `appleDevicesUseNatural`); a touch surface, meaning
it carries a *Digitizer* usage page as trackpads, tablets and touchscreens do; or a match for an
ignore pattern. Everything else keeps natural scrolling on.

## Configuration (optional)

Create `~/.config/natural-scroll-switch/config.json` — every key is optional:

```json
{
  "appleDevicesUseNatural": true,
  "ignorePatterns": [],
  "forceMousePatterns": [],
  "debounceMs": 500,
  "reconcileIntervalSec": 0,
  "naturalWithMouse": false,
  "naturalWithoutMouse": true
}
```

| Key | Meaning |
|---|---|
| `appleDevicesUseNatural` | Magic Mouse / Magic Trackpad keep natural scrolling. Set `false` to treat a Magic Mouse like any other mouse. |
| `ignorePatterns` | Extra case-insensitive regexes, **merged with** the built-ins (`trackpad`, `touchpad`, `karabiner`, `virtual`, `keyboard(?!.*mouse)`, tablet vendors). Matched against `"<Manufacturer> <Product> vid=0x… pid=0x…"`, so `"vid=0x3434"` works too. |
| `forceMousePatterns` | Regexes that always count as a mouse — wins over every other rule. |
| `debounceMs` | How long to coalesce a burst of device events (one physical device registers several HID interfaces). |
| `reconcileIntervalSec` | Optional periodic safety net. `0` (default) is event-driven only; with a timer, a manual change in System Settings is reverted at the next tick. |
| `naturalWithMouse` / `naturalWithoutMouse` | Invert the policy entirely. |

Restart after editing:

```bash
launchctl kickstart -k gui/$(id -u)/io.github.tknatwork.natural-scroll-switch
```

## Known limits

- A wireless **receiver** (Logitech Unifying/Bolt) and **keyboard+mouse combo receivers** advertise a
  mouse for as long as the dongle is plugged in, even with the mouse switched off. Unplug it, or add
  it to `ignorePatterns`.
- Bluetooth mice that disconnect when idle briefly flip the setting back to ON while they sleep. That
  is the intended meaning of "no mouse present", but the first scroll after waking can land just
  before the switch.
- Some keyboards expose a mouse interface for mouse-keys. Those with "keyboard" in the name are
  already ignored; anything else needs an `ignorePatterns` entry.
- `status` reports "in sync" from the preference file. WindowServer's live value cannot be read back,
  which is why every startup, `apply` and device event re-asserts the setting instead of trusting it.
- macOS 12–13 are best-effort: the private call that applies the change instantly was verified on
  macOS 26, and the tool falls back gracefully — and says so in `status` — if it is ever missing.

## Uninstall

Open the app and choose **Uninstall**, or run `natural-scroll-switch uninstall`. Your current
scrolling setting is left exactly as it is.

## Build from source

Requires Xcode **or** just the Command Line Tools (`xcode-select --install`) — the packaging script uses
`swiftc` + `lipo` rather than SwiftPM's multi-arch mode, which needs full Xcode.

```bash
./scripts/build-app.sh                       # universal .app, .zip and .dmg into dist/
open dist/*.app                              # install it

swift build -c release                       # or just the binaries, for development
./.build/release/natural-scroll-switch status
```

## License

MIT — see [LICENSE.md](LICENSE.md).

*Independent project, not affiliated with or endorsed by Apple. It calls two private system functions
to apply the setting instantly; [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md) documents exactly which,
why no public equivalent exists, and how it degrades if they ever disappear.*
