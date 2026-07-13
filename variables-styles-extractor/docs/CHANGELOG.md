# Changelog - Variables & Styles Extractor

> ⚠️ PROTECTED FILE - DO NOT DELETE
> This file must NEVER be deleted during cleanup or overhaul operations.
> Instead, rewrite its contents to reflect the new direction.

All notable changes to this Figma plugin are documented here.

**Repository:** https://github.com/tknatwork/side-kicks/tree/main/variables-styles-extractor

---

## [2.2.0] - 2026-07-13

### 🌫️ New Style Types, Full Scopes & Forward-Compatible Variables

Feature release. Brings the export/import surface up to the 2026 Figma API
(plugin-typings 1.130): new effect and paint types, the complete text-style
property set, all 22 variable scopes, and forward-compatibility for future
variable types — plus import hardening so one unsupported entry can never
abort an import or its rollback.

### Added
- **Effect styles**: NOISE (MONOTONE / DUOTONE / MULTITONE — color,
  secondaryColor, opacity, noiseSize, noiseSizeVector, density), TEXTURE
  (noiseSize, radius, clipToShape) and GLASS (lightIntensity, lightAngle,
  refraction, depth, dispersion, radius) export and import with full fidelity.
  SHADER effects export as `{ "type": "SHADER" }` markers (shader ids are
  file-local) and are skipped with a warning on import.
- **Paint styles**: PATTERN paints round-trip (sourceNodeId, tileType,
  scalingFactor, spacing, horizontalAlignment) — the source node must exist in
  the target file. VIDEO and SHADER paints export as markers instead of being
  silently dropped; styles containing only such paints now export too.
  `visible` and `blendMode` are exported for every paint when non-default.
- **Text styles**: `paragraphSpacing`, `paragraphIndent`, `leadingTrim`,
  `listSpacing`, `hangingPunctuation`, `hangingList` now export and import.
- **Variable scopes**: all 22 scopes recognized (adds TEXT_CONTENT,
  STROKE_FLOAT, EFFECT_FLOAT, OPACITY, FONT_FAMILY, FONT_STYLE, FONT_WEIGHT).
  Tokens Studio export maps PARAGRAPH_INDENT → dimension, FONT_WEIGHT →
  fontWeights, TEXT_CONTENT → text.
- **Forward-compat variables**: an unknown resolved type (e.g. a future
  easing type) exports under its real name in lowercase instead of being
  mislabeled `string`; on import it is tried verbatim — Figma builds that
  support it accept it, older builds skip that variable with a warning
  instead of silently importing a STRING. Timing tokens (FLOAT ms) already
  round-trip unchanged.
- New regression suite `tests/type-mapper.test.mjs` (forward-compat mapping,
  scope filtering, effect defaults) wired into `pnpm test`.

### Fixed
- **Import-abort hazard**: a single unknown effect type used to throw during
  `style.effects` assignment, aborting the entire import mid-write and then
  crashing the automatic rollback (which re-imported through the same code) —
  a real data-loss path. Effects, paints, and layout-grid assignments are now
  guarded per style: unsupported entries are skipped with a logged warning and
  everything else lands.
- **All-or-nothing scope drop**: one unrecognized scope used to silently drop
  every scope on that variable. Import now retries with the known-scope subset
  and logs what was dropped. The snapshot-restore path got the same guard.
- `fontWeight` removed from the documented text-style import surface — it was
  never applied (weight comes from `fontStyle`); docs now say so.
- Stray raw NUL byte in `src/code.ts` escaped (`'\u0000'`) so text tooling
  (grep and friends) no longer treats the source as binary.

---

## [2.1.2] - 2026-06-11

### 🔗 External Library Dependency Resolution & Import Reliability

Corrections release. Fixes imported variables that referenced external (team
library) collections collapsing to `0` when the library was not connected to
the target file, plus the detection and defaults around that workflow.

### Fixed

