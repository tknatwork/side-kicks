# figma-to-indesign — MCP toolset specification

A companion to the `figma-limitless` plugin: takes a Figma page and produces a real,
editable InDesign document plus a self-contained hand-off folder, **without going
through PDF**, in CMYK and sRGB variants.

Written from a completed 408-page conversion (Akanksha Singh, Graduation Project).
Every requirement, gate and gotcha below is something that project actually hit — none
of it is speculative. See `README.md` in this folder for the conversion itself.

---

## 1. Scope

**In scope.** Editorial / print layouts: pages of text and placed images. Live editable
text, original image bitmaps, editable crops, paragraph styles, facing-page booklets,
CMYK and sRGB link sets, print-ready PDF/X, and a packaged folder.

**Explicitly not in scope** (declare these, do not approximate them silently):

| Figma feature | Status |
|---|---|
| Vector paths | **Solvable via SVG — see 2a.** The reference build approximated them as rectangles, which happened to be harmless there but is not a general answer. |
| Gradients | Detected, not rendered |
| Effects (shadow, blur) | Not rendered |
| Blend modes, masks, boolean ops | Not rendered |
| Components / instances | Flattened to their rendered content |
| Auto-layout semantics | Not preserved (positions are baked) |
| Multi-column text, tables, text-on-path | Not supported |

A conversion that hits any of these must say so in its report rather than produce a
document that looks complete.

### 2a. Vectors: place as SVG, not as approximated shapes

**Tested, works.** InDesign places SVG as a first-class vector object — no rasterisation,
no resolution dependency:

```
small 200x120pt      : object=SVG  effectivePpi=n/a  link=test.svg [SVG]
large 800x480pt (4x) : object=SVG  effectivePpi=n/a  link=test.svg [SVG]
```

`effectivePpi` is not applicable, which is the tell: raster art reports a finite ppi that
collapses as it is scaled. Enlarged 4× beyond its natural size, curves and diagonals stayed
perfectly crisp. Reproduce with `scripts/test-svg-place.jsx` and `vectortest/`.

IDML represents it as its own element, structurally parallel to `<Image>`:

```xml
<SVG Self="…" UseSVGAs="EmbedCode" ImageTypeName="$ID/SVG" ItemTransform="…">
  <Properties><GraphicBounds Left="0" Top="0" Right="200" Bottom="120"/></Properties>
  <Link LinkResourceURI="file:…/test.svg" LinkResourceFormat="$ID/SVG" …/>
</SVG>
```

`GraphicBounds` is the SVG's natural size from its viewBox, and `ItemTransform` carries the
same scale-and-offset used for images — so **the existing crop maths applies unchanged**.

Two implementation notes:

1. InDesign sets `UseSVGAs="EmbedCode"` and embeds the SVG markup into the IDML *as well as*
   keeping the link. Rather than hand-authoring that, **emit an empty named frame and place
   the SVG in a scripted pass after opening the document** (`frame.place(svgFile)`). Simpler,
   and guaranteed to match whatever InDesign expects of its own format.
2. `figma-limitless`'s `save_screenshots` already exports `format: "SVG"` per node, so the
   extract side needs no new capability — only the decision of *which* nodes to route to SVG.

**Routing rule.** Send a node to SVG when it is a `VECTOR`, `BOOLEAN_OPERATION`, `STAR`,
`POLYGON` or `LINE`, or any node carrying effects or a gradient. Keep the cheap native paths
for the trivial cases — in the reference file 32 of 51 vectors were literally rectangles with
a solid fill and 7 were straight lines, and a native `Rectangle`/`GraphicLine` is smaller,
editable in InDesign, and exactly correct. **Only fall back to SVG when the geometry is not
representable natively**, and record which nodes took which path in the run report.

SVG carries one caveat worth checking per project: text inside an SVG depends on the fonts
resolving at placement. Prefer converting text to outlines in the exported SVG, or exclude
text-bearing nodes from the SVG route.

