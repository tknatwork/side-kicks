<!-- === SYSTEM PAIRING ===
Consumed by: AI sessions at first boot in this plugin folder
Updated by: manual
Pairs with: AGENTS.md, .gcc/session-memory.md (REAL PATH: lives at the repo-root
            main checkout — Side-Kicks/variables-styles-extractor/.gcc/ — untracked,
            NOT inside this plugin subfolder and NOT present in worktrees),
            package.json build scripts
Update trigger: build process or boot prerequisite change
Last verified: 2026-06-10
Index: AGENTS.md
=== END PAIRING === -->

# START_HERE.md — Variables & Styles Extractor

> Boot check for any AI session opening this Figma plugin folder.
> Run the 60-second checklist, internalise the constraints, then work.

---

## 1. 60-second boot checklist

1. **Read [`AGENTS.md`](AGENTS.md)** — canonical AI-builder rules: architecture, conventions, protocol, file-protection rules.
2. **Read `.gcc/session-memory.md`** — warm-start state from the prior session.
   **Real path:** `Side-Kicks/variables-styles-extractor/.gcc/session-memory.md` at the **repo-root main checkout** (the `.gcc/` folder is untracked — it is NOT inside this plugin subfolder and does NOT exist in git worktrees; reach over to the main checkout to read it).
3. **If you will write code:** read [`docs/CODING_STANDARDS.md`](docs/CODING_STANDARDS.md) before touching `src/code.ts` or `ui.html`.

---

## 2. Hard constraints recap

| Surface | Constraint |
|---------|-----------|
| `src/code.ts` (QuickJS VM) | **No spread (`{...obj}`), no generators, no optional chaining (`?.`) in NEW code.** Use `Object.assign({}, obj)`, plain loops, and `if (obj && obj.prop)`. Pre-existing violations in old code are history; any NEW one is a regression. |
| `ui.html` CSS | **No `contain: strict`, no `content-visibility: auto`** — both break rendering in the Figma iframe sandbox. Use `contain: layout style`. |
| Artifacts | **Single-file artifacts.** `ui.html` is one self-contained file (all CSS + JS inline); `code.js` is one compiled file. No bundlers, no external assets. |
| Network | **`networkAccess: ["none"]` in `manifest.json`** — the iframe cannot load ANY external resource. No CDN scripts, no Google Fonts `<link>`, no remote images in `ui.html`. Everything ships inline. |

---

## 3. Build & test commands

```bash
pnpm install --frozen-lockfile   # deps (pnpm only — never npm/npx)
pnpm build:dev                   # tsc only → readable code.js (debugging)
pnpm build                       # tsc + terser → minified production code.js
```

**Commit `code.js` with `src/code.ts` changes — no CI builds it.** The compiled file ships from this repo.

### Figma Desktop hot-reload (manual test loop)

1. Figma Desktop → **Plugins → Development → Import plugin from manifest…** → pick this folder's `manifest.json` (first time only).
2. After each `pnpm build:dev`: **Plugins → Development → Hot reload** (or close/reopen the plugin).
3. Test in a real file. Once working, run `pnpm build` and commit the minified `code.js`.

---

## 4. Architecture one-pager

**Three source files:**

| File | Runtime | Role |
|------|---------|------|
| `src/code.ts` | Figma QuickJS VM (ES2017) | Backend — all Figma API access, export/import/clear/undo logic |
| `ui.html` | Browser iframe | Frontend — single-file UI, Simple + Advanced modes |
| `manifest.json` | Figma | Plugin config (`networkAccess: ["none"]`) |

`code.js` is the compiled backend output — checked in, never hand-edited.

**Two UI modes:** **Simple** (3-section Export/Import tabs driven by name-prefix groups; `selectedExportGroups`/`selectedImportGroups` Maps are the source of truth, collection-level Sets are projections) and **Advanced** (full collection/mode-level control — kept pixel-identical; Simple-mode work must not touch it).

**Message protocol (current):**

- **UI → backend:** `cancel_operation`, `resize_ui` (window follows mode: Simple 905×628 / Advanced 1200×628), `export` (with `selectedGroups` / `selectedStyleGroups` / `exportFormat` incl. `tokens-studio`), `import`, `validate_import`, `compute_import_diff`, `detect_plan`, `clear_variables` / `clear_styles` / `clear_all`, `get_collections`, `check_libraries`, `check_fonts`, `undo_import`
- **Backend → UI:** `log`, `collections` (with `groups` + `styleGroups`), `operation_progress`, `export_chunk`, `export_done`, `import_complete` (carries the undo snapshot), `import_rolling_back` / `import_rollback_complete` / `import_rollback_failed`, `validation_result`, `import_diff_result`, `plan_detected`, `clear_complete`, `library_check_result`, `font_check_result`, `undo_complete` / `undo_error`, `operation_cancelled`, `operation_denied`, `error`
- **Removed (2026-06 overhaul — do not reintroduce):** `export_complete`, `get_variables`/`variables`, `collection_details`, `close`, `create_undo_snapshot`/`snapshot_created`/`snapshot_error`

**Heavy-load model:** `BATCH` config + `runBatched` / `runBatchedAsync` / `runSequentialAsync` (QuickJS-safe, no generators) yield between batches; `operation_progress` is throttled (≥250ms) and renders in `[data-progress-host]` components in both modes with a Cancel button; cancellation is cooperative (sentinel-property errors, `cancel_operation` handled first in dispatch); a single **operation lock** rejects concurrent ops with `operation_denied`; exports stream as 256KB `export_chunk` messages (surrogate-safe) finished by `export_done`.

**Export formats:** `figma` (default) | `w3c` | `tokens-studio` (additive third format: shape-A single file with Tokens Studio sets/$themes/$metadata, DTCG keys, `{dot.path}` aliases).

---

## 5. Danger zones

- **Snapshot / rollback invariants:** `restoreFromSnapshot` **validates the snapshot BEFORE clearing anything** (never wipe-first — that was a real bug). Rollback is **non-cancellable** once started. The undo snapshot rides inside `import_complete`; the UI never pre-creates snapshots. `figma.commitUndo()` brackets imports and standalone clears so native Cmd+Z stays atomic.
- **Additive-format guarantee:** export formats are strictly additive — adding/changing `tokens-studio` (or any new format) must never alter the `figma` or `w3c` output shapes. Existing exported files must keep importing cleanly.
- **Advanced-untouched rule:** any Simple-mode work must leave Advanced mode pixel-identical and behaviorally unchanged. Advanced mutators write through to the Simple-mode group Maps — keep that direction intact.

---

*Last verified: 2026-06-10*
