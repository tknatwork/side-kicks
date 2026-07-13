# AI Operating Guide

Directives for AI sessions driving figma-limitless-mcp. Follow the order —
most Figma failures are ordering failures.

## Session start — always

1. `get_workspace_status` — connected files, locks, checkpoints, journal position.
2. `load_checkpoint` (no name = list) — resume ledgers from previous sessions.
3. `get_journal` — if resuming, see exactly what was already done.
4. `get_file_digest` — token-lean file map. Cached (~1ms) when nothing changed.
5. Never start with `get_document`. It serializes an entire page.

## Built-in guardrails

| Guardrail | Behavior | Your move |
|---|---|---|
| Heavy-read cap | `get_document` / `get_node` / `get_selection` / `get_design_context` error if the response exceeds ~1.5MB | Use `get_file_digest`, lower `depth`, or target a smaller subtree |
| Write serialization | Mutations (incl. `execute_code`) run one-at-a-time in the plugin; reads run in parallel | Send reads freely; don't parallelize writes — they queue anyway |
| Request timeout | Default 30s; `execute_code` accepts `timeoutMs` up to 300s | On timeout: the op may still have landed — READ before retrying |
| Dev Mode | All write tools rejected with a clear error | Switch Figma to the design editor |
| Delete gate | `delete_nodes` requires `confirm: true` | Confirm deliberately, never by default |
| Result cap | `execute_code` returns ≤1MB JSON | Return narrow slices, never nodes |
| Multi-file | With 2+ files connected every call needs `fileKey` | `list_files` first, thread `fileKey` through |
| Journal | Every mutation is logged with your agent identity | `get_journal` is the source of truth after any failure |

## Fonts

