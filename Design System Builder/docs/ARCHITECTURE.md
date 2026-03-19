# Architecture

## Package Dependency Graph

```
guardrails (leaf — no dependencies)
    ↑
  core ← licensing
    ↑         ↑
figma-api   mcp-server ← figma-rest (REST API client)
    ↑         ↑
builder-plugin  orchestration-server
        ↑
      updater
```

8 packages total. No circular dependencies.

## Communication Flow

```
User ↔ Claude (AI) ↔ MCP Server ↔ Orchestration Server ↔ Builder Plugin ↔ Figma API
           │              │                  │
           │              │                  └── UI iframe (sole HTTP layer)
           │              │
           │              └── figma-rest.ts ──→ Figma REST API (comments)
           │
           └── workspace/ files (sandboxed I/O via guardrails)
```

1. User talks to Claude in their IDE (Claude Code, Cursor, VS Code)
2. Claude calls MCP tools (`dsb_create_tier1_primitives`, `dsb_extract_design_system`, etc.)
3. MCP server sends commands to orchestration server via HTTP (bridge-client.ts)
4. Orchestration server queues commands for the plugin
5. Plugin's **UI iframe** polls the orchestration server every 50ms via `fetch()`
6. UI iframe relays commands to the plugin sandbox via `postMessage`
7. Plugin sandbox dispatches to handler functions, returns results via `postMessage`
8. UI iframe sends results back to the orchestration server
9. Comment tools bypass the plugin entirely — `figma-rest.ts` calls the Figma REST API directly

### Why the UI Iframe Handles HTTP

The Figma plugin sandbox (QuickJS) has **no `fetch()` API**. All network calls must go through the UI iframe (which runs in a browser context with full Web APIs). The plugin sandbox communicates with the iframe via `figma.ui.postMessage` / `figma.ui.onmessage`.

### Cross-File Pipeline Flow (OpenPencil + DSB)

```text
Source .fig (OpenPencil Desktop)        Destination (Figma Desktop + DSB Plugin)
        │                                          │
   Claude reads via                           Claude writes via
   OpenPencil MCP (90 tools, :3100)          DSB Plugin (59 handlers, :9877)
        │                                          │
        └──── MCP Server orchestrates ─────────────┘
              Impact Analyzer → Write Governor → Bridge Client
```

The pipeline supports three file role modes:
- **Source** (green badge) — read-only, extraction/query only
- **Destination** (orange badge) — full read+write via plugin
- **Source+Destination** (blue badge) — in-place editing on a single file

## Build Targets

| Package | Target | Runtime |
|---------|--------|---------|
| guardrails | ES2022 | Node.js |
| core | ES2022 | Node.js (learning, export, validation modules) |
| figma-api | ES2017 | Figma QuickJS sandbox |
| builder-plugin | ES2017 | Figma QuickJS sandbox |
| mcp-server | ES2022 | Node.js |
| orchestration-server | ES2022 | Node.js |
| licensing | ES2022 | Node.js |
| updater | ES2022 | Node.js |

## Package Responsibilities

### guardrails

Foundation package. All file I/O must pass through here.

- Path validation + sandbox boundary enforcement
- File type policy (allowed/blocked extensions)
- Audit logging (every read/write logged)
- Rollback snapshots before destructive Figma operations
- Integrity verification (file hash manifests)
- Machine fingerprinting + tamper detection
- Copy/redistribution detection
- Safe file operation wrappers (`safeReadFile`, `safeWriteJson`, etc.)

### core

Shared business logic. Pure computation — no Figma API, no network calls.

- `tokens/schema.ts` — Type definitions for all token types
- `tokens/three-tier-engine.ts` — Tier enforcement, alias validation, token generation
- `color/converter.ts` — hex/rgb/hsl/hsb/Figma RGBA conversions
- `color/palette-generator.ts` — Generate color scales and schemes from base colors
- `validation/token-validator.ts` — 3-tier rule validation, plan limit checks
- `export/current-format.ts` — JSON export/import (compatible with Extractor plugin)
- `export/dtcg-format.ts` — W3C DTCG 2025.10 export
- `styles/style-generator.ts` — Build style plans from resolved variables (pure computation)
- `learning/context-store.ts` — Persist/load project and global context
- `learning/workspace-reader.ts` — List/read files from workspace/ subdirectories

### figma-api

Thin, async-safe wrappers around Figma Plugin API. ES2017-compatible.

- `variables.ts` — Collection and variable CRUD
- `styles.ts` — Color, text, effect, grid style creation
- `pages.ts` — Page creation and navigation
- `nodes.ts` — Frame, text, rectangle, section creation
- `components.ts` — Component and instance creation
- `fonts.ts` — Font loading and availability checks
- `query.ts` — File info, selection, local styles queries

### builder-plugin

Headless Figma plugin. UI iframe polls orchestration server for commands, relays them to the plugin sandbox for execution.

**Entry point:** `code.ts` — 59 registered command handlers, dispatches via `COMMAND_HANDLERS` registry.

**Polling architecture:** `polling.ts` exports types only. The UI iframe (`ui.html`) handles all HTTP communication — polling, command relay, result forwarding, and console buffer management.

**Handler files** (`handlers/`):