#### Alias re-linking on import
- **Variables referencing unconnected libraries no longer import as `0`.**
  Alias resolution now matches by content, in order: exact `collection/path`
  → unique path match across all collections → loose collection-name match.
  External refs re-link to same-named variables already present in the file
  (e.g. tokens previously imported from another design system file), and only
  genuinely ambiguous matches refuse to guess.
- **Collection-name matching collapses whitespace runs** — real-world files
  contain pairs like `☀️ Mode` (library, one space) vs `☀️  Mode` (local, two
  spaces) that previously failed to match.

#### Fallback value capture on export
- **Chained library aliases now export a real `$localValue`.** A library token
  whose own value is another alias previously exported no fallback at all;
  the chain is now resolved recursively (per mode).
- **Library-internal primitives resolve via the rendering engine.** When the
  chain crosses into variables the Plugin API cannot fetch (e.g. unpublished
  primitives inside the library file), the exporter asks Figma's own resolver
  (`Variable.resolveForConsumer`) through a temporary hidden node pinned to
  the exported mode — the measured value becomes the fallback. Applies to
  both "preserve bindings" and "export as raw values" modes.

#### Import UX
- **Asset Sources card is content-aware.** Per-library status is now
  `connected` / `matched by name to variables in this file` / `provided by
  this import` / `partial` / `missing` — instead of the name-only
  "not connected" warning that ignored satisfiable dependencies.
- **Import Behaviour defaults follow the dependency check.** External deps
  already present in the file → **Smart Merge** (protects the dependency
  variables from being wiped by Clean Import); deps not present → **Clean
  Import**. A manual choice always wins; Simple mode follows the same rule.
- **Simple tab Import button spacing** — removed the phantom gap below the
  button caused by the empty undo placeholder in its action row.

---

## [2.1.0] - 2026-06-10

### ✨ Simple Mode Redesign, Heavy-File Performance & Tokens Studio Export

**Status:** Published to Figma Community

### New Features

#### Simple Mode — Redesigned 3-Section Layout
- **🧩 Simple mode rebuilt as a clean 3-section layout** on both tabs
  - **Export tab:** Variables (collections → groups) → Styles (types → groups) → Log + Export + Copy JSON
  - **Import tab:** Paste/Upload → parsed contents (grouped) → Log + Import + Undo
- **🎯 Collection- and group-level selection**: pick exactly which variable groups (by name prefix, e.g. `color/...`) and style groups to export or import — no more all-or-nothing
- **📐 Compact window in Simple mode**: sections match the Advanced column width and the plugin window shrinks to 905×628 in Simple mode (back to 1200×628 in Advanced)
- **🖥️ Advanced mode unchanged**: pixel-identical to v2.0.0

#### Progress Bars + Cancel for Long Operations
- **📊 Live progress bars** for long-running exports, imports, and clears — shown in both Simple and Advanced modes
- **🛑 Cancel button**: safely stop a long operation mid-flight
- **🧊 No more freezes**: large files no longer lock up the plugin while it works

#### Safer Import Undo
- **🛡️ Snapshot validated before any clearing**: a corrupt or incomplete undo snapshot can no longer wipe your file — undo now refuses to clear anything until the snapshot checks out
- **↩️ One-step native undo**: imports (and standalone clears) are wrapped so a single Cmd+Z in Figma reverts the entire operation

#### Tokens Studio-Compatible Export (New Optional Format)
- **🎨 New third export format**: "Tokens Studio" — a single `tokens.json` with token sets per Collection/Mode, `$themes`, and `$metadata.tokenSetOrder`
- **🔗 DTCG-style keys and Tokens Studio-canonical types**, with aliases exported as `{dot.path}` references
- **🖌️ Color, typography, and effect styles** included as token sets; grid/image/blur styles are skipped with explanatory notes
- Available from the Advanced format dropdown and the Simple mode Format select

### Performance
- **⚡ Faster imports**: a single local cache scan per import (previously up to 4 full rescans); library indexing now runs only when actually needed
- **📦 Chunked export delivery**: huge exports are streamed to the UI in chunks, so very large files export reliably without hitting message-size limits