**Implemented** in `scripts/build8.py` (`SVG_TYPES` routing, `vector_item`, and
`scripts/svg-place-jobs.tsv`) + `scripts/place-svgs.jsx` (the post-open placement pass).
The extract carries no path data, so nothing can prove a `VECTOR` is "really just a
rectangle" — every true-vector type routes to SVG, only provably degenerate stroked boxes
(rules) stay native, and a node with no SVG export yet falls back to the old flat
approximation and is listed as a pending job rather than silently approximated.

---

## 2. Platform support

### macOS — supported and tested

Everything below was exercised end to end on macOS 15 (Darwin 25.5), InDesign 2026,
Photoshop 2026. The app bridge is AppleScript driving ExtendScript:

```
osascript -e 'tell application "Adobe InDesign 2026"
  do script (POSIX file "/path/to/script.jsx") language javascript
end tell'
```

Note this is the **classic scripting bridge, not UXP**. That is deliberate: the classic
DOM exposed everything the pipeline needed — opening IDML, facing-page conversion,
overset handling, per-link relinking, preflight processes, `packageForPrint`, PDF/X
export. InDesign's UXP scripting surface is newer and was not verified to cover those
operations. Do not assume it does; test before switching.

Also worth separating: the **Adobe UXP Developer Tool** is a developer utility for
side-loading unsigned plugins. It is not a runtime dependency and should not be
required of end users.

### Windows — NOT SUPPORTED, NOT TESTED

> **None of this has been run on Windows.** The notes below are a porting guide derived
> from what the macOS implementation depends on. Treat every step as unverified: expect
> to debug it, and do not ship a Windows build until the full verification suite
> (section 5) passes on a real Windows machine.

**The good news:** the `.jsx` scripts themselves are plain ExtendScript against
InDesign's scripting DOM, which is identical on Windows. Only the *transport* and the
*shell utilities* need replacing.

**What must change:**

| macOS dependency | Windows replacement | Risk |
|---|---|---|
| `osascript` / AppleScript | COM automation: PowerShell `New-Object -ComObject InDesign.Application.2026`, then `DoScript(file, 1246973031)` where the long is `ScriptLanguage.javascript`. Or drop the `.jsx` into the user's Scripts Panel folder and invoke it. | **High** — the COM ProgID is version-suffixed and locale-sensitive; `DoScript` argument marshalling differs |
| Photoshop `do javascript` + `do shell script "cat …"` | `Photoshop.Application` COM object, `DoJavaScript(scriptText)` | **High** — the mac trick of piping script text via `cat` has no equivalent; pass the string directly |
| POSIX paths in `new File("/Users/…")` | ExtendScript `File`/`Folder` accept platform paths; every hardcoded path must go through a path abstraction | **Medium** — silent failures if a path is merely wrong rather than invalid |
| `sips` (image dimensions, rotation, format conversion) | Not present. Use the pure-Python readers already in `scripts/png_stats.py` / `png_crop.py`, or Pillow | **Low** — the Python readers are already portable |
| `open -R` (reveal in Finder) | `explorer.exe /select,"<path>"` | Low |
| `zip` binary | Python `zipfile` (also removes the mac `zip` Zip64 assumption) | Low |
| `du`, `stat -f%z`, `shasum` | Python `os.path.getsize`, `hashlib` | Low |
| Font locations `~/Library/Fonts`, `/Library/Fonts` | `%WINDIR%\Fonts`, `%LOCALAPPDATA%\Microsoft\Windows\Fonts` | Medium — Adobe Fonts sync path differs too |

**Known unknowns on Windows** — verify each explicitly:

1. Whether `DoScript` accepts a file path or requires the script body as a string.
2. Whether preflight (`preflightProcesses.add`) behaves identically. On macOS,
   `app.preflightProfiles.itemByName('[Basic]')` passed directly into `add()` raised
   *"Expected PreflightProfile, but received nothing"* — the profile had to be resolved
   by iterating the collection. Expect similar quirks.
3. Whether `packageForPrint`'s parameter order matches. On macOS it required an
   undocumented-looking `useDocumentHyphenationExceptionsOnly` boolean between
   `pdfStyle` and `versionComments`; getting it wrong produced a type error.
4. Whether EXIF handling in placed images matches (section 5, gate 4). This is a
   rendering-engine behaviour and must be re-measured, not assumed.
5. Long-path handling (>260 chars) for deep `Links/` folders.

