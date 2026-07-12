# Figma Limitless MCP

A **local** Figma MCP server + Figma Desktop plugin that streams live document
data to AI tools with **no Figma REST API calls and no rate limits**, and —
unlike the official/remote Figma MCP — **full visibility of locally-installed
fonts** (licensed faces like Graphik, Averta, Meslo LG, Lora).

Portions derive from an MIT-licensed upstream bridge (notice retained in
[LICENSE.md](LICENSE.md)); the architecture, tool surface, and orchestration
layer here are original.

## Why this exists

The official Figma MCP is rate-limited and runs remotely: `figma.listAvailableFontsAsync()`
through it returns only Google/shared families (1723 of them) and **zero** local
licensed faces. This plugin runs *inside Figma Desktop*, so it sees and loads
everything the desktop app can — which is exactly what a design-system font pass
needs. Architecture: the plugin's UI iframe holds a
WebSocket to a local MCP server on `ws://localhost:1994`; multiple files connect
simultaneously keyed by `fileKey`; multiple AI clients share one plugin
connection via leader/follower election.

## Font + text-style tools (the original 8)

| Tool | Purpose |
|------|---------|
| `list_fonts` | Enumerate fonts Figma Desktop sees — **including local fonts** — grouped by family with exact style strings. Filter by substring or exact family list. Never guess style strings ('Semibold' vs 'Semi Bold'); discover them here. |
| `load_fonts` | Batch-load exact `{family, style}` pairs; per-font success report. Doubles as an availability check. |
| `get_text_styles` | Full-fidelity local text styles: fontName, size, lineHeight, letterSpacing, paragraphSpacing, textCase, textDecoration, variable bindings. |
| `create_text_style` | Create a text style with proper `{unit, value}` lineHeight/letterSpacing; loads the font first; `skipIfExists` for idempotency. |
| `update_text_style` | Patch a style in place (by id or name). Changing `fontFamily` re-fonts **every node bound to the style** — the one-call-per-style lever for swapping Inter → real faces. |
| `apply_text_style` | `setTextStyleIdAsync` on one or more text nodes, by style id or name. |
| `get_effect_styles` | Local effect styles with full effects + bindings (elevation verification). |
| `execute_code` | Escape hatch: run Plugin-API JavaScript in the sandbox (top-level await, `figma` in scope, JSON return only) — a local `use_figma` equivalent. |

Total surface: **55 tools**. Plus the ~30 upstream read/write tools (document/selection/node/styles/variables
reads, screenshots, text/fill/effect/stroke/auto-layout patches, frame/text/shape/
image creation, duplicate/reparent/group, guarded delete).

## Setup

```bash
# 1. Build (pnpm only — never npm/npx)
cd server && pnpm install && pnpm run build
cd ../plugin && pnpm install && pnpm run build

# 2. Import the plugin into Figma Desktop
#    Figma menu > Plugins > Development > Import plugin from manifest…
#    → select plugin/manifest.json

# 3. Register the MCP server (user scope; run from the figma-limitless-mcp repo root
#    so the absolute path resolves correctly)
claude mcp add figma-limitless-mcp -s user -- node "$(pwd)/server/dist/index.js"
```

Open the target Figma file, run **Plugins > Development > Figma Limitless MCP**,
and the file appears in `list_files`. Health check: `curl http://localhost:1994/ping`.

## Font-pass recipe (design-system swap)

1. `list_fonts` with `families: ["Graphik", "Averta", "Meslo LG M", "Lora"]` → exact style strings.
2. `get_text_styles` → the styles and their current (placeholder) fonts.
3. `update_text_style` per style with the real `fontFamily`/`fontStyle` — bound nodes update automatically.
4. `apply_text_style` for any text nodes not yet bound to a style.
5. `get_screenshot` to eyeball the result.

## Notes

- Write tools are rejected in Dev Mode (read-only) with a clear error; `execute_code` mutations also fail there.
- `delete_nodes` requires `confirm: true`.
- Port 1994 is intentionally kept from upstream; it is hardcoded in `server/src/index.ts`, `plugin/src/ui/App.tsx`, and `plugin/manifest.json` — change all three together or not at all.
- `execute_code` runs in the plugin sandbox: ES2017 syntax, JSON-serializable returns only, no node objects.