| File | Commands | Category |
|------|----------|----------|
| `token-handlers.ts` | 8 | Collection/variable CRUD |
| `style-handlers.ts` | 5 | Style generation |
| `page-handlers.ts` | 12 | Page/node creation |
| `query-handlers.ts` | 6 | File queries, fonts |
| `node-manipulation-handlers.ts` | 9 | Resize, move, clone, fills, strokes, text, properties |
| `component-handlers.ts` | 4 | Instantiate, search, metadata, arrange |
| `extraction-handlers.ts` | 3 | Full DS extraction, summary, local styles |
| `debug-handlers.ts` | 3 | Console buffer, clear, reload page |
| `image-handlers.ts` | 2 | Export node image, take screenshot |
| `audit-handlers.ts` | 3 | Lint, parity check, health score |
| `execute-handler.ts` | 1 | Run arbitrary Plugin API code |
| `doc-handlers.ts` | 1 | Auto-generate component documentation |
| `role-handler.ts` | 2 | File role toggle (source/destination/source+destination) |

### mcp-server

Claude's primary interface. Exposes **86 MCP tools** organized by category.

**Tool modules** (`tools/`):

| File | Tools | Category |
|------|-------|----------|
| `connection-tools.ts` | 3 | Connection, license, restart |
| `token-tools.ts` | 6 | Tier 1/2/3 creation, batch ops |
| `query-tools.ts` | 8 | Collections, variables, styles, pages, selection, fonts |
| `style-tools.ts` | 4 | Color, text, effect, grid styles |
| `layout-tools.ts` | 3 | Page structure, foundation, component pages |
| `export-tools.ts` | 4 | JSON/DTCG export, validation, plan limits |
| `learning-tools.ts` | 3 | Workspace read, context save/load |
| `setup-tools.ts` | 2 | Project setup, system check |
| `config-ui-tools.ts` | 1 | Config wizard |
| `build-tools.ts` | 2 | Start/resume build pipeline |
| `telemetry-tools.ts` | 1 | Telemetry opt-in/out |
| `update-tools.ts` | 2 | Check/apply updates |
| `admin-tools.ts` | 3+ | Admin-only operations |
| `node-tools.ts` | 7 | Resize, move, clone, fills, strokes, text, properties |
| `component-tools.ts` | 4 | Instantiate, search, metadata, arrange |
| `extraction-tools.ts` | 3 | Full DS extraction, summary, local styles |
| `debug-tools.ts` | 4 | Console logs, clear, reload, reconnect |
| `image-tools.ts` | 2 | Export image, screenshot |
| `comment-tools.ts` | 3 | Get/post/delete comments (via Figma REST API) |
| `audit-tools.ts` | 3 | Lint, parity, health score |
| `execute-tools.ts` | 1 | Run arbitrary Plugin API code |
| `doc-tools.ts` | 1 | Auto-generate component docs |
| `pipeline-tools.ts` | 5 | Cross-file pipeline: analyze source, preview impact, apply changes, cross-validate, OpenPencil health |
| `file-role-tools.ts` | 2 | File role toggle (source/destination/source+destination) |

**Pipeline modules** (`pipeline/`):

- `types.ts` — 30 shared type definitions (FileRole, SourceAnalysis, ImpactReport, GovernorCommand, BatchPlan, etc.)
- `openpencil-adapter.ts` — OpenPencil MCP wrapper via JSON-RPC HTTP. `readAll()` runs 5 parallel reads (tree, variables, components, reactions, fonts)
- `impact-analyzer.ts` — Cascading impact analysis: traces alias chain (Tier 1→2→3), walks component hierarchy (master→variant→instance), warns about prototype connections
- `write-governor.ts` — Adaptive rate limiter with circuit breaker. Groups commands by ordering (vars→nodes→props→deletions), adaptive batch size (5→10), circuit breaks after 3 failures

**Additional modules:**

- `bridge-client.ts` — HTTP client to orchestration server
- `figma-rest.ts` — Figma REST API client for comment operations (uses PAT, not plugin bridge)

### orchestration-server

HTTP bridge between MCP server and Figma plugin.

- `POST /command` — Queue a command for the plugin
- `GET /poll` — Plugin polls for pending commands
- `POST /response` — Plugin returns command results
- `POST /register` — Plugin heartbeat
- `GET /status` — Connection and queue status
- `GET /health` — Health check
- `DELETE /queue` — Emergency clear all pending commands

### licensing

Gumroad license validation and feature gating.

- `gumroad-client.ts` — API client for license verification
- `activation.ts` — License activation + machine binding
- `session-token.ts` — Session token generation for protocol auth
- `cache.ts` — Encrypted local license cache (7-day TTL)
- `feature-gate.ts` — Tier-based tool access (Free/Pro/Team)

### updater

Secure OTA update system with Ed25519 signatures and atomic rollback.

## 3-Tier Token Architecture

```
Tier 1: Primitives          Tier 2: Semantic          Tier 3: Mapped (per theme)
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────┐
│ color/blue-500   │◄───│ bg/primary       │◄───│ Light: bg/primary    │
│ color/zinc-900   │◄───│ fg/foreground    │◄───│ Dark:  bg/primary    │
│ spacing/4        │◄───│ spacing/gap-md   │    │ Light: fg/foreground │
│ font-size/base   │◄───│ font-size/body   │    │ Dark:  fg/foreground │
└──────────────────┘    └──────────────────┘    └──────────────────────┘
     Raw values          Purpose aliases          Theme-resolved
```

Aliases always point up the chain: Tier 3 → Tier 2 → Tier 1. Never skip tiers.

## Sandbox Boundaries

```
READ allowed:   workspace/context/, workspace/exports/, workspace/specs/,
                workspace/reports/, workspace/temp/, templates/, .dsb/, ~/.dsb/

WRITE allowed:  workspace/exports/, workspace/specs/, workspace/reports/,
                workspace/temp/, .dsb/, ~/.dsb/

DELETE allowed: workspace/temp/ only

BLOCKED files:  .exe, .sh, .env, .pem, .key, .zip, .db (see guardrails/constants.ts)
```