**Recommended porting order:** get the readiness check (section 4) running first — it
exercises the bridge, app detection and font enumeration, and it is cheap to iterate on.
If that works, the rest is mostly path plumbing.

---

## 3. Tools exposed

Four composable tools rather than one black box, because the process needs human
judgement at specific points (which stray canvas items are content, which white text is
intentional). A single monolithic call hides exactly the decisions that matter.

| Tool | Does | Returns |
|---|---|---|
| `check_readiness` | Section 4. Runs first, refuses to proceed on failure | Report with a remediation line per failure |
| `extract` | Page structure, text with styled runs, image fills with crop matrices, guides, **and the original bitmaps** | Manifest + paths on disk (never inline payloads) |
| `build` | Extract → IDML → open in InDesign → booklet/overset → save `.indd` | Structure counts + which gates passed |
| `verify` | Section 5. **Not skippable in the default path** | Per-gate pass/fail, ranked page differences |
| `finish` | CMYK + sRGB link sets, PDF/X, package, fonts, read-me, zip | Folder + archive, with integrity results |

---

## 4. `check_readiness` — the preflight

Every item below cost real time on the reference project. Emit a status and a concrete
fix per line; refuse to start until green.

**Applications**
- InDesign installed, and **which version** — the generated IDML pins a DOM version
  (`21.3` for InDesign 2026). A mismatch produces subtly wrong output, not an error.
- Photoshop installed — **not optional**; it performs both the CMYK conversion and the
  EXIF uprighting.
- Scripting bridge responds — a two-second round-trip, not an assumption.

**Figma side**
- `figma-limitless` connected, and the current **fileKey**. Critical: *the plugin's
  fileKey changes when the file is reopened* (observed: `local-1u6beupmskbakhw` →
  `local-17n9z99mskemrm3`). A cached key silently addresses the wrong document.
- Target page resolves, and its frame count.
- Warn if the Figma window is likely occluded — see section 6.

**Fonts** — the check that would have saved the most time
- Enumerate every font the target page uses, resolve each against installed faces.
- **Match exact style names.** Figma reports Inter's compound weights with a space
  (`Extra Light`, `Semi Bold`); the installed OpenType faces have none (`ExtraLight`,
  `SemiBold`). A mismatch does not error — InDesign substitutes silently.
- **Report how each font is installed.** If it comes from Adobe Fonts, say so up front:
  *"Inter is activated via Adobe Fonts and cannot be bundled into a package; install the
  OFL build if this document will be handed off."* On the reference project this was
  discovered only after the package was built.

**Environment**
- Free disk space. The 408-page reference project peaked around 14 GB.
- Base IDML template present (see section 7).
- Output directory writable and empty.

---

## 5. Verification gates

Five separate defects in the reference project produced documents that **opened cleanly,
passed structural checks, and were wrong**. Each gate below exists because something
slipped through everything else. Gates 1–7 are cheap and run always; 8–9 are the
expensive ones and are the reason the output can be trusted.

