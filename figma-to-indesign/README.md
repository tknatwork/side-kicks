# figma-to-indesign

**Figma → real, editable Adobe InDesign — no PDF in the middle.** An MCP toolset that
pairs with [Limitless MCP for Figma](../figma-limitless-mcp/) to turn a Figma page into
a native `.indd`/`.idml` with live text, the **original image bitmaps** with editable
crops, generated paragraph styles, facing-page booklets, CMYK + sRGB link sets, a
print-ready PDF/X-1a, and a self-contained hand-off folder with verified open-licence
fonts.

![Platform](https://img.shields.io/badge/platform-macOS%20only-black)
![Windows](https://img.shields.io/badge/windows-untested%20%2F%20unsupported-red)
![Status](https://img.shields.io/badge/status-v0.1%20extracted%20from%20a%20real%20conversion-orange)
![License](https://img.shields.io/badge/license-MIT-yellow)

📖 **AI builders:** read [AGENTS.md](AGENTS.md) before driving this pipeline.
📐 **Architecture & rationale:** [docs/SPEC.md](docs/SPEC.md) — every design decision is
tied to a defect from the reference conversion.
🪟 **Windows:** not supported, not tested — [docs/WINDOWS.md](docs/WINDOWS.md) is the
porting guide.

---

## Why no PDF?

Routing Figma → PDF → InDesign flattens text, bakes crops into pixels, re-encodes
images, and Figma silently clamps large exports (a 6,673 pt node came back 211 px).
This pipeline instead:

- pulls **original bitmaps by image hash** through the Figma plugin API — the hash *is*
  the sha1 of the bytes, so identity and dedup are free;
- writes **IDML directly** (patching a known-good Adobe base package), so text stays
  live and crops stay editable;
- places real vector nodes as **SVG**, which InDesign takes as first-class vector art;
- drives InDesign and Photoshop over the classic scripting bridge for the booklet,
  overset, CMYK, preflight, packaging and export steps.

## Provenance — read this before trusting it

This toolkit was **extracted from one completed real conversion**: a 408-page /
204-spread graduation-project book (1,251 live text frames, 837 placed images, 747
unique bitmaps). Everything here exists because that project needed it — including
the **14 verification gates**, each of which corresponds to a defect that produced a
document that *opened cleanly and was wrong* (dropped tab characters, EXIF-rotated
crops, page-boundary bleed onto facing pages, silently substituted fonts, swapped
page order).

It has **not** yet been generalised against a second document. The pipeline scripts
carry per-project constants at their tops; the intended next milestone (SPEC §9) is
running them against a different real file and generalising from what actually breaks.

## Quick start

```bash
# 1. register the MCP server (dependency-free Python 3)
claude mcp add figma-to-indesign -- python3 /path/to/figma-to-indesign/server/server.py

# 2. FIRST, always:
#    tool: check_readiness   (optionally pass {"idml": "/path/doc.idml"} to enumerate fonts)
```

`check_readiness` verifies: InDesign + Photoshop installed (Adobe hides apps in
versioned subfolders — handled) and their versions, a live scripting-bridge
round-trip, the figma-limitless bridge port, disk space, and the fonts the document
actually uses. It refuses nothing — but **you** should refuse to start until it is
green.

### Tools

| Tool | Status | What it does |
|---|---|---|
| `check_readiness` | **fully working** | Environment preflight — run first, always |
| `resolve_fonts` | **fully working** | Classify + bundle document fonts (see below) |
| `build_idml` | reference impl | Extraction → IDML (per-project constants required) |
| `audit_geometry` | reference impl | Gate 8: every image's frame + crop vs the Figma data |
| `compare_pages` | reference impl | Gate 9: render-level diff of every page vs its frame |

### Fonts: the Adobe Fonts problem, solved honestly

Adobe Fonts activation blocks `packageForPrint` from copying a font **even when the
typeface itself is free** — the lock is per delivery channel, not per licence.
`resolve_fonts` implements the sane policy:

- **Open family (OFL / Apache / UFL):** fetch the *authentic open build* from its
  public source (curated registry first, then the google/fonts repo, whose licence
  directory is the classification), verify each file's **internal PostScript name**
  against what the document binds to, and bundle only exact matches into
  `Document fonts/` — a folder name InDesign auto-activates, so recipients install
  nothing.
- **Paid/restricted family:** never bundled; reported plainly so the recipient knows
  to license it themselves.

Name verification is non-negotiable: google/fonts often ships variable fonts whose
PostScript names (`Inter-Regular`) don't match static bindings — a near-miss
substitutes silently in InDesign.

## Layout

```
figma-to-indesign/
├── server/server.py     MCP stdio server (no dependencies)
├── pipeline/            the conversion + verification scripts (Python)
│   └── jsx/             the InDesign / Photoshop ExtendScript passes
├── docs/SPEC.md         full architecture: tools, gates, server design, scale notes
├── docs/WINDOWS.md      Windows porting guide (UNTESTED)
└── AGENTS.md            harness for AI agents driving the pipeline
```

## Known limitations (declared, not hidden)

Editorial layouts only — text and placed images. Gradients, effects, blend modes,
masks-as-clipping, components and multi-column text are **not** reproduced (masks are
detected and skipped rather than drawn — an `isMask` node renders nothing standalone).
Vector nodes route to SVG placement; nodes whose SVG export is missing fall back to a
flat approximation **and are listed as pending jobs**, never silently approximated.

---

*Independent project — not affiliated with, endorsed, or sponsored by Figma or Adobe.
Product names are used descriptively.*
