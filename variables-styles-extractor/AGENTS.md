<!-- === SYSTEM PAIRING ===
Consumed by: All AI builders (Claude Code, Cursor, Copilot, Aider, Continue, Gemini CLI, Codex)
Updated by: manual, on architectural or convention changes
Pairs with: CLAUDE.md (pointer), docs/AI_CONTEXT.md (legacy context, protected),
            docs/CODING_STANDARDS.md, docs/FIGMA_PLUGIN_DEVELOPMENT.md
Update trigger: change to plugin architecture, Figma constraints discovered, message protocol added
Last verified: 2026-06-10 (message protocol overhaul absorbed; START_HERE.md boot doc added)
Index: docs/AI_CONTEXT.md
=== END PAIRING === -->

# AGENTS.md — Variables & Styles Extractor

> Canonical AI-builder rules for the Figma plugin in this folder.
> All builder LLMs read this file. [AGENTS.md is the Sourcegraph universal convention](https://agents.md).

**Project:** Variables & Styles Extractor (Figma Plugin)
**Repository:** [`tknatwork/side-kicks`](https://github.com/tknatwork/side-kicks) (this folder)
**Figma Community:** [1584331992332668732](https://www.figma.com/community/plugin/1584331992332668732/variables-and-styles-extractor)
**Published version:** 2.0.0 (17 January 2026)
**License:** MIT (source) + Figma Community Free Resource License (distribution) — see [LICENSE](LICENSE) and [README](README.md#license)

---

## Quick start for AI agents

### Step 1: Read in this order
0. **[`START_HERE.md`](START_HERE.md)** — 60-second boot check (constraints recap, build commands, danger zones).
1. **This file** (`AGENTS.md`) — plugin architecture + constraints + conventions.
2. **`.gcc/session-memory.md`** — warm-start state from the last session.
3. **[`docs/CODING_STANDARDS.md`](docs/CODING_STANDARDS.md)** — mandatory coding rules for this plugin.
4. **[`docs/FIGMA_PLUGIN_DEVELOPMENT.md`](docs/FIGMA_PLUGIN_DEVELOPMENT.md)** — Figma sandbox constraints and patterns.
5. **[`docs/AI_CONTEXT.md`](docs/AI_CONTEXT.md)** — legacy project context (protected, kept for tooling).

### Step 2: Understand what you can break

This is a **Figma plugin** with two runtimes glued by `postMessage`.

| Component | File | Runtime |
|-----------|------|---------|
| Backend | `src/code.ts` | Figma's QuickJS VM (ES2017 only, no spread, no generators) |
| Frontend | `ui.html` | Browser iframe (standard web) |
| Config | `manifest.json` | Figma plugin manifest |
| Output | `code.js` | Compiled JavaScript (checked in — NOT auto-built in CI) |

### Step 3: Internalise the hard constraints

```typescript
// ❌ WILL CRASH in Figma's QuickJS VM — NEVER use in code.ts
{ ...obj }                    // Spread operators
function* gen() { yield 1; }  // Generators
obj?.prop                     // Optional chaining (may fail on older Figma)

// ✅ SAFE alternatives
Object.assign({}, obj)        // Instead of spread
if (obj && obj.prop)          // Instead of optional chaining
```

```css
/* ❌ BREAKS in Figma iframe sandbox — NEVER use in ui.html */
contain: strict;
content-visibility: auto;

/* ✅ SAFE alternatives */
contain: layout style;
will-change: transform;
```

These rules are enforced by review (no CI gate in this workspace). The
plugin currently has known violations in `ui.html` from earlier history;
treat any NEW violation as a regression and fix it inline.

---

## Workspace scope restriction

- ✅ Allowed: `Side-Kicks/variables-styles-extractor/**`
- ❌ Forbidden without explicit user approval: other project folders, root-level workspace files (other than security/CI/docs cross-cutting changes you were asked for)

---

## Project structure

```
variables-styles-extractor/
├── START_HERE.md         ← Boot check (read first — constraints recap, build commands, danger zones)
├── AGENTS.md             ← This file (canonical AI rules)
├── CLAUDE.md             ← Pointer to AGENTS.md (legacy Claude Code path)
├── README.md             ← Public-facing
├── LICENSE               ← MIT + CFRL note
├── manifest.json         ← Figma plugin manifest
├── package.json          ← Build scripts (pnpm)
├── tsconfig.json
├── code.js               ← Compiled output (CHECKED IN — DO NOT EDIT)
├── ui.html               ← UI source (~8800 lines — EDIT THIS)
├── src/
│   └── code.ts           ← Backend source (~3600 lines — EDIT THIS)
├── .gcc/                 ← Session memory + commit log + metadata
│   ├── session-memory.md
│   ├── commit.md
│   ├── metadata.yaml
│   ├── main.md
│   ├── memory.md
│   └── changelog.md
├── .github/
│   └── copilot-instructions.md  ← Project-specific Copilot rules (protected)
└── docs/
    ├── AI_CONTEXT.md          ← Legacy context (protected, kept for tooling)
    ├── AGENTS.md              ← Redirect to ../AGENTS.md
    ├── CLAUDE.md              ← Redirect to ../CLAUDE.md
    ├── CHANGELOG.md           ← Version history (protected)
    ├── CODING_STANDARDS.md    ← Mandatory rules
    ├── FIGMA_PLUGIN_DEVELOPMENT.md  ← Figma-specific guide
    ├── GEMINI.md              ← Gemini-specific notes
    ├── JSON_FORMAT.md         ← Import/export JSON schema
    ├── KNOWN_ISSUES.md
    └── TASKS.md
```

---

## Build commands

```bash
cd Side-Kicks/variables-styles-extractor
pnpm install              # Frozen lockfile recommended: pnpm install --frozen-lockfile
pnpm build                # Production: tsc + terser minification
pnpm build:dev            # Debug: tsc only (readable code.js)
pnpm watch                # tsc --watch
```

### After code changes
1. Run `pnpm build:dev` for debugging.
2. In Figma Desktop: Plugins → Development → Hot reload (the plugin manifest is imported from this folder).
3. Test the change.
4. Once working, run `pnpm build` for the minified production `code.js`.
5. **Commit `code.js`** — it ships from this repo, there is no CI building it.

---

## Communication flow (UI ↔ Backend)

```
ui.html ─────postMessage─────► code.ts (Figma VM)
   │                              │
   │◄────figma.ui.postMessage─────┘

Export:    UI sends 'export'           → code.ts processes → 'export_chunk' × N → 'export_done'
Import:    UI sends 'validate_import'  → code.ts validates → 'validation_result'
           UI sends 'import'           → code.ts imports   → 'import_complete' (carries undo snapshot)
Progress:  long ops stream 'operation_progress' (throttled ≥250ms); UI may send 'cancel_operation'
```

| UI → Backend | Backend → UI |
|--------------|--------------|
| `export` (with `selectedGroups` / `selectedStyleGroups` / `exportFormat` incl. `tokens-studio`) | `export_chunk` (256KB chunks) / `export_done` |
| `import` | `import_complete` (carries undo snapshot) / `import_rolling_back` / `import_rollback_complete` / `import_rollback_failed` |
| `validate_import` | `validation_result` |
| `compute_import_diff` | `import_diff_result` |
| `detect_plan` | `plan_detected` |
| `clear_variables` / `clear_styles` / `clear_all` | `clear_complete` |
| `get_collections` | `collections` (with `groups` + `styleGroups`) |
| `check_libraries` | `library_check_result` |
| `check_fonts` | `font_check_result` |
| `undo_import` | `undo_complete` / `undo_error` |
| `cancel_operation` | `operation_cancelled` |
| `resize_ui` (`mode: 'simple' \| 'advanced'`) | — (window resizes: Simple 905×628, Advanced 1200×628) |
| — (any op while another runs) | `operation_denied` |
| — (anytime) | `log`, `operation_progress`, `error` |

> **History:** the 2026-06 protocol overhaul REMOVED `export_complete`, `get_variables`/`variables`, `collection_details`, `close`, and `create_undo_snapshot`/`snapshot_created`/`snapshot_error` — do not reintroduce them.

---

## Key interfaces (`code.ts`)

```typescript
// Color style with all paint types
interface ExportColorStyle {
  name: string;
  paints: ExportPaintData[];  // SOLID, GRADIENT_*, IMAGE
  description?: string;
}

// Variable value
interface ExportVariableValue {
  $type: 'color' | 'float' | 'string' | 'boolean';
  $value: string | number | boolean;
  $description?: string;
  $scopes?: string[];
  $libraryRef?: { ... };  // For library-linked variables
}

// Pre-import validation report
interface PlanValidation {
  canImport: boolean;
  plan: FigmaPlan;
  warnings: string[];
  errors: string[];
  libraryDependencies?: { variableCount: number; collections: string[] };
  fontDependencies?:    { styleCount: number; fonts: Array<{ family: string; style: string }> };
}
```

**Export options (2026-06):** the `export` message now carries `selectedGroups` and
`selectedStyleGroups` (name-prefix group filters — absent key = export all) and
`exportFormat: 'figma' | 'w3c' | 'tokens-studio'` (the Tokens Studio format is
additive — it must never change the `figma`/`w3c` output shapes).

**Heavy-load utilities (2026-06):** `code.ts` ships a `BATCH` config with
`runBatched` / `runBatchedAsync` / `runSequentialAsync` (QuickJS-safe, no
generators) that yield between batches, plus throttled `operation_progress`
emission, cooperative cancellation, and a single operation lock
(`operation_denied` on concurrent ops). Route any new loop over many
variables/styles through these — never block the VM with a raw loop.

---

## Code-change checklist

- [ ] No spread operators `{...obj}` in `code.ts`
- [ ] No generators in `code.ts`
- [ ] No `contain: strict` or `content-visibility: auto` in CSS
- [ ] All Figma APIs use the async (`*Async()`) versions
- [ ] DOM elements have null checks before `addEventListener`
- [ ] Error handling with `try`/`catch` around any Figma API call that can reject
- [ ] `pnpm build:dev` succeeds (TypeScript clean)
- [ ] `pnpm build` succeeds and `code.js` is minified
- [ ] `code.js` is committed alongside `src/code.ts` changes (no CI builds it)
- [ ] [`docs/CHANGELOG.md`](docs/CHANGELOG.md) updated for significant changes
- [ ] [`.gcc/session-memory.md`](.gcc/session-memory.md) updated with what changed + next step

---

## Common issues

### Elements render but are invisible
**Cause:** CSS `contain: strict` or `content-visibility: auto`
**Fix:** `contain: layout style`

### "Cannot read property of null" in UI
**Cause:** Event listener attached before element exists
**Fix:** Wrap in `DOMContentLoaded` or null-check the element first

### Plugin crashes with "stack underflow"
**Cause:** Generator functions or spread operators in `code.ts`
**Fix:** `Object.assign()` instead of spread; rewrite generators as plain loops

### Color styles show count 0
**Cause:** Only SOLID paints exported
**Fix:** Handle all paint types: SOLID, GRADIENT_*, IMAGE

### Fonts not importing
**Cause:** Font not available in destination file
**Fix:** Check availability with `figma.loadFontAsync()` first; report missing fonts in `PlanValidation.fontDependencies` instead of failing silently

---

## File-protection rules (project-scoped)

Never delete — rewrite if the content becomes wrong:

| Path | What it captures |
|------|------------------|
| `AGENTS.md` (this file) | Canonical AI rules |
| `CLAUDE.md` | Pointer for legacy Claude Code path |
| `LICENSE` | MIT + CFRL notice |
| `docs/AI_CONTEXT.md` | Legacy context (protected) |
| `docs/AGENTS.md` | Redirect (kept for tooling) |
| `docs/CLAUDE.md` | Redirect (kept for tooling) |
| `docs/CHANGELOG.md` | Version history (protected) |
| `docs/TASKS.md` | Task tracking |
| `.github/copilot-instructions.md` | Copilot rules |
| `.gcc/*` | Session memory + build log + metadata |

---

## How to report a bug or vulnerability

| Kind | Channel |
|------|---------|
| Plugin bug (user-visible) | [GitHub Issues — bug report template](https://github.com/tknatwork/side-kicks/issues/new?template=bug_report.md) |
| Feature request | [GitHub Issues — feature request template](https://github.com/tknatwork/side-kicks/issues/new?template=feature_request.md) |
| Security vulnerability | **Do not open a public issue.** Use [GitHub Private Vulnerability Reporting](https://github.com/tknatwork/side-kicks/security/advisories/new) or email `hi@tusharkantnaik.com`. See [`/.github/SECURITY.md`](../.github/SECURITY.md). |

---

## Documentation index

| File | Purpose | When to read |
|------|---------|--------------|
| `AGENTS.md` (this file) | Canonical AI rules | Every session |
| `CLAUDE.md` | Pointer | Auto-loaded by legacy paths |
| `docs/AI_CONTEXT.md` | Legacy context (protected) | First time on project |
| `docs/CODING_STANDARDS.md` | Mandatory rules | Before every coding session |
| `docs/FIGMA_PLUGIN_DEVELOPMENT.md` | Figma sandbox guide | Before writing code touching Figma APIs |
| `docs/CHANGELOG.md` | Version history | Understanding prior changes |
| `docs/TASKS.md` | Current + pending tasks | Picking up work |
| `docs/JSON_FORMAT.md` | Import/export JSON schema | When touching the JSON path |
| `docs/KNOWN_ISSUES.md` | Known bugs | Triage |
| `docs/GEMINI.md` | Gemini-specific notes | If using Gemini CLI |

---

*Last updated: 2026-06-10 (message protocol replaced with the 2026-06 overhaul version — chunked export, progress/cancel, snapshot-in-import_complete; new export options + heavy-load utilities documented; START_HERE.md added as read-order item 0)*