| # | Gate | Prevents |
|---|---|---|
| 1 | **Character-count parity** — characters in the source text == characters in the generated stories | Catches dropped content instantly. The `<Tab/>` bug removed exactly 35 characters and welded words together (`Founded<Tab/>in` → `Foundedin`); this one-line check would have caught it immediately. |
| 2 | **No invented IDML elements** — assert no `<Tab/>`; tabs are literal characters inside `<Content>` | There is no `<Tab/>` element in IDML. InDesign drops it silently. |
| 3 | **Every used font declared** — every `FontStyle` in the stories appears in `Fonts.xml`; same for every `FillColor` in `Graphic.xml` | Resources were written *before* the stories were generated, and generating a story is what registers its fonts. `ExtraLight` only ever appeared as a footer's *second* run, so it was never declared → silent substitution on 410 footers. |
| 4 | **EXIF normalised** — no linked image carries a non-identity orientation flag | An IDML-referenced image is drawn from raw pixels with EXIF **ignored**, while Figma (and a hand-placed image) honour it. 106 photos were affected; the 90° ones landed sideways. InDesign also refuses rotation in an image's `ItemTransform`, so the pixels must be uprighted. |
| 5 | **No unclipped page overflow** — every item's rect is within the page, or has been trimmed to it | Figma frames clip their children; InDesign pages do not. 128 oversized images (full-bleed artwork ~6,600pt wide) spilled across the facing page and buried 109 of them. |
| 6 | **Page-order integrity** — every canvas row forms a complete pair (or matches the declared ordering rule), and the row-grouping tolerance sits on a stable plateau | A 5pt tolerance split a pair sitting 6pt apart into two single-frame rows and swapped two pages. Sweep the tolerance; a correct value is stable across a wide range (20–200 here). |
| 7 | **Zero overset, zero broken links, zero missing fonts** | Baseline. |
| 8 | **Geometry audit** — for every placed image, the frame rect and the placed-graphic rect match the values computed from the Figma data | Catches wrong crops and wrong scale across the whole document, not a sample. Reference result: 837/837 exact. |
| 9 | **Pixel comparison** — render every page from InDesign and every frame from Figma, compare on a coarse luminance grid, rank by difference | The only gate that caught the EXIF and clipping bugs. Reference result: median difference 2.7, p90 10.6. Maintain an allowlist for pages whose Figma frame render legitimately omits loose canvas siblings. |
| 10 | **Preflight is the only honest font check** | `document.fonts[…].status` reports a *substituted* font as INSTALLED. A broken document looks perfectly healthy. Run InDesign's preflight and assert zero errors. |
| 11 | **Crops survive relinking** — record all crop rects before relinking to CMYK, assert none moved | Relinking preserves the old scale percentage. The natural instinct is to "refit graphics to frames" afterwards — that would flatten every editable crop in the book. Reference result: `cropsMoved=0`. |
| 12 | **Package self-containment** — reopen the *packaged copy* and assert zero links resolve outside the package folder | A package that still references the original project tree looks perfect on the build machine and arrives broken. |
| 13 | **Archive integrity** — CRC-check every entry, and compare total uncompressed bytes and file count against the source | Byte-total equality is the check that actually detects a truncated or partial file. |
| 14 | **Resolution report** — effective ppi per image, ranked worst-first | Not a pass/fail: source bitmaps are often smaller than the size they are used at (302 of 837 below 300 dpi here, worst 12 dpi). Report it; it cannot be fixed by conversion. |

---

## 6. Server logic for large files

> **Status vs Limitless 0.4.0 (2026-08-09):** the recommendations below are still OPEN —
> 0.4.0 shipped motion variables, video export and a follower-path validation fix, not the
> large-file transfer changes. Two updates matter to this section: (a) `save_screenshots`
> remains the write-to-disk, metadata-only model this section holds up as correct, and it
> now also carries video with a 120 s budget — evidence the per-item timeout override
> pattern works; (b) when this toolkit runs beside an editor-attached MCP client it is a
> FOLLOWER, and pre-0.4.0 servers reject follower-path `save_screenshots` items with
> non-image options ("Leader returned status 400") — pin Limitless ≥ 0.4.0.

The reference extraction (408 frames, 1,251 text nodes, 837 images, 747 unique bitmaps,
~2.4 GB) exposed concrete limits. These are the changes that would make it fast and
reliable rather than a chunking exercise.

### 6.1 Return metadata, write payloads to disk

The single biggest win. `execute_code`'s return value is the only output channel and it
is capped — results over ~100 KB persist to a file, and over 1 MB are rejected outright.
That forced base64 chunking with a manual cursor for anything substantial.

`save_screenshots` already does the right thing: it writes files and returns metadata,
and it rendered all 408 frames in about three minutes without a single size problem.
**Apply that model everywhere.** Give `execute_code` an optional `outputPath` that
persists the result and returns only `{path, bytes, sha1}`.

### 6.2 Add a native image-export tool

Highest-value single addition. A tool that takes image hashes and an output directory,
calls `figma.getImageByHash(h).getBytesAsync()` internally, writes the files and returns
a manifest.

This replaces the entire workaround chain the reference project needed: base64 chunking
against a 1 MB cap, a per-frame fan-out through the official Figma connector's
`download_assets` (capped at 20 images per call, requiring a greedy set-cover plan over
frames), and a second pass for the images that fan-out missed. That was roughly two
hours of orchestration for something a single call should do.