### Fixed
- **🔧 showToast crash**: fixed a `ReferenceError` that could crash the plugin when showing notifications

### Removed
- **🧹 Dead weight removed**: ~850KB of unused files and dead code stripped from the plugin
- **🔐 Unused `currentuser` permission dropped**: the plugin no longer requests access it never used
- **🚫 Blocked Google Fonts request removed**: the UI no longer attempts an external font request that was always blocked by the plugin's no-network policy

---

## [2.0.0] - 2026-01-16 (UNRELEASED)

### 🎨 Major UI Overhaul - Wide 4-Column Layout

**Status:** In development - ready for final testing before Figma Community publish

Complete UI redesign from vertical scrollable layout to wide horizontal 4-column grid for better UX hierarchy.

### Performance Optimizations (2026-01-16)

#### New Features
- **🚀 Web Worker JSON Parsing**: Heavy JSON parsing offloaded to Web Worker
  - Inline Worker created via Blob URL
  - Handles both parse and stringify operations
  - 5-second timeout with graceful fallback to main thread
- **⚡ Tiered JSON Processing**: Optimized parsing based on file size
  - <50KB: Direct sync parsing (fastest)
  - 50-500KB: Idle callback parsing
  - >500KB: Web Worker parsing (non-blocking)
- **📦 Result Caching System**: LRU cache for parsed JSON
  - Max 10 entries with 60-second expiration
  - Fast hash function sampling first 10KB + length
  - Cache cleared on input clear
- **🔄 Throttled Validation**: Backend messages throttled to 300ms
  - Prevents excessive postMessage calls to Figma
  - Uses async stringify for large data
- **🎯 Async JSON Operations**: All JSON operations now async
  - `parseJSONAsync()` - tiered parsing with Worker support
  - `stringifyJSONAsync()` - async stringify for large arrays
  - `structuredClone` fallback for deep cloning (faster than JSON)

#### UX Improvements
- **🗑️ Clear Button Flash Animation**: After import completes, clear button flashes red
  - 3-cycle animation with pulsing border and scale
  - Enhanced hover state with red shadow
  - Auto-removes after 2.5 seconds
- **⏳ Import Button Feedback**: Prevents double-clicks during import
  - Button disabled immediately on click
  - Text changes to "⏳ Processing..."
  - Resets to "📥 Import Selected" after completion or failure

#### CSS Performance
- **`contain: layout style`** on scrollable containers
- **`will-change`** for animated elements (skeletons, buttons)
- **Hardware-accelerated scrolling** with `transform: translateZ(0)`
- **`content-visibility: hidden`** for off-screen elements
- **Passive scroll listeners** on all scroll handlers

#### Technical
- **Debounced input handling**: 150ms debounce on textarea input
- **RAF batched DOM updates**: DOM changes via `requestAnimationFrame`
- **Fast object flattening**: Stack-based iteration (vs recursive)
- **Skeleton loaders**: Instant feedback while parsing large files

### Import Safety Features (2026-01-16)

#### Automatic Rollback
- **📸 Pre-Import Snapshots**: Captures file state before every import
- **🔄 Automatic Rollback on Failure**: Restores file if import crashes
- **↩️ Manual Undo Button**: Undo Import button persists until clicked or new import starts
- **💬 User Feedback**: Clear messaging during rollback process

### Import Enhancements (2026-01-15)

#### New Features
- **🎯 Custom Merge Option**: New Import Behavior option allowing selective clearing
  - Choose to clear Variables only, Styles only, or both before import
  - Available in Advanced mode alongside Smart Merge and Clean Import
- **📊 Selection-Aware Preview Stats**: Review Changes section updates based on selection
  - Modes count reflects selected modes per collection
  - Variables count calculated from selected collections only
  - Styles count updates when styles are selected/deselected
