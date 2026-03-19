# Agent: recursing-wiles

> HOPE Level 1 — Per-Agent Scope and Session State
> This file is managed by the Claude Code agent running in the recursing-wiles worktree.
> Update it at every task boundary.

---

## Agent Identity

| Property | Value |
|----------|-------|
| Worktree | `recursing-wiles` |
| Branch | `claude/recursing-wiles` |
| Working Directory | `/Users/tusharkant/Github Project/design-docs/Side-Kicks/.claude/worktrees/recursing-wiles` |
| Assigned | 2025-12-27 |

---

## Scope (What This Agent Owns)

**Primary Package:** `packages/core/src/learning/`

**Specific subdirectories:**
- `core/src/learning/types.ts` — StructuralFingerprint interface and extractor types
- `core/src/learning/fingerprint-extractor.ts` — Base extractor class
- `core/src/learning/extractors/` — Individual source extractors (figma, css, etc.)
- `core/src/learning/learner.ts` — Pattern analysis (study -> learn phase)
- `core/src/learning/generator.ts` — DSB token generation (learn -> generate phase)

**Dependencies this agent needs from shared packages:**
- `Result<T, E>` type from `core/src/types.ts` (read-only, don't modify)
- `safeWriteFile`, `safeReadJson` from `@dsb/guardrails` (read-only)

**Files other agents must NOT modify while this agent is active:**
- `packages/core/src/learning/**` (entire learning subdirectory)

---

## Current Task (Level 1 — Session State)

**Phase:** Phase 1 — Structural Fingerprint Extraction Engine

**Status:** pending — awaiting implementation

**Completed:**
- (none yet — infrastructure setup was done by the main session, not this agent)

**In Progress:**
- Define `StructuralFingerprint` interface and extractor types

**Planned Sequence:**
1. `packages/core/src/learning/types.ts` — all types (StructuralFingerprint, ExtractorError, TokenExtractor interface)
2. `packages/core/src/learning/fingerprint-extractor.ts` — abstract base extractor
3. `packages/core/src/learning/extractors/figma-token-extractor.ts` — Figma JSON extractor
4. `packages/core/src/learning/extractors/css-token-extractor.ts` — CSS variable extractor
5. `packages/core/src/learning/index.ts` — exports
6. Run `pnpm exec tsc --noEmit` in packages/core/ to verify types
7. Run `pnpm run build` in packages/core/

---

## Patterns I've Established

*(None yet — append here when new patterns are created)*

---

## Blockers / Coordination Needed

- Need to review `workspace/context/ant-design-x-copy-learnings.md` before defining StructuralFingerprint shape
- No conflicts with other agents currently (all others idle)

---

## Session Startup Checklist for This Agent

1. Read `workspace/context/WORKFLOW.md` — role definitions
2. Read `workspace/context/PATTERNS.md` — coding conventions
3. Read `workspace/context/agent-registry.md` — verify no one else claimed core/src/learning/
4. Read `workspace/context/session-handoff.md` — main session state
5. Read THIS file — my scope and task state
6. Read `workspace/context/ant-design-x-copy-learnings.md` — study output
7. Call `dsb_check_connection` — verify plugin is live (if doing Figma operations)
8. Proceed with task

---

*Last Updated: 2025-12-27 (Session 1 — infrastructure setup)*
