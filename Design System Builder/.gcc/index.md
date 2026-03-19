# .gcc Memory Index

> Read this FIRST at every session start. It tells you what's available and what's current.
> Last updated: 2026-03-16

## Quick Context Load (read these 3 files = full project understanding)

1. **`.gcc/patterns/architecture.md`** — What DSB is, how it's structured, key constraints
2. **`.gcc/patterns/conventions.md`** — Coding patterns every agent must follow
3. **`.gcc/patterns/decisions.md`** — Why things are the way they are (D001-D007)

## Open Reviews (check and resolve before new work)

| ID | Severity | Target | Summary |
|----|----------|--------|---------|
| ~~R001~~ | ~~question~~ | ~~`.gcc/`, `.gitignore`~~ | ~~Resolved 2026-03-16: `.gcc/sessions/` added to `.gitignore`~~ |
| ~~R002~~ | ~~suggestion~~ | ~~`PATTERNS.md` vs `.gcc/patterns/`~~ | ~~Resolved 2026-03-16: sync protocol with `Last Synced` timestamp~~ |
| ~~R003~~ | ~~concern~~ | ~~3-tier architecture~~ | ~~Resolved 2026-03-16: billing confirmed, MCP connectivity deferred to integration testing~~ |
| ~~R004~~ | ~~flaw~~ | ~~`builder-plugin/src/polling.ts`~~ | ~~Resolved 2026-03-16: already fixed — polling.ts is types-only, UI iframe handles HTTP~~ |
| ~~R005~~ | ~~concern~~ | ~~`code.ts`, `build-orchestrator.ts`~~ | ~~Resolved 2026-03-16: added batch handlers + fixed orchestrator command names~~ |
| ~~R006~~ | ~~flaw~~ | ~~`package.json` root scripts~~ | ~~Resolved 2026-03-16: already fixed — broken scripts removed~~ |
| ~~R007~~ | ~~concern~~ | ~~`tsconfig.base.json`~~ | ~~Resolved 2026-03-16: already fixed — stale alias removed~~ |
| ~~R008~~ | ~~flaw~~ | ~~`build-tools.ts`~~ | ~~Resolved 2026-03-16: already fixed — budget check implemented correctly~~ |
| ~~R009~~ | ~~concern~~ | ~~`setup-tools.ts`~~ | ~~Resolved 2026-03-16: extracted to `MANIFEST_SIGNING_SECRET` constant~~ |
| R010 | suggestion+ | All 8 packages | **Positive:** 42 test files, 641 tests, strong patterns. See file for gaps. |

### All blockers resolved

R001–R009 resolved on 2026-03-16. Only R010 (positive assessment) remains open.
See `.gcc/reviews/resolved/` for full details.

## Current State

- **Architecture:** 8-package pnpm monorepo, 3-tier agent workflow (Claude agent primary)
- **Codebase:** 102 source files, ~24,600 lines production TypeScript (7 pipeline + 1 batch-handlers)
- **Tests:** 256 tests passing across all 8 packages (0 failures) — 16/16 test tasks pass
- **Build:** All 8 packages compile (mcp-server uses esbuild, rest use tsc), plugin bundle 31.9kb
- **MCP Tools:** 86 total (79 original + 5 pipeline + 2 file-role)
- **Plugin Commands:** 61 total (57 original + 2 role handlers + 2 batch handlers)
- **Active agents:** DSB Builder (Claude agent via @dsb-builder)
- **Branch:** `claude/priceless-lehmann` on `tknatwork/side-kicks`
- **Last session:** 2026-03-16 — Cross-file Figma pipeline implementation complete (Phase 1 + 2)

## Agent Memory Files

| Agent | File | Last Updated | Summary |
|-------|------|-------------|---------|
| Copilot Local | `.gcc/agents/copilot.md` | 2026-02-19 | Nectar/Side-Kicks patterns, orchestration knowledge |
| Claude Code tab | `.gcc/agents/claude-code.md` | 2026-02-19 | MCP tool execution patterns, Figma API learnings |
| Claude agent (Tier 1) | `.gcc/agents/claude-agent.md` | 2026-02-22 | Primary builder context, 6 sessions of learnings |

## Session Log

| Date | Agent | File | Key Outcome |
|------|-------|------|-------------|
| 2026-02-19 | Claude Code | `.gcc/sessions/2026-02-19-claude-code-01.md` | HOPE architecture, .gcc setup, 3-tier workflow, pnpm transition |
| 2025-06-19 | Claude Agent | (inline in session-handoff) | Learning Engine 3 phases, Build Pipeline, DTCG extractor, 216 tests, MCP tools |
| 2025-06-20 | Claude Agent | `.gcc/sessions/2025-06-20-claude-agent-01.md` | E2E test (22), monorepo build all 7 packages, 238 total tests |
| 2025-06-21 | Claude Agent | (inline in session-handoff) | Test expansion: guardrails, orch-server, figma-api, updater — 523 tests |
| 2025-06-22 | Claude Agent | (inline in session-handoff) | Final gaps: mcp-server, licensing, builder-plugin — 641 tests, ALL 8 packages tested |
| 2026-03-16 | Claude Code | (via Portfolio project) | SouthLeft merge (79 tools), Supernova token sync, cross-file pipeline plan + impl |
| 2026-03-16 | Claude Code | (via Portfolio project) | Cross-file pipeline complete: 7 new files, 5 modified, 86 tools, 59 commands, build+tests pass |

## Relationship to Other Context Files

| Location | Purpose | Update Frequency |
|----------|---------|-----------------|
| `.gcc/` (here) | Pre-digested memory — cheap to consume | Per session end |
| `workspace/context/session-handoff.md` | **Comprehensive project state + suggested next actions** | Per phase boundary |
| `copilot-instructions.md` | HOPE outer levels — auto-loaded by Copilot | Rarely (architecture changes) |
| `dsb-builder.agent.md` | Claude agent instructions — auto-loaded | Rarely (agent config changes) |
| `CLAUDE.md` | Claude Code tab instructions — auto-loaded | Rarely |