- **🔄 Auto Import Behavior Selection**: Automatically selects behavior based on diff
  - Smart Merge when overlap detected between JSON and existing file
  - Clean Import when importing to empty file or all new data
- **📋 Modes Row in Review Changes**: New row showing total modes being imported
- **🖼️ Two-Pass Variable Import**: Variables imported in correct order
  - First pass: Raw values (non-alias variables)
  - Second pass: Alias variables (after targets exist)

#### Bug Fixes
- **🔧 Button Flash Bug**: Fixed import button briefly enabling during validation
- **🔧 Validation Button State**: Fixed button staying enabled after validation errors
- **🔧 Preview Stats Update**: Fixed data structure access using `flattenObject()` and `v.$type`
- **🔧 Image Import Priority**: Fixed to prioritize base64 data over imageHash
- **🔧 Font Status Persistence**: Fixed pre/post font status sections not hiding on clear
- **🔧 Image Import Control**: Fixed images importing when checkbox unchecked in Advanced mode
  - Simple mode: Images always included if present in JSON
  - Advanced mode: Images only included when checkbox is checked

### Breaking Changes
- **Plugin size**: Now 1200×628 pixels (was 1000×540px)
- **Layout**: Complete restructure from single-column scroll to 4-column grid

### New Features

#### UI/UX
- **📐 4-Column Grid Layout**: Each tab displays all information at once
  - Export Tab: Selection → Preview → Status/Output → Activity Log
  - Import Tab: Input → Options → Validation → Activity Log
- **🎯 Persistent Header**: Tabs stay fixed at top, always accessible
- **📋 Dual Activity Logs**: Log appears in column 4 of both tabs, synced in real-time
- **📋 Log Controls**: Copy and Clear buttons for activity log
- **🗑️ Clear Input**: Quick clear button for import JSON input
- **📊 Empty States**: Visual placeholders when no data loaded
- **💻 Console Button**: Quick access button in header to open Figma developer console (⌥⌘I)
- **📊 Preview Tabs**: Stats and Tree views switchable via Order/Tree tabs in Preview column
- **🔘 Persistent Export Button**: Export button stays visible outside scrollable content
- **📸 Smart Image Option**: Image checkbox only appears when images are detected in color styles

#### Color Styles - Extended Paint Support
- **🎨 Full Paint Type Support**: Export/import all Figma paint types
  - **SOLID**: Basic solid color fills with hex color values
  - **GRADIENT_LINEAR**: Linear gradients with stops and transform matrix
  - **GRADIENT_RADIAL**: Radial gradients with stops and transform matrix
  - **GRADIENT_ANGULAR**: Angular/conical gradients
  - **GRADIENT_DIAMOND**: Diamond gradients
  - **IMAGE**: Image fills with optional base64 data transfer
- **📦 Multi-Paint Styles**: Export all paints in a style, not just the first one
- **🖼️ Image Transfer**: Full support for transferring image fills between Figma files
  - "Include image data" checkbox in Export tab
  - Images are base64 encoded (pure JS, no btoa/atob dependency)
  - On import, images are recreated with `figma.createImage()` and get new file-specific hashes
- **🔄 Backward Compatibility**: Legacy exports with single solid colors still import correctly

#### Library & Font Detection
- **📚 Pre-Import Library Detection**: Scans JSON for `$libraryRef` references
  - Uses local collection matching to check library availability
  - Status card with 3 states: All connected (green) | Partial (yellow) | None (orange)
  - Dynamic import button text reflects library status
- **🔤 Font Detection & Validation**: Automatic font availability checking
  - Uses `figma.loadFontAsync()` to verify font availability
  - Status card with 3 states: All available (green) | Some missing (orange) | None found (pink)

