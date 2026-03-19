# Copilot Agent Memory

> What Copilot has learned across sessions working on DSB.
> Updated by Copilot at the end of each session.
> Read by Claude agents to access Copilot's institutional knowledge without burning tokens.

## Persistent Memory Assets (from Nectar/Side-Kicks builds)

Copilot built the Nectar Design Toolkit — the base architecture DSB derives from. These patterns are in Copilot's Persistent Memory (cloud-side) and should be materialized here when accessed:

### Orchestration Server Pattern
- HTTP polling architecture: plugin polls server every 500ms for commands
- Command lifecycle: `pending → processing → completed/failed`
- Express server on port 9877 with CORS, JSON body parsing
- Health endpoint at `/health` for connectivity checks
- Auth middleware for sensitive routes, no auth for browser-facing routes

### Figma Plugin Communication
- Headless plugin (no UI panel) — all interaction through HTTP polling
- Plugin reads commands from orchestration server, executes in Figma API, posts results back
- ES2017 constraint discovered the hard way — QuickJS sandbox errors on modern syntax
- `Object.assign` pattern for object copying, `&&` chains for safe access

### MCP Server Architecture
- stdio transport (not HTTP) — Claude Code connects via process stdin/stdout
- Tool naming: `dsb_` prefix + verb + noun (`dsb_create_tier1_primitives`)
- Bridge client class wraps HTTP calls to orchestration server
- Tool registration pattern: category-based files in `src/tools/`

### Build Pipeline Learnings
- TypeScript compilation order matters — build core first, then dependents
- `pnpm exec tsc --noEmit` catches type errors without producing output
- Vitest for unit tests, pattern: `*.test.ts` next to source files

<!-- COPILOT: Append new learnings below as you discover them -->