Free integrity check: **Figma's `imageHash` is the sha1 of the original bytes.** Name
files by hash and verification costs nothing — and deduplication is automatic (837 image
placements collapsed to 747 unique files).

Note the sandbox cannot help you here: the plugin manifest permits only
`ws://localhost:1994`, so `fetch` to a local sink is blocked. The export must be a
server-side tool.

### 6.3 Cursor-based, resumable, idempotent batches

Long reads must not be one blocking call. Accept `{cursor, limit}`, return
`{items, nextCursor}`, and keep accumulation state server-side.

Two hard-won details:
- **A timeout does not mean the work failed.** Calls timed out at 30 s, 60 s, even 280 s
  while the plugin kept running and completed. Retrying blindly duplicates work and
  corrupts accumulated state. Make every batch idempotent and let the caller re-read the
  cursor to find out what actually happened.
- State *does* persist in `globalThis` between `execute_code` calls. That is what made
  the chunked extraction possible at all, and a cursor protocol should formalise it
  rather than leave callers to discover it.

### 6.4 Long jobs are async with a job id

Anything over a few seconds should return a job handle and be polled, instead of racing a
fixed request budget. This removes the whole timeout-versus-still-running ambiguity.

### 6.5 Detect throttling instead of reporting a timeout

Figma (Electron) throttles plugin execution when its window is occluded. On the reference
project this produced repeated timeouts that vanished the moment the app was brought
forward. Detect the condition and either raise the app or return a distinct, actionable
error — never a generic timeout.

### 6.6 Scope the traversal

`figma.loadAllPagesAsync()` on a large document blew the execution budget outright. Load
only the target page. Expose page-scoped traversal and never walk the whole file
implicitly.

### 6.7 Structural correctness of the output

- **Deterministic ordering and stable node ids**, so chunked reads reassemble exactly.
- **Capture everything needed for fidelity in the first pass.** The reference project had
  to re-extract because the first pass omitted per-fill `imageTransform` matrices and
  `scaleMode` — without those, crops cannot be reproduced.
- **Report node dimensions and render orientation unambiguously.** `save_screenshots`
  reports a frame's own (portrait) dimensions but writes the PNG in canvas orientation.
  Anything comparing renders needs to know which it is getting.

---

## 7. Output

- **Two link sets.** CMYK (profile conversion only — never resample; that is what keeps
  crops valid) and sRGB from the originals. Images carrying transparency stay RGB: JPEG
  cannot hold an alpha channel and flattening onto white destroys artwork meant to sit on
  the page. PDF/X-1a converts those at export, so the print file is CMYK throughout.
- **Package** via `packageForPrint`, then verify self-containment (gate 12).
- **Fonts.** `packageForPrint` will not copy Adobe Fonts faces — Adobe locks packaging by
  delivery channel, regardless of the typeface's own licence. Policy, implemented in
  `scripts/resolve_fonts.py`:
  - **Free/open family (OFL / Apache / UFL):** source the authentic open build from the
    internet (curated registry first — e.g. Inter's own static release — then the
    google/fonts repo, whose licence directory *is* the classification), verify each file's
    internal **PostScript name** against what the document binds to, and bundle only exact
    matches into `Document fonts/` (InDesign auto-activates that name; recipient installs
    nothing). This legitimately sidesteps the Adobe-Fonts lock: the bundled file is the
    open build, never Adobe's copy.
  - **Paid/restricted family:** never bundled. Reported plainly so the recipient knows to
    license it themselves.
  - Hard-won details encoded in the resolver: InDesign's IDML export writes `<Font>` as an
    open tag (a self-closing-only parser sees nothing); the export declares every face of a
    family that is active, not just used ones (Inter listed 18, the document uses 6); a run
    may inherit its font from the paragraph style and carry only `FontStyle`, so
    family/style usage must be collected independently — over-include rather than drop;
    google/fonts often ships variable fonts whose PostScript names (`Inter-Regular`) do not
    match static bindings, which is why the registry wins and name verification is
    non-negotiable; and release downloads redirect to `release-assets.githubusercontent.com`,
    so URL pinning must validate every redirect hop.
