# DSB 3-Tier Agent Workflow Protocol

> This file is read by ALL agents working on DSB.
> It defines the 3-tier architecture and when to use each tier.

---

## The 3 Tiers

### Tier 1: Claude Agent + @dsb-builder (PRIMARY — 90% of work)

**Session type:** "Claude" from VS Code session dropdown

**Custom agent:** `@dsb-builder` (`.github/agents/dsb-builder.agent.md`)

**What it does:** TypeScript source code, architecture reasoning, pnpm builds, git commits, type checking, AND dsb_* MCP tool calls for Figma operations. One session does everything.

**Tools it has:** workspace read/edit/search, terminal (pnpm, git, tsc), web, AND design-system-builder/* MCP tools

**Model:** Claude Opus 4.6 for architecture; Claude Sonnet 4.5 for routine building

**Billing:** GitHub Copilot Premium Requests (Pro plan: 300/month)

**Permissions:** Bypass all — no 25-request safety cap, continuous builds

### Tier 2: Copilot Local Session (SUPPORT — 5% of work)

**Session type:** "Local" from VS Code session dropdown

**What it does:** @workspace queries, Persistent Memory recall from Nectar/Side-Kicks builds, code review

**Model:** Claude Sonnet 4.5 (1x multiplier — cheapest)

**Billing:** Copilot Premium Requests (1x = most requests per credit)

**When to use:** When Tier 1 lacks architectural context that Copilot's Persistent Memory has from building the Nectar Design Toolkit

### Tier 3: Claude Code Extension Tab (OVERFLOW — 5% of work)

**Tab:** CLAUDE CODE (separate from CHAT panel)

**What it does:** dsb_* MCP tool execution, heavy Figma operation sequences, emergency builds

**Tools it has:** Full MCP access via `.vscode/mcp.json`, Claude Code native tools

**Billing:** Anthropic API per-token. Independent billing rail — doesn't affect Copilot budget.

**When to use:** When monthly Premium Requests run out, or for heavy Figma sequences that would burn too many Premium credits

---

## Two Shared Layers: .gcc/ (memory) + workspace/context/ (operations)

### .gcc/ — Git Context Controller (persistent memory)

Pre-digested knowledge that agents consume cheaply. Reading `.gcc/patterns/architecture.md` (~500 tokens) replaces re-reasoning from 50+ files (~6,500 tokens). **This is how flat-rate reasoning becomes a reusable asset for per-token agents.**

| Location | Purpose | Updated |
|----------|---------|---------|
| `.gcc/index.md` | Memory index — read FIRST | Per session end |
| `.gcc/patterns/architecture.md` | Pre-digested architecture | When architecture changes |
| `.gcc/patterns/conventions.md` | Pre-digested coding conventions | When new conventions adopted |
| `.gcc/patterns/decisions.md` | Decision log with rationale | Per decision |
| `.gcc/agents/{agent}.md` | Per-agent accumulated learnings | Per session end |
| `.gcc/sessions/{date}-{agent}.md` | Session transcripts | Per session end |
| `.gcc/knowledge/` | Domain knowledge (topic files) | As agents learn things |

### workspace/context/ — Operational State (active coordination)

| File | Written by | Read by | Purpose |
|------|-----------|---------|---------|
| `session-handoff.md` | Active agent | Next session (any tier) | HOPE Level 1 — task state |
| `WORKFLOW.md` (this file) | (setup) | All tiers | Role definitions |
| `PATTERNS.md` | Any tier | All tiers | Detailed conventions with code examples |
| `agent-registry.md` | Worktree agents | All agents | Package ownership map |
| `agents/[name].md` | Each agent | That agent | Per-agent scope + state |

### How They Relate

```
.gcc/patterns/conventions.md     ← SUMMARY (cheap to read, ~300 tokens)
workspace/context/PATTERNS.md    ← DETAILED (code examples, ~2,000 tokens)
```

Agents start by reading `.gcc/` for quick context. They reference `workspace/context/PATTERNS.md` only when they need specific code examples.

---

## Handoff Pattern: Claude Code -> Copilot

When Claude Code discovers a Figma API behavior that requires code changes:

1. Claude Code writes finding to `workspace/context/figma-api-notes.md`
2. Copilot reads the notes, updates the relevant package source
3. Copilot runs build, notifies Claude Code to re-test

---

## Session Start Checklist

### Tier 1 — Claude Agent (@dsb-builder) Session Start

1. Agent instructions auto-loaded (HOPE L4 + L2 in context)
2. Read `.gcc/index.md` — memory index
3. Read `.gcc/patterns/architecture.md` — cheap context (~500 tokens)
4. Read `.gcc/agents/claude-agent.md` — your accumulated learnings
5. Read `workspace/context/session-handoff.md` — Level 1 task state
6. Read `workspace/context/agent-registry.md` if touching shared packages

### Tier 2 — Copilot Local Session Start

1. copilot-instructions.md auto-loaded (Section A + B in context)
2. Read `.gcc/index.md` — memory index
3. `@workspace read workspace/context/session-handoff.md` — load Level 1 state
4. `@workspace What packages exist in DSB?` — trigger codebase re-index

### Tier 3 — Claude Code Tab Session Start

1. CLAUDE.md auto-loaded
2. Read `.gcc/patterns/architecture.md` — cheap context load (saves ~5,500 tokens)
3. Read `workspace/context/session-handoff.md` — current task state
4. Call `dsb_check_connection` — verify orchestration server + plugin
5. Proceed with dsb_* operations

### ALL Agents — Session End

1. Write session transcript to `.gcc/sessions/{date}-{agent}-{N}.md`
2. Update your agent file in `.gcc/agents/`
3. Update `.gcc/patterns/decisions.md` if decisions were made
4. Update `.gcc/index.md` session log table
5. Write `workspace/context/session-handoff.md` if at a phase boundary

---

*Last Updated: 2026-02-19*
