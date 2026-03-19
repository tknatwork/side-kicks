# Claude Third-Party Agent (Tier 1) — Memory

> What the Claude agent in Copilot Chat has learned across sessions.
> Updated at the end of each Claude agent session.
> This is the PRIMARY builder — handles 90% of work via @dsb-builder custom agent.

## Setup

- Custom agent: `.github/agents/dsb-builder.agent.md`
- Tools: read, edit, search, execute, web, agent, todo, design-system-builder/*
- Models: Opus 4.6 (architecture), Sonnet 4.5 (routine)
- Billing: Copilot Premium Requests
- Permissions: bypass-all (no 25-request cap)

## What This Agent Can Do

- Write TypeScript source code across all 8 packages
- Call dsb_* MCP tools for live Figma operations
- Run pnpm builds, type checks, tests in terminal
- Git operations (add, commit, status)
- Read/write all workspace files including .gcc/

## What This Agent Cannot Do

- Access Copilot's Persistent Memory directly (use .gcc/ files instead)
- Read other session's chat history
- Run background processes that persist after session end

## Build Session Learnings

<!-- CLAUDE AGENT: Append learnings from each build session below -->

### Session Template
```
### [Date] — [Task Summary]
- Files modified: [list]
- Patterns discovered: [list or "none"]
- Issues encountered: [list or "none"]
- Token-saving notes: [anything that should be pre-digested for next session]
```

### 2025-06-19 — Learning Engine + Build Pipeline + Tests + MCP Tools
- Files modified: core/learning/* (types, extractors, learner, synthesizer, generator), core/build/* (orchestrator, state), mcp-server/tools/* (learning-tools, build-tools, connection-tools), 10 test files
- Patterns discovered: study→learn→generate pipeline, StructuralFingerprint as universal interchange, esbuild required for mcp-server
- Issues encountered: CSS scope regex missing whitespace prefix for @media blocks, tsc OOM for mcp-server
- Token-saving notes: 216 tests passing, all 7 packages building, MCP tools dsb_study_and_learn + dsb_emergency_stop complete

### 2025-06-20 — E2E Test + Monorepo Build Verification
- Files modified: core/__tests__/integration/e2e-pipeline.test.ts (NEW), mcp-server/package.json (typecheck script)
- Patterns discovered: 3 diverse format sources produce 'low' confidence (correct behavior — structural disagreement); terminal output accumulates across runs
- Issues encountered: tsc --noEmit OOMs with 8GB heap for mcp-server (MCP SDK types too large)
- Token-saving notes: 238 tests (11 files), all 7 packages building, mcp-server uses esbuild not tsc, typecheck script updated to document OOM

### 2025-06-21 — Test Coverage Expansion (238→523 tests)
- Files modified: guardrails/__tests__/ (7 new files), orchestration-server/__tests__/server-integration.test.ts (NEW), figma-api/__tests__/figma-api.test.ts (NEW), updater/__tests__/ (5 new files)
- Patterns discovered: vi.mock('node:fs') doesn't work for ESM — use real filesystem with backup/restore; VS Code sandbox blocks listen() — test factory components not port binding; Figma API createVariable takes lowercase dsbType ("color" not "COLOR"); batchCreateVariables specs use .type not .resolvedType; createEffectStyle takes single ShadowConfig object
- Issues encountered: Terminal path quoting issues with spaces in workspace path
- Token-saving notes: 523 tests across 22 files in 5 packages

### 2025-06-22 — Final Test Gaps Closed (523→641 tests, ALL 8 packages)
- Files modified: mcp-server/__tests__/ (2 new files), licensing/__tests__/ (4 new files), builder-plugin/__tests__/ (2 new files), builder-plugin/package.json (added vitest)
- Patterns discovered: BridgeClient sendCommand/sendBatch throw on network errors (no try-catch) while all other methods catch→return null/false; builder-plugin has 31 commands not 28 (8 token + 5 style + 6 page + 6 node + 6 query); code.ts has module-level side effects requiring figma + __html__ globals mocked before import; vitest fake timers + advanceTimersByTimeAsync work well for interval-based polling; Mock McpServer pattern captures server.tool() registrations
- Issues encountered: Initial count mismatch (expected 28 commands, actual 31) — fixed
- Token-saving notes: 641 tests (42 files), ALL 8 packages tested and building, comprehensive handoff written with full gap analysis