- Get exact `{family, style}` strings from `list_fonts`. Never guess — 'Semibold', 'Semi Bold', 'SemiBold' are three different real values.
- Local/brand fonts installed on the machine are visible here (the remote MCP can't see them).
- Fonts load automatically before any text mutation in the dedicated tools. In `execute_code`, load them yourself first.
- `lineHeight` / `letterSpacing` are `{unit, value}` objects. Bare numbers are rejected.

## Tokens and styles — reference hierarchy

1. Variable binding (`write_variables` → `bind_to_node`) — first choice.
2. Style (`apply_style`, `apply_text_style`) — when no variable fits.
3. Raw value (`set_solid_fill`, …) — one-offs only.

- Never hardcode a value that has a token. Variables before components.
- Author tokens in ONE `write_variables` call: later actions reference earlier results with `$N.field` (e.g. `collectionId: "$0.collectionId"`).
- Read tokens with `get_variables_deep` — all modes, aliases resolved to names.

## Components

Build order:
1. Base frame with auto-layout + variable bindings. Get it right once.
2. Name state frames `Prop=Value` (`State=Default`, `State=Hover`).
3. `create_component_from_node` on each.
4. `combine_as_variants` — the set is auto-arranged and resized.
5. `add_component_property` (TEXT / BOOLEAN / INSTANCE_SWAP). Use the returned `#`-suffixed key verbatim.
6. Icons: one INSTANCE_SWAP property + `preferredValues`. Never a variant per icon.
7. Slots: `create_slot` — its SLOT property is created automatically (key returned). Don't add a second one.
8. Cap variant matrices at ~30 combinations.

## Screens

1. Create the wrapper frame FIRST, auto-layout on.
2. Discover before building: `get_file_digest` → `get_code_mappings` → `list_library_variables`.
3. `instantiate_component` does import + place + properties + text overrides in one call.
4. Bind variables, not hex.
5. Validate cheap (`get_file_digest`, `get_node`) every few writes; `get_screenshot` only at visual milestones.

## Prototypes

1. Build all screens first. Name layers identically across screens — SMART_ANIMATE matches by name.
2. Wire: `set_reactions` — `{trigger: {type:'ON_CLICK'}, actions: [{type:'NODE', destinationId, navigation:'NAVIGATE', transition: {type:'SMART_ANIMATE', easing:{type:'EASE_OUT'}, duration: 0.3}}]}`.
3. Overlays: navigation `'OVERLAY'`; close with `{type:'CLOSE'}`; back with `{type:'BACK'}`.
4. Entry points: `set_flow_starting_point` per flow.
5. Verify: `get_reactions`.
6. Motion (beta): `get_motion` → `apply_animation_style`. Errors cleanly on older Figma builds.

## Heavy files — context discipline

- Orient with `get_file_digest`, drill with `get_node` on specific ids. Never bulk-read.
- `get_variables_deep`: filter by `collectionName` on large token libraries (unfiltered dumps over 4000 variables are refused).
- `get_file_digest` `scope: "all-pages"` is slow the first time — use only when you need the full component inventory.
- Fine detail you discovered (node ids, property keys, exact font strings) goes into `save_checkpoint` — never re-discover what a ledger already holds.

## Bulk operations (hundreds/thousands of nodes)

For large reads and writes, keep the payload out of your context:

1. **Read once, to disk.** A big `execute_code` return (e.g. a whole variable graph) exceeds the result cap and is saved to a file automatically — process it there with shell/jq, don't parse it in context.
2. **Write via `execute_code`, not per-node tool calls.** One script creating N nodes beats N round-trips. Build a name→id map inside the script and resolve cross-references (aliases, style bindings) by name. Yield to the UI (`await new Promise(r=>setTimeout(r,0))`) every ~25 items.
3. **Copy between files** (source → dest): read the source (its own `fileKey`), transform, then run a generated `execute_code` against the dest `fileKey`. A plugin instance is scoped to one file — you cannot read source and write dest in the same script.
4. **Order by dependency.** Create primitive collections before the semantic collections that alias them; create variables before the styles/components that bind them.
5. Checkpoint after each phase so a failure resumes mid-copy, not from scratch.

## execute_code under dynamic-page

The plugin runs with `documentAccess: "dynamic-page"`. Inside `execute_code`, use the **Async** API variants — the sync ones throw:

- `figma.getNodeByIdAsync(id)`, not `getNodeById`
- `node.setFillStyleIdAsync / setStrokeStyleIdAsync / setEffectStyleIdAsync / setGridStyleIdAsync / setTextStyleIdAsync`, not the `*StyleId =` setters
- `figma.setCurrentPageAsync(page)` and `page.loadAsync()` / `figma.loadAllPagesAsync()` before touching off-page nodes

(The dedicated tools already do this — the rule is only for hand-written `execute_code`.)

The sharedPluginData namespace `figmaLimitlessMcp` is RESERVED — it stores the
document's persisted file identity (`fileKey`). Never write to or clear it in
`execute_code`; wiping it re-buckets the file's journal and checkpoints on the
next run.

## Multi-agent and resume

- `acquire_lock` on what you mutate (`styles:text`, `page:<id>`). Locks expire on TTL — a dead agent never wedges the workspace.
- `save_checkpoint` after every milestone: completed steps, id maps, next action.
- Keep mutation bursts ≤ ~10 logical ops, then validate.
- After a timeout: `get_journal`, then read the target. Never blind-retry a mutation.

## Design → code

- Before writing code for a component: `get_code_mappings`. If a mapping exists, use it.
- After implementing a component: `set_code_mapping` (target, source path, snippet) so the next session reuses it.

## Error playbook

| Error | Meaning | Action |
|---|---|---|
| "No plugin connected" | Plugin not running in Figma | Ask the user to run Plugins → Development → Figma Limitless MCP |
| "Multiple files connected…" | Ambiguous target | `list_files`, pass `fileKey` |
| "Cannot write to node with unloaded font" | Font not loaded (execute_code path) | `load_fonts` with exact strings first |
| "…requires the design editor (Dev Mode is read-only)" | Figma is in Dev Mode | Ask the user to switch modes |
| "Response too large" | Heavy-read cap hit | Narrow the read (depth, subtree, digest) |
| "Request timed out… may still be executing" | Slow op | Read state before retrying; use `timeoutMs` for long `execute_code` |
| "acquired: false" | Another agent holds the lock | Work elsewhere or wait for TTL expiry |
| "Motion/Shader API unavailable" | Figma build predates the beta | Skip those tools; everything else works |