### Changed
- **Manifest.json**: UI size controlled via `figma.showUI()` in code.ts (1200×628)
- **CSS**: Added `.column-grid`, `.column`, `.column-header`, `.column-content` classes
- **CSS**: Consistent spacing system with CSS variables (`--spacing-xs`, `--spacing-sm`, `--spacing-md`)
- **CSS**: Fixed column heights with scrollable content inside each column
- **Layout**: Flexbox-based layout for header, main content, and footer (no position: fixed)
- **Build**: Added `build:dev` script for unminified debugging builds
- **Interfaces**: Extended `ExportColorStyle` with `paints: ExportPaintData[]` array
- **Interfaces**: Added `PlanValidation.libraryDependencies` and `fontDependencies`

### Fixed
- **Color Styles Export**: Fixed color styles showing 0 count - was only exporting SOLID paints
- **addEventListener null error**: Wrapped tipModal event listener in DOMContentLoaded
- **Duplicate closing brace**: Removed extra `}` that was breaking JavaScript functions
- **Message Handlers**: Added missing `check_libraries` and `check_fonts` handlers

### Import Tab Overhaul (2026-01-XX)
Major restructure of the Import tab to match the Export tab's polished 4-column layout:

#### New Features
- **📥 Load JSON Data Section**: Reorganized input section with Paste/Upload buttons and dedicated section card
- **📄 File Loaded Indicator**: Visual indicator showing loaded filename with clear button
- **⚙️ Import Options Section**: Vertical layout for import options (Merge, Overwrite, Import Styles)
- **⚠️ Clear Before Import Section**: Moved to bottom of input column with proper danger styling
- **📋 Status Check Column**: Complete restructure with scroll fade effects
  - Plan selection banner with detected plan display
  - Validation results section
  - Library status section with connection status cards
  - Font status section with availability checking
  - Import compatibility banner
  - External dependencies warning banner
- **📁 Preview Column**: Enhanced Order/Tree tabs matching export tab quality
  - Stats total header with item count
  - Scroll fade effects on preview content
  - Better empty state messages
- **📊 Import Results Section**: New section in Activity Log showing import statistics

#### CSS Enhancements
- **🔲 Custom Scrollbars**: Added scrollbar styling for import-input-column-body and import-status-column-body
- **📁 Loaded File Indicator**: New CSS for file loaded indicator with green background
- **📊 Import Result Stats**: New CSS for displaying import results in grid layout
- **📋 Styles Options Vertical**: New vertical layout option for checkboxes

#### JavaScript Updates
- **Scroll Fade Initialization**: Added scroll fade for import input, status, and preview columns
- **File Handler Update**: `handleFile()` now shows loaded file indicator
- **Clear Function Update**: `clearFileLoadedIndicator()` hides all import-related banners
- **Validation Display Update**: `displayValidationResult()` properly hides validation empty state

### Technical
- New paint type interfaces: `ExportSolidPaint`, `ExportGradientPaint`, `ExportImagePaint`
- Union type `ExportPaintData` for all paint types
- `ColorStyleProcessor.export()` rewritten to handle all paint types
- `ColorStyleProcessor.importStyles()` rewritten to recreate all paint types
- `validateImportAgainstPlan()` now detects library and font dependencies
- Pure JavaScript base64 encoding/decoding for image data

---

## [1.7.1] - 2025-12-27

### Changed
- **Project Restructure**: Moved AI_CONTEXT.md and CHANGELOG.md from docs/ to project root
- Aligned with Side-Kicks multi-project structure pattern

---

## [1.7.0] - 2026-01-05 (UNRELEASED)

### 🎨 Enhanced Color Styles Support

**Status:** Merged into v2.0.0

Major feature release adding support for all paint types in color styles, including full image transfer between files.

### New Features
- **🖼️ Image Transfer**: Full support for transferring image fills between Figma files
- **📚 Library Dependency Detection**: Automatic detection and warning for linked library collections
- **🔗 Hybrid Library Import**: Smart handling of library variable references
- **📚 Pre-Import Library Detection**: Automatic detection and status display before import
- **🔤 Font Detection & Validation**: Automatic font availability checking
- **📋 Export Metadata**: JSON exports now include a `_metadata` section
- **Gradient Support**: Export and import linear, radial, angular, and diamond gradients
- **Empty Styles**: Export styles with no paints (previously skipped)
- **Multi-Paint Styles**: Export all paints in a style, not just the first one

