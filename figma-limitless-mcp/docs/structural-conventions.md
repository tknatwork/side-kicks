# Structural conventions — how Figma work should be ordered

> Terse operating rules for AI sessions driving figma-limitless-mcp, distilled
> from the official skill packs (figma-use, figma-generate-design,
> figma-generate-library) and the Plugin API's own constraints. Follow the
> ORDER; most Figma failures are ordering failures.

## 1. Session start (any task)

`get_workspace_status` → `load_checkpoint` (list) → `get_journal` if resuming →
`get_file_digest` for orientation. Never `get_document` first — it serializes
the whole page.

## 2. Token / style hierarchy (what to reference when styling)

Prefer, in order: **variable binding** (`write_variables` bind_to_node) →
**style** (`apply_style` / `apply_text_style`) → raw value (set_solid_fill
etc.) only for one-offs. Never hardcode a value that has a token. Variables
BEFORE components — no token = no component.

## 3. Component build order (master components)

1. Build the base frame with auto-layout + variable bindings; get it right once.
2. Name state frames `Prop=Value` (`State=Default`, `State=Hover`) — names become variant properties.
3. `create_component_from_node` each frame.
4. `combine_as_variants` (variants stack at 0,0 — the tool auto-arranges).
5. `add_component_property` for TEXT / BOOLEAN / INSTANCE_SWAP / SLOT. Use the returned `#`-suffixed key verbatim afterwards.
6. INSTANCE_SWAP + preferredValues for icon systems — never a variant per icon (variant explosion).
7. Slots: `create_slot` — the SLOT component property is created automatically (the tool returns its key; adding another via add_component_property duplicates it). Slot frames reject GRID layout; instances fill slots by appending children, not setProperties.
8. Cap variant matrices ~30 combinations; validate with `get_file_digest` + `get_screenshot`.

## 4. Screen assembly

1. Create the wrapper frame FIRST (cross-call reparenting can silently fail), auto-layout on.
2. Discover components: `get_file_digest` (local) → `list_library_variables` / library keys (shared) → `get_code_mappings` (what code already exists).
3. `instantiate_component` per component: parent + properties + textOverrides in ONE call.
4. Bind variables, not hex (`write_variables` bind_to_node).
5. Icons via `swap_instance` or SVG import — never rotated primitives.
6. Validate cheap (`get_file_digest`, `get_node`) after every few writes; `get_screenshot` at visual milestones only.

## 5. Prototype wiring

1. Build all screens first; name layers CONSISTENTLY across screens — SMART_ANIMATE matches by name.
2. `set_reactions` per trigger node: `{trigger: {type:'ON_CLICK'}, actions: [{type:'NODE', destinationId, navigation:'NAVIGATE', transition: {type:'SMART_ANIMATE', easing:{type:'EASE_OUT'}, duration: 0.3}}]}`.
3. Overlays: navigation `'OVERLAY'` with the overlay frame as destination; close with `{type:'CLOSE'}`; back with `{type:'BACK'}`.
4. Declare entry points: `set_flow_starting_point` on each flow's first frame.
5. Motion (beta): `get_motion` for styles → `apply_animation_style`; easing accepts variable aliases.
6. Read back with `get_reactions` to verify the interaction graph.

## 6. Fonts & text (unchanged, load-bearing)

Exact `{family, style}` strings only — `list_fonts`, never guess ('Semibold' ≠
'Semi Bold' ≠ 'SemiBold'). Fonts load before ANY text mutation (the tools do
this). lineHeight/letterSpacing are `{unit, value}` objects.

## 7. Multi-agent & long work

`acquire_lock` on what you mutate (`styles:text`, `page:<id>`); checkpoint
after each milestone (`save_checkpoint` — completed steps, id maps, next
action); on timeout errors verify with a read before retrying (the op may have
landed); mutations sequential, ≤~10 logical ops per burst; reads parallel.

## 8. Design→code (local Code-Connect equivalent)

Before generating code for a component: `get_code_mappings` — if a mapping
exists, USE the mapped source/snippet instead of inventing markup. After
implementing a new component: `set_code_mapping` so the next session reuses it.

## 9. Plan-gate honesty (what this MCP does and doesn't unlock)

- **Un-gated here (tooling-level gates)**: variable authoring + full-mode reads (REST is Enterprise-only; the Plugin API is all-plans), library variable/style/component import by key, annotations + dev resources writes (Dev-Mode UI conveniences), local code mappings (Code Connect is Org/Enterprise), no MCP rate limits, motion/shader writes (official MCP is read-only).
- **NOT unlocked (editor-runtime enforcement — do not attempt)**: extended variable collections, per-plan mode-count limits, branching/merge, org/private libraries you lack access to, seat-based publish rights. Figma enforces these inside the editor; tools surface those errors as-is.
