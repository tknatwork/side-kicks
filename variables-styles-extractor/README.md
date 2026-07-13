# Variables & Styles Extractor

[![Figma Plugin](https://img.shields.io/badge/Figma-Plugin-ff69b4)](https://www.figma.com/community/plugin/1584331992332668732/variables-and-styles-extractor)
[![Source: MIT](https://img.shields.io/badge/Source-MIT-yellow.svg)](./LICENSE)
[![Distribution: CFRL](https://img.shields.io/badge/Figma%20Distribution-CFRL-blueviolet.svg)](https://www.figma.com/community-free-resource-license/)
[![Version](https://img.shields.io/badge/version-2.2.0-blue.svg)](./package.json)

**Move your design system anywhere. Export and import Figma variables and styles — selectively, safely, and in Tokens Studio–compatible JSON.**

> 🔍 **Status:** v2.2.0 published to Figma Community · v2.0.0 first published 17 January 2026

Variables & Styles Extractor moves complete design systems between Figma files — every variable collection, mode, alias, and style — as clean, re-importable JSON. It runs **100% locally** (zero network access) and stays responsive on large design systems thanks to a batched processing engine with live progress and a real Cancel button.

## What's new in v2.2

- 🌫️ **New effect types** — Noise (monotone / duotone / multitone), Texture, and Glass effect styles export and import with full fidelity; Shader effects export as markers.
- 🧱 **Pattern paints** — pattern fills round-trip (same-file); video and shader paints export as markers instead of silently disappearing.
- 🔤 **Complete text styles** — leadingTrim, paragraphSpacing, paragraphIndent, listSpacing, hangingPunctuation, and hangingList now round-trip.
- 🎛️ **All 22 variable scopes** — including TEXT_CONTENT, OPACITY, STROKE_FLOAT, EFFECT_FLOAT and the font scopes; one unrecognized scope no longer drops the rest.
- 🔮 **Forward-compatible variables** — future Figma variable types (e.g. easing) export under their real type name and import verbatim where supported, instead of being coerced to strings. Timing tokens (FLOAT ms) already round-trip.
- 🛡️ **Import hardening** — a single unsupported effect, paint, or style can no longer abort an import (or corrupt its automatic rollback); it is skipped with a logged warning.

## Highlights (v2.1)

- 🧩 **Simple mode, redesigned** — a clean three-section layout: pick variables, pick styles, export. Collections expand into name-prefix groups (just like Figma's Variables panel), so you ship exactly the groups you choose.
- 🎯 **Group-level selection** — export or import only the variable/style groups you tick, not all-or-nothing.
- 📦 **Built for large design systems** — batched processing keeps Figma responsive on thousands of variables, with live progress bars and a Cancel button that safely rolls everything back.
- 🛡️ **Safe import undo** — every import takes a validated snapshot first; undo restores in one click, and a single `Cmd/Ctrl+Z` reverts the whole import natively. A corrupt snapshot can never wipe your file.
- 🎨 **Three export formats** — Figma JSON (perfect round-trips), W3C Design Tokens, and a Tokens Studio–compatible format (token sets per Collection/Mode, `$themes`, DTCG keys, `{dot.path}` aliases).
- ⚙️ **Advanced mode** — per-mode selection, merge strategies, pre-import diff review, plan checks, library mapping, and font validation, one toggle away.
- 🔒 **Private by design** — `networkAccess: none`; your file never leaves Figma.

## Features

### Variables
- ✅ Color, Number, String, Boolean variables
- ✅ Variable collections with multiple modes
- ✅ Variable aliases and references (resolved or preserved)
- ✅ Library-linked variable detection + dependency flagging

### Styles
- ✅ Color styles (solid, gradient, image fills)
- ✅ Text styles (full typography settings)
- ✅ Effect styles (shadows, blur)
- ✅ Grid styles (rows, columns, grid)
- ✅ Multi-paint color styles

### Export formats
- ✅ **Figma JSON** — full-fidelity round-trip (default)
- ✅ **Tokens Studio** — single-file shape with token sets, `$themes`, `$metadata`, DTCG keys
- ✅ **W3C Design Tokens** — the open DTCG draft standard

### Import safety
- ✅ Validated pre-import snapshot (checked **before** any clearing)
- ✅ Automatic rollback on failure, with progress
- ✅ One-click undo + single-step native `Cmd/Ctrl+Z`
- ✅ Smart merge / clean import / custom merge

### Heavy-load handling
- ✅ Batched processing engine — stays responsive on large systems
- ✅ Live progress for export, import, and clear operations
- ✅ Cooperative Cancel that rolls back safely
- ✅ Chunked export delivery for very large payloads
- ✅ Instant paste / lag-free mode switching with multi-MB JSON

### Validation
- ✅ Font availability checking
- ✅ Library connection status + external dependency detection
- ✅ Plan compatibility (Starter/Pro/Org/Enterprise)

### Interface
- ✅ Simple mode (compact 905×628) and Advanced mode (1200×628)
- ✅ Edge-fade scroll indicators and skeleton loaders
- ✅ Activity log with copy/clear controls

## Installation

### From Figma Community (Recommended)
1. Visit the [plugin page](https://www.figma.com/community/plugin/1584331992332668732/variables-and-styles-extractor)
2. Click "Open in…" / "Save"
3. Open any Figma file
4. Run: Plugins → Variables and Styles Extractor

### From Source
1. Clone this repository
2. In Figma: Plugins → Development → Import plugin from manifest…
3. Select `variables-styles-extractor/manifest.json`

## Usage

### Export
1. Open a Figma file with variables/styles and run the plugin (opens in Simple mode)
2. Tick the variable collections/groups and style types you want
3. Pick a format (Figma JSON · Tokens Studio · W3C) and click **Export** — or **Copy JSON**

### Import
1. Open the target Figma file and run the plugin → Import tab
2. Paste JSON or upload a `.json` file
3. Tick what to import, then click **Import** (use **Undo Import** to revert)

## Privacy

- 🔒 **No network access** — `networkAccess: none` in the manifest; fully local
- 🔒 No data collection — your file never leaves Figma
- 🔒 Open source (MIT)

## Build

```bash
cd variables-styles-extractor
pnpm install --frozen-lockfile
pnpm build:dev   # tsc only (readable code.js)
pnpm build       # tsc + terser (minified, shipped) — commit code.js
```

`code.js` is the checked-in compiled artifact; there is no CI build step, so commit it alongside `src/code.ts` changes. See [`AGENTS.md`](./AGENTS.md) and [`docs/CODING_STANDARDS.md`](./docs/CODING_STANDARDS.md) for the Figma QuickJS/iframe constraints.

## Support

- [Report a Bug](https://github.com/tknatwork/side-kicks/issues/new?template=bug_report.md)
- [Request a Feature](https://github.com/tknatwork/side-kicks/issues/new?template=feature_request.md)
- [Known Issues](./docs/KNOWN_ISSUES.md)
- [Changelog](./docs/CHANGELOG.md)

## License

This project uses a **two-surface license model**:

| Surface | License | Governs |
|---------|---------|---------|
| Source code (this repository) | [MIT](./LICENSE) | Fork, modify, redistribute, relicense derivative source |
| Figma Community distribution | [Community Free Resource License](https://www.figma.com/community-free-resource-license/) | End-user install + redistribution on Figma Community |

The MIT license applies to the source code in this repository. When the plugin is installed from the [Figma Community listing](https://www.figma.com/community/plugin/1584331992332668732/variables-and-styles-extractor), the Figma Community Free Resource License (CFRL) governs that distribution channel — this is Figma's platform-level license and is automatically applied to free community resources.

Forks may republish the plugin to Figma Community under their own listing; CFRL will apply to their listing independently. The MIT grant on the source is not affected.

See [LICENSE](./LICENSE) for the full MIT text.