### Bug Fixes
- **KI-001**: Fixed collections not displaying in Export tab
- **KI-002**: Fixed null reference errors for drag-drop handlers
- **KI-003**: Fixed color styles not exporting (only SOLID paints were captured)
- **KI-004**: Fixed import crash with IMAGE/VIDEO paint styles
- **KI-005**: Fixed alias type mismatch crash during import
- **KI-006**: Fixed alias resolution failures due to import ordering
- **KI-007**: Fixed collection name matching failures with Unicode/whitespace
- **KI-008**: Added external dependency tracking for cross-collection aliases

---

## [1.6.0] - 2025-12-22

### 🎉 Published to Figma Community

**Status:** Published and Under Review

### Publishing Milestone
- **License**: MIT with copyright headers
- **Code Minification**: Terser compression (1369 → 10 lines)

### Added
- MIT License file
- Copyright headers in all source files
- Build script with Terser minification
- Comprehensive README with installation instructions
- Neo-brutalist thumbnail for Figma Community listing

---

## [1.5.5] - 2025-12-21

### ☕️ UI Optimization Release

### UI Improvements
- **☕️ Emoji Branding**: Added coffee emoji to window title bar
- **Space Optimization**: Removed header section, reclaimed ~60px of usable UI space
- **Compact Window**: Reduced window height from 820px → 760px
- **Title Bar Info**: Version number now displayed in Figma window title

### Bug Fixes
- **JSF-AV Compliance**: Converted all 24 synchronous Figma style API calls to async
- **Figma VM Compatibility**: Changed TypeScript target to ES2017 (native async/await, no spread operators)
- **File Indicator Bug**: Fixed "File loaded: export.json" indicator not clearing after import

---

## [1.5.2] - 2025-12-19

### 🚀 Major Feature Release

### New Features

**v1.5.0 - Plan Limits Validation:**
- Auto-detection of Figma plan based on existing collections' mode counts
- Plan selector (Starter/Professional/Organization/Enterprise)
- Pre-import validation with clear error/warning messages
- Shows collection mode counts vs. plan limits

**v1.5.1 - Mode Selection UI:**
- Mode selection UI for limited plans - choose which modes to import
- Detected Plan banner showing file's plan status before import
- Visual mode checkboxes with limit tracking per collection
- Import filters to only selected modes when plan limits apply

**v1.5.2 - Performance Optimizations:**
- Increased UI window size (480x720) for better handling of large design systems
- CSS `contain`, `will-change` for smooth scrolling
- GPU-accelerated collection items with `transform: translateZ(0)`
- Debounced JSON input parsing (150ms) to prevent lag
- Limited log entries to 100 max to prevent memory bloat

---

## [1.2.0] - 2025-12-18

### 🔌 Bug Fixes for Publishing

### Bug Fixes

**Grid Import Validation Errors:**
- Fixed `layoutGrids` validation error when importing grids with different alignments
- Solution: Conditional property structure per alignment:
  - **STRETCH**: `offset` only
  - **CENTER**: `sectionSize` only
  - **MIN/MAX**: `offset` required, `sectionSize` optional

**Effect Styles Import:**
- Removed `showShadowBehindNode` property from import (deprecated)

### Test Results (Material Design 3 Design Kit)

| Metric | Result |
|--------|--------|
| Collections | 4 created |
| Variables | 304 created |
| Styles | 582 created |

---

## [1.0.0] - 2025-12-15

### 🎉 Initial Release

- Variable export/import (COLOR, FLOAT, STRING, BOOLEAN)
- Color, Text, Effect, Grid style export/import
- Variable alias resolution
- Style-to-variable bindings preservation
- JSON copy/download functionality

---

**Last Updated:** 2026-06-10
