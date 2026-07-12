# AGENTS.md — figma-limitless-mcp

> Canonical AI-builder rules for this project. `CLAUDE.md` is a pointer here.

## What this is

A local Figma MCP server + Figma Desktop plugin (portions derive from an
MIT-licensed upstream — notice retained in LICENSE.md) that bypasses Figma REST
rate limits, exposes **locally-installed fonts**, authors **variables/grid/
annotations/motion/shaders** the official MCP cannot, and gives AI sessions a
persistent **journal + checkpoint + lock** layer for crash-safe, multi-agent
work. v0.1.0 created 2026-07-13 for the portfolio DS font pass (file
`yIzO6LwpGMO8z11XYx5PIW`); v0.2.0 (same day) added the limitless layer. See
`docs/figma-mcp-distillation.md` for the official-MCP mental model.

## Architecture (2 packages)

- `server/` — stdio MCP server (`node dist/index.js`), TypeScript → `tsc`. Leader binds HTTP+WS on **:1994** (`/ws` plugin, `/ping` health, `/rpc` followers); extra clients become followers and proxy via `/rpc`. Multi-file registry keyed by `fileKey`.
- `plugin/` — Figma plugin. `src/main/code.ts` (sandbox: request handlers) + `src/ui/` (React iframe: owns the WebSocket). Built with vite → `dist/code.js` + `dist/index.html`; `manifest.json` points at both. Typings pinned `@figma/plugin-typings` **1.130.0** (Motion/Shaders/Slots/Grid APIs).

## Orchestration layer (server/src/orchestration.ts)

The LEADER owns an `Orchestrator`: disk journal (`~/.figma-limitless-mcp/journal/<fileKey>.jsonl`,
5MB rotation, seq recovered across restarts), checkpoints (`checkpoints/<fileKey>/<name>.json`,
≤256KB), TTL locks (`locks.json`), and an in-memory digest cache. `Leader.execute()` is the single
choke point for every tool call (own client via `Node.sendWithParams`, followers via `/rpc`):
META_TOOLS resolve locally, `get_file_digest` is cache-read-through, everything else forwards to
the plugin with mutations journaled (JOURNALED_TOOLS). Cache invalidation is double-sourced:
plugin-side page `nodechange` events batched 1s into requestId-less `doc-event` WS messages
(`Bridge.onPluginEvent`), plus the leader self-invalidates after its own journaled writes.
Agent identity defaults to MCP clientInfo (`node.agentSupplier`); tools accept an explicit
`agent` for stable task names. **Adding a mutating tool ⇒ add it to both EDIT_REQUEST_TYPES
(plugin) and JOURNALED_TOOLS (orchestration.ts).**

## Beta-API tools (Motion, Shaders)

`get_motion`/`apply_animation_style`/`list_shaders`/`apply_shader` guard with `'motion' in figma` /
`'listAvailableShaders' in figma` and throw clear capability errors on older Figma builds — the
APIs are beta ("subject to change" per Plugin API Update 127, June 2026). Verified live 2026-07-13:
Motion styles enumerate; shaders API present (0 shaders in file).

## Conventions & invariants

- **pnpm only** (workspace rule). Build: `pnpm install && pnpm run build` in each package.
- Port **1994** is hardcoded in `server/src/index.ts`, `plugin/src/ui/App.tsx`, `plugin/manifest.json` — change all three together or not at all.
- Adding a tool touches 4 places: `plugin/src/main/code.ts` (RequestType union + handler, EDIT_REQUEST_TYPES if it writes), `server/src/schema.ts` (input schema + `toolInputSchemas` + `rpcToArgs` — Record types make omissions compile errors), `server/src/tools.ts` (registration). Refined Zod schemas register the **unrefined** `.shape` and validate the refined schema via `parseToolInput` (see `update_text_style`).
- Font rules are load-bearing: exact `{family, style}` strings only (discover via `list_fonts`, never guess); load fonts before any text/style mutation; `lineHeight`/`letterSpacing` are `{unit, value}` objects.
- Write tools must stay Dev-Mode-guarded (`EDIT_REQUEST_TYPES`); `delete_nodes` keeps its `confirm: true` gate; `execute_code` returns JSON-only, size-capped.
- Rebuild `plugin/dist` after ANY `plugin/src` edit and re-run the plugin in Figma — Figma loads the built bundle, not the source.

## Registration

User-scope MCP entry in `~/.claude.json` → `mcpServers.figma-limitless-mcp`
(`node <this>/server/dist/index.js`). The plugin is imported into Figma Desktop
via Plugins > Development > Import plugin from manifest… → `plugin/manifest.json`.

## Boundaries

- This project serves the portfolio DS but must not modify the portfolio repo.
- The retained MIT notice in `LICENSE.md` is a legal requirement — protected, never remove.
