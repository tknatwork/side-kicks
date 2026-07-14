# Limitless MCP for Figma

> **Your whole Figma file as an API — locally.** Give any AI assistant full, unthrottled access to Figma *and* build design systems the right way with a bundled skills + linter closed loop.

![MCP](https://img.shields.io/badge/MCP-compatible-5865F2)
![License](https://img.shields.io/badge/license-MIT-yellow)
![Network](https://img.shields.io/badge/network-none%20(local--only)-2ea44f)
![Tools](https://img.shields.io/badge/tools-98-8A2BE2)
![Surfaces](https://img.shields.io/badge/surfaces-Design%20·%20Dev%20·%20FigJam%20·%20Slides%20·%20Buzz-0AA)
![DS Linter](https://img.shields.io/badge/design--system%20linter-57%20rules-orange)

A local **Figma MCP server + Figma Desktop plugin** that gives AI assistants everything the official/remote Figma MCP can't reach — your locally-installed fonts, variable authoring, prototype wiring, component mastery, the FigJam/Slides/Buzz surfaces, and a persistent journal/checkpoint layer so AI sessions survive crashes and context loss. Plus an **offline design-system knowledge base + 57-rule structure linter** that turns "design → code always breaks" into a **build → lint → fix** loop.

No Figma REST API calls — so no REST rate limits; it talks to the Figma **Plugin API** locally. No plan-tier tooling locks. Everything runs on your machine, on your own files.

> **Independent project — not affiliated with, endorsed, or sponsored by Figma.** "Figma" is a trademark of Figma, Inc., used here only descriptively (a tool *"for Figma"*). This is a **local/private developer tool** (a localhost bridge with an `execute_code` escape hatch); it is **not** distributed through Figma Community and isn't intended to be — that's by design, not a limitation.

```
AI client (Claude Code / Claude Desktop / Cursor / …)
        │  stdio (MCP)
        ▼
local server (:1994) ── journal · checkpoints · locks · digest cache · design-system linter
        │  WebSocket
        ▼
Figma Desktop plugin ── full Plugin API access to your open files
```

## What is this?

Three things in one package:

1. **A full-power Figma MCP** — 98 tools spanning read, create, style, layout, variables, components, instances, prototyping, and the FigJam/Slides/Buzz editors. Anything the Plugin API can do, your AI can do.
2. **A crash-safe session layer** — a disk journal, named checkpoints, TTL locks, and cached file digests so multi-step (and multi-agent) work resumes exactly where it stopped.
3. **A design-system skills + linter** — bundled, offline knowledge on how tokens *should* be derived, plus a 57-rule structure linter that checks your variables/styles/components against it and hands the AI fix hints. Read-only; it never mutates your file.

## ✨ Highlights — the design-system closed loop

Building a structurally-correct, code-gen-friendly design system by trial and error is the pain this solves. The loop:

- **`list_skills` / `read_skill`** — bundled Markdown on token architecture, variable scopes, theming with modes, component/variant structure, design-to-code correctness, and accessibility. No network, no design-tool AI credits.
- **`get_build_recipe`** — the canonical **Primitive → Semantic → Component** build order, and for each step an *actionable lint gate*: the exact `lint_design_system` call to run next.
- **`lint_design_system`** — a **57-rule** structure linter across seven tiers (tokens · scopes · theming · naming · components · code-output · accessibility). Each finding carries a fix hint linked to the skill that explains it.

Design principle: **advise, don't dictate.** Only objectively-broken things are errors (a reference that resolves nowhere, a scope Figma rejects). Every opinionated/house-style rule is a warning and off by default — turn them on with `enable` / `config`. Verified against a real 1,121-variable / 48-page / 376-component design system.

## Why local beats remote

| | Official/remote Figma MCP | Limitless MCP for Figma |
|---|---|---|
| REST rate limits | Plan-tiered, shared quota | N/A — uses the local Plugin API |
| Locally-installed fonts | Invisible (Google/shared fonts only) | Fully visible + loadable |
| Variable authoring | None (REST variables API is Enterprise-only) | Full create/edit/bind/alias |
| Prototype wiring | Read-only context | Author reactions, flows |
| FigJam / Slides / Buzz | — | First-class tools |
| Motion / shaders (2026 betas) | Read-only | Read + write (capability-guarded) |
| Design-system linting | — | 57-rule structure linter + skills |
| Session state | None — every conversation starts cold | Journal, checkpoints, locks, cached digests |
| Multiple files / agents | One context | Multi-file registry + leader/follower + TTL locks |

## ⚡ Quick start

Prereqs: [Figma Desktop](https://www.figma.com/downloads/), Node.js ≥ 20, [pnpm](https://pnpm.io) (`the ~ in paths means your home folder`).

```bash
# Grab just this subproject from the public side-kicks repo (sparse checkout)
git clone --depth 1 --filter=blob:none --sparse https://github.com/tknatwork/side-kicks.git
cd side-kicks && git sparse-checkout set figma-limitless-mcp && cd figma-limitless-mcp
# — or clone the whole repo: git clone …/side-kicks.git && cd side-kicks/figma-limitless-mcp

# Build the server and the plugin
cd server && pnpm install && pnpm run build && cd ..
cd plugin && pnpm install && pnpm run build && cd ..
```

**Import the plugin into Figma Desktop** (once): Figma menu → **Plugins → Development → Import plugin from manifest…** → select `plugin/manifest.json`.

**Register the MCP server with your AI client:**

<details><summary><b>Claude Code</b></summary>

```bash
claude mcp add figma-limitless-mcp -s user -- node "$(pwd)/server/dist/index.js"
```
</details>

<details><summary><b>Claude Desktop / Cursor / Windsurf</b> (any MCP-config JSON)</summary>

```json
{
  "mcpServers": {
    "figma-limitless-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/figma-limitless-mcp/server/dist/index.js"]
    }
  }
}
```
</details>

**Use it:** open a Figma file, run **Plugins → Development → Limitless MCP for Figma**, and ask your AI to work in Figma. The plugin window shows the connection state. Health check: `curl http://localhost:1994/ping`.

Multiple AI clients can register the same command — the first becomes the leader on :1994, the rest proxy through it automatically. Multiple Figma files connect at once (run the plugin in each; target by `fileKey`).

## How an AI should use this

Point your AI at [docs/AI-GUIDE.md](docs/AI-GUIDE.md) — directives, guardrails, recipes, and an error playbook written for AI consumption. The essentials:

1. **Orient first:** `get_workspace_status` → `get_file_digest` (token-lean file map, ~1ms from cache when nothing changed). Never start with `get_document`.
2. **Resume, don't redo:** `load_checkpoint` + `get_journal` reconstruct what a previous session did. `save_checkpoint` after each milestone.
3. **Building a design system?** `get_build_recipe` first, then build a tier → `lint_design_system` → fix → descend. Read `read_skill` when a rule needs explaining.
4. **Fonts:** `list_fonts` returns exact `{family, style}` strings — including local/brand fonts the remote MCP can't see. Never guess ('Semibold' ≠ 'Semi Bold' ≠ 'SemiBold').
5. **Structure over raw values:** bind variables > apply styles > raw values. Author with `write_variables` (one batched call via `$N.field` back-refs); read with `get_variables_deep`.
6. **Parallel agents:** `acquire_lock` on what you mutate; locks auto-expire. After a timeout, **read before retrying** — the op may have landed; the journal knows.

## 🛠️ Tool surface (98 tools)

| Category | Tools |
|---|---|
| 🧭 Orientation | `get_workspace_status` · `get_file_digest` (cached) · `list_files` · `get_metadata` |
| 📖 Reads | `get_document` · `get_node` · `get_selection` · `get_design_context` · `get_styles` · `get_text_styles` · `get_effect_styles` · `get_variables_deep` · `get_variable_defs` · `get_annotations` · `get_reactions` · `get_motion` · `list_shaders` · `list_fonts` · `list_library_variables` |
| 🎨 Create & style | `create_frame` · `create_text` · `create_shape` · `create_image` · `set_solid_fill` · `set_gradient_fill` · `set_effects` · `set_stroke_properties` · `apply_style` · `create_paint_style` · `create_effect_style` |
| ✍️ Text | `set_text_content` · `set_text_properties` · `create_text_style` · `update_text_style` · `apply_text_style` · `load_fonts` |
| 📐 Layout & structure | `set_auto_layout` · `set_grid_layout` · `set_node_properties` · `set_node_visibility` · `duplicate_nodes` · `reparent_nodes` · `group_nodes` · `ungroup_node` · `delete_nodes` (confirm-gated) |
| 🔧 Variables | `write_variables` (batched authoring with `$N.field` refs) |
| 🧩 Components & instances | `create_component_from_node` · `combine_as_variants` · `add_component_property` · `create_slot` · `append_to_slot` · `reset_slot` · `get_slots` · `instantiate_component` · `set_instance_properties` · `swap_instance` |
| 🔀 Prototyping | `set_reactions` · `set_flow_starting_point` |
| 🎞️ Motion / shaders (beta) | `apply_animation_style` · `apply_shader` |
| 📌 FigJam | `create_sticky` · `create_connector` · `create_shape_with_text` · `create_section` · `create_table` · `create_code_block` · `create_gif` |
| 🖥️ Slides | `create_slide` · `create_slide_row` · `focus_slide` · `get_slide_grid` · `set_slide_grid` · `set_slide_skip` · `set_slide_transition` |
| ✳️ Buzz | `create_buzz_frame` · `get_buzz_content` · `set_buzz_text` · `set_buzz_asset_type` · `buzz_smart_resize` |
| 🔍 Design-system skills & linter | `list_skills` · `read_skill` · `get_build_recipe` · `lint_design_system` |
| 🤝 Handoff | `set_annotation` · `dev_resources` · `set_code_mapping` · `get_code_mappings` |
| 📚 Library | `import_library_asset` |
| 👁️ Viewport & media | `set_selection` · `scroll_and_zoom_into_view` · `get_screenshot` · `save_screenshots` |
| 💾 Sessions | `save_checkpoint` · `load_checkpoint` · `get_journal` · `acquire_lock` · `release_lock` |
| 🧨 Escape hatch | `execute_code` (Plugin-API JS, top-level await, `timeoutMs` ≤ 300s) |

All session state lives in `~/.figma-limitless-mcp/` and survives restarts.

## 📖 Example prompts

- *"Build a 3-tier color system in this file — primitives, semantic aliases, component tokens — then lint it and fix everything that's actually broken."*
- *"List my local fonts and apply 'Graphik Web / Semibold' to the selected heading."*
- *"Turn this frame into a component with size and state variants, then check the variant matrix is complete."*
- *"Wire a prototype: tapping the CTA opens the modal with a smart-animate transition."*
- *"Lint the design system and show me only the accessibility warnings; enable the min-font-size rule with a 14px floor."*
- *"Resume where we left off — load the last checkpoint and the journal, then continue building the Button component."*

## Troubleshooting

| Symptom | Fix |
|---|---|
| Plugin says "Waiting for server" | No MCP client has started the server yet — check `lsof -i :1994` |
| `execute_code` fails with "Not available" | Turn OFF Plugins → Development → **Use developer VM** (it blocks the Function constructor) |
| "Multiple files connected. Specify a fileKey" | Pass `fileKey` (from `list_files`) — the plugin is running in 2+ files |
| `list_library_variables` errors about permissions | Re-import the plugin — the manifest needs `teamlibrary` (already declared) |
| Font load fails | The style string is wrong — `list_fonts` for exact values; never guess |
| A timeout error after a mutation | The op may still have applied — verify with a read (`get_journal` / `get_node`) before retrying |
| Changed detector/gather code and lint looks stale | The server loads at session start — rebuild, then a fresh session (or a plugin re-run for gather changes) picks it up |

## Security & privacy

- Everything is local: the plugin only talks to `ws://localhost:1994` (pinned in the manifest); the server binds localhost and never phones home.
- No telemetry, no accounts, no tokens. State root: `~/.figma-limitless-mcp/`.
- Write tools are rejected in Dev Mode; `delete_nodes` requires `confirm: true`; screenshot/image paths are jailed to the server's working directory; remote image fetches have SSRF guards.
- The linter is **read-only** — it inspects and reports, never mutates your design system.
- `execute_code` runs arbitrary Plugin-API JavaScript **in your own file** — the same trust model as Figma's own `use_figma`. Review what your AI runs.

## What this does and doesn't unlock (honest version)

Figma gates some capabilities at the **tooling level** (REST API tiers, MCP rate limits, Org/Enterprise-only developer tooling like Code Connect). The public **Plugin API** offers most of those on every plan — this project simply packages them as local tooling for your own files. That's what "limitless" means here.

What it deliberately does **not** do: bypass anything Figma enforces inside the editor runtime — extended variable collections, per-plan mode-count limits, branching/merge, library access you don't have, publish rights. Those limits surface as-is.

## Contributing

PRs welcome. Architecture notes for contributors (and AI builders) live in [AGENTS.md](AGENTS.md); adding a tool touches 4 places (plugin handler, schema, rpc mapping, registration) and adding a lint detector touches 3 (detector fn, registry entry, config if parameterized) — the type system makes omissions compile errors. Build with pnpm only; run the offline linter test suite with `cd server && pnpm test`. Keep examples generic — no user-specific fonts, file keys, or accounts.

## License

MIT — see [LICENSE.md](LICENSE.md).
