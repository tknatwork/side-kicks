# AGENTS.md — figma-limitless-mcp

> Canonical AI-builder rules for this project. `CLAUDE.md` is a pointer here.

## What this is

A local Figma MCP server + Figma Desktop plugin. No REST calls, no rate
limits. 72 tools: local fonts, text/paint/effect styles, variable authoring,
grid layout, master components, instances, prototyping, annotations, dev
resources, Motion/shaders (beta), plus a crash-safe orchestration layer
(journal, checkpoints, TTL locks, cached digests). AI operating rules:
`docs/AI-GUIDE.md`.

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

## Testing

`scripts/e2e-live-test.mjs` is a live end-to-end suite that exercises ~50 tool
paths against a real Figma file. Prereq: Figma Desktop open with the plugin
running in a scratch file. Run `node scripts/e2e-live-test.mjs` from the repo
root (or `FILE_KEY=<key> node …` to target one of several connected files). It
creates everything inside a dedicated test page and removes all artifacts
(page, styles, variables, collections, temp state) on exit — the file is left
as found. Only one MCP server may hold `:1994`; kill stragglers first
(`lsof -i :1994`) so the test runs as leader, not follower.

## Registration

User-scope MCP entry in `~/.claude.json` → `mcpServers.figma-limitless-mcp`
(`node <this>/server/dist/index.js`). The plugin is imported into Figma Desktop
via Plugins > Development > Import plugin from manifest… → `plugin/manifest.json`.

## Boundaries

- `LICENSE.md` ships intact with every copy — never edit or remove it.
- No user-specific font names, file keys, or account details in code, schemas, or docs — examples stay generic.
