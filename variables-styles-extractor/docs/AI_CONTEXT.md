# AI Agent Context - Variables & Styles Extractor

> ⚠️ PROTECTED FILE - DO NOT DELETE
> This file must NEVER be deleted during cleanup or overhaul operations.
> Instead, rewrite its contents to reflect the new direction.

## Quick Reference

| Key | Value |
|-----|-------|
| **Plugin Name** | Variables & Styles Extractor |
| **Published Version** | 1.6.0 (Figma Community) |
| **Development Version** | 2.0.0 (Ready for Testing) |
| **Plugin Size** | 1200 × 628 pixels |
| **Package Manager** | pnpm |
| **License** | MIT |
| **Author** | Tushar Kant Naik |

---

## Workspace Context

This project is part of a **multi-project workspace**:

```
design-docs/                         ← Parent workspace root
├── AI_CONTEXT.md                    ← Workspace overview
├── bin/                             ← 🗑️ FAIL-SAFE: Deleted files go here
├── Portfolio/                       ← ❌ DO NOT TOUCH
│   ├── My Portfolio/                ← Portfolio website
│   └── Research Study/              ← Design system research
└── Side-Kicks/                      ← Parent folder (multi-project)
    ├── docs/                        ← Folder-level context
    └── variables-styles-extractor/  ← ✅ THIS PROJECT
```

### 🗑️ Bin Folder (Fail-Safe)

Before deleting any file, move it to `bin/` first:
```bash
mv file.md ../../../bin/
```

### ⚠️ SCOPE RESTRICTION

**ONLY work within:** `Side-Kicks/variables-styles-extractor/`  
**NEVER touch:** Any other folder in design-docs

Unless explicitly instructed by the user, all operations must be confined to this directory.

---

## 🎯 Plugin Overview

| Property | Value |
|----------|-------|
| **Purpose** | Export/import Figma variables & styles between files |
| **Figma Community** | Search "Variables & Styles Extractor" |
| **GitHub** | https://github.com/tknatwork/side-kicks |

### Key Features
- Variable collections (COLOR, FLOAT, STRING, BOOLEAN)
- Variable modes and aliases
- Color, Text, Effect, Grid styles
- **Full paint type support**: solid, gradients (linear, radial, angular, diamond), images, empty styles
- **Library dependency detection**: Warns when variables reference library collections
- **Hybrid library import**: Captures resolved values for library aliases; restores library links when possible
- **Pre-Import Library Detection**: Scans JSON for `$libraryRef` references, checks library availability
- **Font Detection & Validation**: Checks font availability before import
- **Import Behaviors**: Smart Merge, Clean Import, or Custom Merge (selective clearing)
- **Two-Pass Import**: Raw values imported first, then aliases (correct dependency order)
- **Selection-Aware Preview**: Review Changes updates based on selected collections/modes
- **Automatic Rollback**: Pre-import snapshots, auto-restore on import failure
- **Undo Import**: Manual undo button persists until clicked or new import starts
- Plan-based mode validation (Starter/Professional/Organization/Enterprise)
- No network access - fully local

### Performance Features (v2.0.0)
- **Web Worker JSON Parsing**: Heavy JSON (>500KB) parsed in separate thread
- **Tiered Processing**: <50KB sync, 50-500KB idle callback, >500KB Web Worker
- **Result Caching**: LRU cache (10 entries, 60s TTL) for parsed JSON
- **Throttled Validation**: 300ms throttle on backend messages
- **Async JSON Operations**: All JSON parse/stringify operations are async
- **CSS Performance**: contain, will-change, hardware acceleration, passive listeners
- **Skeleton Loaders**: Instant feedback while parsing large files

---

## 📁 PROJECT STRUCTURE

```
variables-styles-extractor/
├── README.md             # Public documentation (GitHub)
├── LICENSE               # MIT License
├── .cursorrules          # Cursor AI rules
├── .github/
│   ├── copilot-instructions.md  # GitHub Copilot rules (PROTECTED)
│   └── workflows/
│       ├── ci.yml        # CI pipeline
│       └── release.yml   # Release pipeline
├── docs/                 # All documentation (PROTECTED)
│   ├── AI_CONTEXT.md     # THIS FILE - Project context (PROTECTED)
│   ├── AGENTS.md         # Universal AI instructions (PROTECTED)
│   ├── CHANGELOG.md      # Project history (PROTECTED)
│   ├── CLAUDE.md         # Claude AI instructions
│   ├── CODING_STANDARDS.md  # JSF-AV standards (MANDATORY)
│   ├── GEMINI.md         # Gemini AI instructions
│   ├── KNOWN_ISSUES.md   # Public issue tracking (GitHub)
│   └── TASKS.md          # Task tracking (PROTECTED)
├── src/
│   └── code.ts           # Main plugin source (TypeScript) - ~2400 lines
├── code.js               # Compiled output (minified for prod, unminified for dev)
├── ui.html               # Plugin UI (single file) - ~5300 lines
├── manifest.json         # Figma plugin config
├── package.json          # Dependencies & scripts
├── pnpm-lock.yaml        # pnpm lockfile
├── tsconfig.json         # TypeScript config
└── releases/             # Version archives
    └── v1.6.0/           # Previous release files
```

