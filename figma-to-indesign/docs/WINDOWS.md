# Windows — NOT SUPPORTED, NOT TESTED

> **Nothing in this toolkit has ever been run on Windows.** This document is a porting
> guide derived from what the macOS implementation depends on — not a compatibility
> claim. Treat every step as unverified, expect to debug each one, and do not consider
> a Windows build usable until the full verification-gate suite ([SPEC.md §5](SPEC.md))
> passes on a real Windows machine against a real document.

## Why a port is plausible

The heart of the pipeline is portable already:

- The `.jsx` files are plain **ExtendScript against InDesign's scripting DOM, which is
  identical on Windows**. Only the *transport* that invokes them differs.
- The Python pipeline uses the standard library plus pure-Python image readers
  (`png_stats.py`, `png_crop.py`, `scan_exif.py`) — no `sips`, no Pillow required.
- The IDML builder is pure Python and platform-neutral.

What is macOS-specific is the glue: AppleScript transport, shell utilities, and paths.

## Replacement map

| macOS dependency | Windows replacement | Risk |
|---|---|---|
| `osascript` → `tell application "Adobe InDesign 2026" to do script … language javascript` | COM automation: PowerShell `New-Object -ComObject InDesign.Application.2026`, then `DoScript(script, 1246973031)` (`ScriptLanguage.javascript`). Alternative: drop the `.jsx` into the user's Scripts Panel folder and invoke it. | **High** — the ProgID is version-suffixed and locale-sensitive; `DoScript` argument marshalling differs |
| Photoshop `do javascript` (script text piped via `do shell script "cat …"`) | `Photoshop.Application` COM object, `DoJavaScript(scriptText)` — pass the string directly; the `cat` trick has no equivalent | **High** |
| POSIX paths in `new File("/Users/…")` | ExtendScript `File`/`Folder` accept platform paths; route every hardcoded path through one config | **Medium** — a merely-wrong path fails silently |
| `sips` (rotate/convert/inspect) | already avoided in the pipeline readers; anything left → Pillow | Low |
| `open -R` (reveal in Finder) | `explorer.exe /select,"<path>"` | Low |
| `zip` binary + `unzip -t` verification | Python `zipfile` (also drops the Zip64 assumption) | Low |
| `du`, `stat -f%z`, `shasum` | `os.path.getsize`, `hashlib` | Low |
| Font dirs `~/Library/Fonts`, `/Library/Fonts` | `%WINDIR%\Fonts`, `%LOCALAPPDATA%\Microsoft\Windows\Fonts`; Adobe Fonts sync path differs too | Medium |
| App discovery in `/Applications/Adobe InDesign <yr>/…​.app` | Registry (`HKLM\SOFTWARE\Adobe`) or `%PROGRAMFILES%\Adobe\Adobe InDesign <yr>\` | Medium |

## Known unknowns — verify each explicitly, in this order

1. **`DoScript` input form** — file path vs script body as a string.
2. **Preflight quirks.** On macOS, passing `app.preflightProfiles.itemByName('[Basic]')`
   directly into `preflightProcesses.add()` raised *"Expected PreflightProfile, but
   received nothing"* — the profile had to be resolved by iterating the collection.
   Expect an equivalent quirk, possibly a different one.
3. **`packageForPrint` parameter order.** The macOS build needed an extra
   `useDocumentHyphenationExceptionsOnly` boolean between `pdfStyle` and
   `versionComments`; a mismatch is a type error, so at least it fails loudly.
4. **EXIF behaviour of placed images** (SPEC gate 4). On macOS, an image referenced
   from IDML is drawn with EXIF orientation IGNORED while an interactively placed one
   honours it. This is rendering-engine behaviour: **re-measure it, do not assume it.**
5. **Long paths** (>260 chars) for deep `Links/` folders — enable long-path support or
   keep the package shallow.
6. **Occlusion throttling.** On macOS, Figma (Electron) throttles its plugin when the
   window is hidden, which presents as random timeouts. Windows Electron behaves
   similarly but has not been measured here.

## Recommended porting order

Port `server/server.py`'s `check_readiness` **first**. It exercises app discovery, the
scripting bridge, the limitless port and font enumeration — everything risky — in one
cheap, iterable place. When it reports green honestly, the rest is mostly path
plumbing. Then run the pipeline end-to-end on a real document and hold it to the same
standard as macOS: **all SPEC §5 gates green, or it is not done.**