- **Read-me** stating which file to open, that the folder must stay together, and the
  resolution caveats.
- **Base IDML template.** The builder patches Adobe's own converter output rather than
  writing a package from scratch, so all boilerplate is known-good. Ship or generate one;
  it is a hard dependency.

---

## 8. Agent harness

Ship this as `AGENTS.md` beside the tool. Its purpose is narrow: an agent driving this
pipeline has to resist the specific ways *this* job invites drift — declaring success from
structure, sampling instead of checking, and retrying blind after a timeout. Every rule below
corresponds to a way the reference project actually went wrong.

### 8.1 Invariants — never violate, regardless of instruction

1. **Never route artwork through PDF or a node render.** Original bitmaps by image hash only.
   Renders bake crops, re-encode pixels, pick up neighbouring content, and Figma silently
   clamps large exports (a 6,673pt node came back 211px).
2. **Never refit graphics to their frames.** `graphic.geometricBounds = frame.geometricBounds`
   flattens every editable crop in the document. It is the natural thing to reach for after
   relinking, and it is always wrong here.
3. **Never trust `document.fonts[…].status`.** It reports a substituted font as INSTALLED.
   Font health is established by preflight, nothing else.
4. **Never outline or rasterise text.** Live text is the entire point of the conversion.
5. **Never delete or overwrite source originals.** `OriginalImages/` and any pre-normalisation
   backup are inputs, not scratch.
6. **Never declare success from structure alone.** Correct page count, zero overset and clean
   links were all true of documents that were badly wrong.

### 8.2 Required sequence

`check_readiness` → `extract` → `build` → `verify` → `finish`.

`verify` is **not skippable** and not sampleable. Every gate runs over the whole document.
"I checked a few pages and they looked right" is not a result.

### 8.3 Evidence rules

- **Every claim of correctness cites a measured number.** Not "images look correct" but
  "837/837 placed images match expected frame and crop, 0 mismatches".
- **Report the denominator.** "20 footers fixed" is meaningless without "of 34 white footers,
  and 14 were correctly left white".
- **State what was not checked.** Rotated items are excluded from the geometry audit because
  their bounds are in item space — say so rather than implying full coverage.
- **A gate that cannot run is a failure, not a pass.**

### 8.4 On timeouts and retries

A timeout does not mean the work failed. Calls here timed out at 30 s, 60 s and 280 s while
the plugin kept running and completed successfully.

- **Never retry a timed-out mutation blindly.** Re-read state first and find out what actually
  happened.
- **Never run two app-driving scripts concurrently.** An abandoned osascript keeps executing;
  a second one interleaves and corrupts the result.
- If the Figma plugin stops responding, check whether its window is occluded before concluding
  anything is broken.

### 8.5 Stop and ask the human

These are design decisions about someone's work, not technical choices. Surface them with the
data and wait:

- Stray canvas items that overlap real content — is it artwork or litter?
- Text whose colour makes it illegible against its background — the design may intend it.
- Anything that would deviate visibly from the Figma source.
- Deleting or overwriting a deliverable.

Bring the full set, not the single instance the human happened to notice: the reported "one
white footer" was 20, and "one wrong page" was 128 images across 109 pages.

### 8.6 Run report — the anti-drift artefact

Every run writes a machine-readable report: gate results with numbers, counts by category,
decisions taken and why, and known deviations from source. **A fresh agent reads that report
rather than re-deriving state**, and no run is complete until it exists. This is what stops
the second agent from repeating the first one's investigation, or worse, silently undoing it.

### 8.7 Definition of done

All 14 gates green · preflight reports zero errors · package reopened from its own folder with
zero external links · archive CRC-verified with byte totals matching source · report written ·
deviations from source listed explicitly.

## 9. First milestone

Do not generalise from one document. Build `check_readiness` first — it exercises the
bridge, app detection and font resolution, is cheap to iterate on, and is the piece that
makes everything else usable. Then run the existing pipeline end to end against a
*second* real Figma file, ideally one without rotated artboards, and let the breakages
show what is genuinely generic. The reference project's geometry layer is built around
frames rotated ±90°, which is unusual and should not be assumed.