---

## 🔧 DEVELOPMENT WORKFLOW

### Package Manager
**pnpm** (not npm) - Better security, faster, stricter dependency resolution.

### Building
```bash
cd Side-Kicks/variables-styles-extractor
pnpm install
pnpm build          # Compiles + minifies (production)
pnpm build:dev      # Compiles only, no minification (debugging)
```

### Build Scripts
| Command | Description |
|---------|-------------|
| `pnpm build` | TypeScript + Terser minification |
| `pnpm build:dev` | TypeScript only (unminified for debugging) |

### Loading in Figma
1. Figma Desktop → Plugins → Development → Import plugin from manifest
2. Select `manifest.json`

---

## 🏗️ ARCHITECTURE

### File Responsibilities

| File | Purpose | Lines |
|------|---------|-------|
| `src/code.ts` | Main plugin logic, Figma API calls | ~3600 |
| `code.js` | Compiled output | varies |
| `ui.html` | Plugin UI (HTML/CSS/JS in single file) | ~8800 |
| `manifest.json` | Plugin metadata, permissions | ~20 |

### UI Layout (v2.0.0) - 1200×628px 4-Column Grid

#### Export Tab Layout
| Column 1 (Selection) | Column 2 (Status Check) | Column 3 (Preview) | Column 4 (Activity) |
|---------------------|------------------------|-------------------|---------------------|
| Collections list | Image warning banner | Stats summary (Order tab) | Activity log |
| Styles checkboxes | Library warning banner | Structure tree (Tree tab) | Copy/Clear buttons |
| Select All/None | Plan compatibility banner | Stats total header | JSON preview section |
| Refresh button | Font requirements banner | Export button footer | Copy/Download buttons |
| Include images option | Bindings info banner | | |

#### Import Tab Layout
| Column 1 (Input) | Column 2 (Status Check) | Column 3 (Preview) | Column 4 (Activity) |
|-----------------|------------------------|-------------------|---------------------|
| Load JSON section | Plan selection banner | Stats summary (Order tab) | Activity log |
| Paste/Upload buttons | Detected plan display | Structure tree (Tree tab) | Copy/Clear buttons |
| File loaded indicator | Validation results | Stats total header | Import results section |
| Import Options section | Library status card | Import button footer | |
| Clear Before Import | Font status card | Library link option | |
| | Compatibility banner | | |
| | External deps warning | | |

### Column Features
- **Scroll Fade Effects**: All scrollable columns have fade gradients at top/bottom
- **Custom Scrollbars**: Neo-brutalist styled scrollbars with 10px width, #888 thumb
- **Column-with-scroll-fade class**: Enables scroll fade on columns
- **Persistent Footers**: Export/Import buttons stay visible outside scrollable content

### Communication Flow
```
ui.html (postMessage) ←→ code.ts (figma.ui.onmessage)

Export Flow:
  UI: export request → Backend: process collections/styles → UI: export_complete

Import Flow:
  UI: validate_import → Backend: validateImportAgainstPlan() → UI: validation_result
  UI: check_libraries → Backend: checkLibraryAvailability() → UI: library_check_result
  UI: check_fonts → Backend: checkFontAvailability() → UI: font_check_result
  UI: import → Backend: importVariables() → UI: import_complete
```

---

## 📋 KEY INTERFACES (src/code.ts)

### Export Interfaces

```typescript
// Paint types for color styles
interface ExportSolidPaint {
  type: 'SOLID';
  color: string;      // 8-digit hex: #RRGGBBAA
  opacity?: number;
  visible?: boolean;
  blendMode?: BlendMode;
  variableId?: string;
}

interface ExportGradientPaint {
  type: 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND';
  gradientStops: ExportGradientStop[];
  gradientTransform?: Transform;
  opacity?: number;
  visible?: boolean;
  blendMode?: BlendMode;
}

interface ExportImagePaint {
  type: 'IMAGE';
  scaleMode: 'FILL' | 'FIT' | 'CROP' | 'TILE';
  imageHash?: string;
  imageData?: string;  // Base64 encoded (only when includeImages=true)
  filters?: ImageFilters;
  opacity?: number;
  visible?: boolean;
  blendMode?: BlendMode;
}

type ExportPaintData = ExportSolidPaint | ExportGradientPaint | ExportImagePaint;

interface ExportColorStyle {
  name: string;
  paints: ExportPaintData[];  // Array of all paints in the style
  description?: string;
}
```

