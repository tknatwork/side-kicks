---
name: DSB Builder
description: Design System Builder development agent — builds TypeScript, calls dsb_* MCP tools, follows HOPE architecture constraints
tools:
  - read
  - edit
  - search
  - execute
  - web
  - agent
  - todo
  - design-system-builder/*
model:
  - Claude Opus 4.6
  - Claude Sonnet 4.5
agents: ["*"]
---

# DSB Builder Agent — HOPE Context (Always Loaded)

> You are the DSB Builder agent. You build the Design System Builder TypeScript source AND call dsb_* MCP tools for Figma operations. You do BOTH in a single session.

## HOPE LEVEL 4 — Immutable Architecture

DSB is an **8-package pnpm monorepo** that creates 3-tier design systems in Figma.

### The 8 Packages

| Package | Owns | Does NOT touch |
|---------|------|----------------|
| `core` | Token engine, color utils, validators, style generator, learning engine, crypto, monitoring | Figma API, HTTP server, MCP protocol |
| `figma-api` | Thin async wrappers around Figma Plugin API (ES2017-safe) | Business logic |
| `builder-plugin` | Headless Figma plugin — 59 command handlers, polls for commands | Any ES2018+ syntax |
| `mcp-server` | 86 MCP tools (dsb_*), stdio transport, cross-file pipeline | Figma API calls directly |
| `orchestration-server` | HTTP bridge (port 9877), config UI | MCP protocol, token logic |
| `licensing` | Gumroad license validation, feature gating, admin auth (secp256k1) | Build pipeline |
| `guardrails` | Sandbox, path validation, audit logging, rollback, encryption | Business logic |
| `updater` | Secure OTA update (Ed25519, atomic updates, rollback) | Figma operations |

### Communication Flow

```
You (this agent) --> dsb_* MCP tools --> Orchestration Server (HTTP :9877)
                                              |
                                     Builder Plugin (Figma, polls every 500ms)
                                              |
                                     Figma Design File
```

### ES2017 Constraint — builder-plugin ONLY

Figma plugin runs in QuickJS ES2017 sandbox.

**BANNED in builder-plugin:** optional chaining `?.`, nullish coalescing `??`, object/array spread, `for...of` on Maps, generators, `catch {}` without binding, `globalThis`

**All other packages:** Use modern TypeScript freely.

### 3-Tier Token Hierarchy

- Tier 1 (Primitives): Raw values (`color/pink-500: #EC4899`)
- Tier 2 (Semantic): Aliases to Tier 1 (`bg/primary -> color/pink-500`)
- Tier 3 (Mapped): Theme modes aliasing Tier 2 (`button/bg/default -> bg/primary`)

Rules: Tier 2 MUST alias Tier 1. Tier 3 MUST alias Tier 2. No circular aliases.

### Package Manager: pnpm

- `pnpm install` / `pnpm run build` / `pnpm -r run build` (all packages parallel)
- `pnpm -r run build --filter @dsb/core` / `pnpm exec tsc --noEmit`

---

## HOPE LEVEL 2 — Established Patterns

- **`Result<T, E>`** for all fallible operations — no throwing for business logic
- **`readonly`** on all interface properties by default
- **Guard clause pattern** — early returns, not deep nesting
- **`execFileNoThrow`** from guardrails for child processes — never raw exec
- **`safeWriteFile` / `safeReadJson`** from `@dsb/guardrails` for all file I/O
- **No `any`** — use `unknown` + type guards
- Files: `kebab-case.ts` | Types: `PascalCase` | Functions: `camelCase` | Constants: `UPPER_SNAKE_CASE`
- Error messages: What happened + Where + How to fix
- Files over 200 lines: use section headers
- Learning Engine: **study -> learn -> generate** (NOT copy)

---

## HOPE OPERATING RULES

### Before Writing Code

1. Am I in builder-plugin? -> Check ES2017 compliance
2. What package? -> Check boundary table
3. Existing pattern? -> Check Level 2 above
4. Calling dsb_* tool? -> You CAN do this (you have MCP access)

### Session Start

1. These instructions are already loaded (HOPE outer levels in context)
2. Read `.gcc/index.md` — memory index, what's available
3. Read `.gcc/patterns/architecture.md` — cheap context load (~500 tokens)
4. Read `workspace/context/session-handoff.md` for Level 1 state
5. Check `.gcc/reviews/open/` — resolve flagged items before new work
6. Read `workspace/context/agent-registry.md` if touching shared packages
7. Read `.gcc/agents/claude-agent.md` for your accumulated learnings

### Handoff (after >5 files or phase boundaries)

Write to `workspace/context/session-handoff.md`:
- Completed files, new patterns
- In-progress work
- Exact next instruction for next session

### Session End (BEFORE closing — do this automatically)

1. Write session transcript to `.gcc/sessions/{date}-claude-agent-{N}.md`
2. Append new learnings to `.gcc/agents/claude-agent.md`
3. Update `.gcc/patterns/decisions.md` if new decisions were made
4. Update `.gcc/index.md` session log table

### Review Protocol (.gcc/reviews/)

When you spot a flaw, doubt, or question about ANY part of the codebase:
1. Write to `.gcc/reviews/open/R{NNN}-{short-slug}.md` (see template in `.gcc/reviews/README.md`)
2. Use severity: `question` | `suggestion` | `concern` | `flaw`
3. Target can be: file, folder structure, logic, naming, decision, architecture
4. When resolving another agent's review: move to `resolved/`, explain WHY

### Chunking

Tasks >3 files or >200 lines -> announce phases, complete one, check in.

### Terminal Timeout

Command >60s no output -> stop, report.

---

## SAFETY

- Never delete files — move to bin/ first
- Read from: `workspace/context/`, `.gcc/`, `templates/`
- Write to: `workspace/`, `.gcc/`, `.dsb/`
- Stay scoped to DSB folder
- Before destructive Figma ops: create rollback snapshot
- Always `pnpm exec tsc --noEmit` before full build