### Import/Validation Interfaces

```typescript
interface ImportOptions {
  merge: boolean;           // Merge with existing collections
  overwrite: boolean;       // Overwrite existing variables
  importStyles?: boolean;   // Include styles in import
  useLibraryRefs?: boolean; // Try to restore library references
  clearFirst?: boolean;     // Clean Import: clear all before import
  customMerge?: {           // Custom Merge: selective clearing
    clearVariables: boolean;
    clearStyles: boolean;
  } | null;
  collectionBehaviors?: Record<string, 'merge' | 'replace'> | null;
}

interface PlanValidation {
  canImport: boolean;
  plan: FigmaPlan;
  warnings: string[];
  errors: string[];
  collectionStats: CollectionValidation[];
  // Library & font dependency detection
  libraryDependencies?: {
    variableCount: number;
    collections: string[];
  };
  fontDependencies?: {
    styleCount: number;
    fonts: Array<{ family: string; style: string }>;
  };
}
```

---

## 📋 MESSAGE HANDLERS (src/code.ts)

| Message Type | Handler | Response |
|-------------|---------|----------|
| `export` | exportVariables() | `export_complete` |
| `import` | importVariables() | `import_complete` |
| `validate_import` | validateImportAgainstPlan() | `validation_result` |
| `detect_plan` | detectCurrentPlan() | `plan_detected` |
| `check_libraries` | checkLibraryAvailability() | `library_check_result` |
| `check_fonts` | checkFontAvailability() | `font_check_result` |
| `create_undo_snapshot` | createUndoSnapshot() | `snapshot_created` / `snapshot_error` |
| `restore_snapshot` | restoreFromSnapshot() | `undo_complete` / `undo_error` |
| `compute_import_diff` | computeImportDiff() | `import_diff_result` |
| `clear_variables` | clearVariables() | - |
| `clear_styles` | clearStyles() | - |
| `clear_all` | clearAll() | - |
| `get_collections` | getCollections() | `collections` |
| `get_variables` | getVariablesForCollection() | `variables` |
| `close` | figma.closePlugin() | - |

### Import Safety Messages
| Message Type | Purpose |
|-------------|---------|
| `import_rolling_back` | Import failed, automatic rollback in progress |
| `import_rollback_complete` | File restored to pre-import state |
| `import_rollback_failed` | Rollback failed, manual Cmd+Z needed |

---

## 📋 FIGMA API USAGE

### Variables
- `figma.variables.getLocalVariableCollectionsAsync()`
- `figma.variables.getLocalVariablesAsync()`
- `figma.variables.createVariableCollection()`
- `figma.variables.createVariable()`
- `figma.variables.importVariableByKeyAsync()` - Import library variables

### Styles
- `figma.getLocalPaintStylesAsync()`
- `figma.getLocalTextStylesAsync()`
- `figma.getLocalEffectStylesAsync()`
- `figma.getLocalGridStylesAsync()`
- `figma.createPaintStyle()` / `createTextStyle()` / etc.

### Fonts
- `figma.loadFontAsync({ family, style })` - Check font availability

### Images
- `figma.getImageByHash(hash)` - Get image bytes for export
- `figma.createImage(bytes)` - Create image from base64 for import

---

## ⚠️ KNOWN CONSTRAINTS

### Figma Plugin Sandbox
- **ES2017 Target**: Figma's QuickJS VM doesn't support ES2018+ features
- **No spread operators**: `{...obj}` causes errors → Use `Object.assign()`
- **No generators**: Can cause "stack underflow" errors

### CSS Limitations in Plugin Iframe (BP-001)
| ❌ Forbidden | ✅ Allowed |
|-------------|-----------|
| `contain: strict` | `contain: layout style` |
| `content-visibility: auto` | (remove entirely) |
| `backdrop-filter` | `transform: translateZ(0)` |

### Plan Mode Limits
| Plan | Max Modes |
|------|-----------|
| Starter | 1 |
| Professional | 10 |
| Organization | 20 |
| Enterprise | Unlimited |

---

## Protected Files

These files must NEVER be deleted, only rewritten during major overhauls:

| File | Purpose |
|------|---------|
| `docs/AI_CONTEXT.md` | This file - project context |
| `docs/CHANGELOG.md` | Project history |
| `docs/TASKS.md` | Task tracking & backlog |
| `docs/AGENTS.md` | Universal AI agent instructions |
| `.github/copilot-instructions.md` | GitHub Copilot instructions |

---

## 📊 Test Data

### Material Design 3 Design Kit
- **File Key:** `Yq5OWQOgRviZr5HnBSeTK5`
- **Collections:** 4
- **Variables:** 304
- **Styles:** 582

---

*Last updated: 2026-01-16 - v2.0.0 ready for testing: Web Worker JSON parsing, result caching, throttled validation, automatic rollback, undo import*
