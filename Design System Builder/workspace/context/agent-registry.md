# DSB Agent Registry — WHO OWNS WHAT

> Read this BEFORE writing any file in ANY package.
> If a package is claimed by another agent, coordinate via that agent's file before modifying it.
> Claiming a package = adding your worktree to the table below.

---

## Active Agents

| Worktree | Branch | Claimed Packages | Status | Last Updated |
|---|---|---|---|---|
| recursing-wiles | claude/recursing-wiles | core/src/learning | pending | 2025-12-27 |
| lzu | — | unassigned | idle | — |
| odi | — | unassigned | idle | — |
| rdh | — | unassigned | idle | — |
| vlr | — | unassigned | idle | — |

---

## Package Ownership Rules

### Before Writing to ANY Package:

1. Check this table — is the package already claimed?
2. **If unclaimed:** Add your worktree name to the table (update this file), then proceed
3. **If claimed by another active agent:** Read that agent's file at `workspace/context/agents/[their-name].md` before touching the package
4. **If claimed but agent is idle:** You can claim it — update the table

### Shared Packages (Everyone Can Read, Coordinate Before Writing)

These packages are used by all agents — modify only if your task specifically requires it, and announce the change in your agent file first:

| Package | Why It's Shared | Coordination Required |
|---------|----------------|----------------------|
| `core/src/types.ts` | `Result<T,E>` and shared type definitions | Yes — any type change affects all agents |
| `core/src/index.ts` | Public API surface of core package | Yes — new exports affect consumers |
| `packages/guardrails` | All file I/O goes through here | Yes — changing safeWriteFile affects everything |
| `tsconfig.base.json` | TypeScript config inherited by all packages | Yes — breaking changes affect all builds |
| `pnpm-workspace.yaml` | Monorepo package declarations | Yes — adding/removing packages |

### Claiming Protocol

To claim a package:
1. Edit this file — add your worktree to the table with your package(s)
2. Update your agent file at `workspace/context/agents/[your-worktree].md` with your scope
3. Start work

To release a package:
1. Update your status to "idle" in this table
2. Update your agent file — mark task as complete

---

## Full Package Map

| Package Path | Package Name | Depends On |
|-------------|--------------|-----------|
| `packages/core` | `@dsb/core` | (none — foundational) |
| `packages/figma-api` | `@dsb/figma-api` | (none — Figma Plugin API only) |
| `packages/guardrails` | `@dsb/guardrails` | `@dsb/core` |
| `packages/licensing` | `@dsb/licensing` | `@dsb/core`, `@dsb/guardrails` |
| `packages/orchestration-server` | `@dsb/orchestration-server` | `@dsb/core`, `@dsb/guardrails`, `@dsb/licensing` |
| `packages/mcp-server` | `@dsb/mcp-server` | `@dsb/core`, `@dsb/guardrails`, `@dsb/licensing`, `@dsb/orchestration-server` |
| `packages/builder-plugin` | `@dsb/builder-plugin` | `@dsb/figma-api` |
| `packages/updater` | `@dsb/updater` | `@dsb/core`, `@dsb/guardrails` |

**Build order (respect dependency chain):**
1. `core` + `figma-api` (can be parallel)
2. `guardrails`
3. `licensing`
4. `orchestration-server` + `builder-plugin` (can be parallel)
5. `mcp-server` + `updater` (can be parallel)

---

## Conflict Resolution

If two agents need the same package simultaneously:

1. **Read the other agent's file** (`workspace/context/agents/[their-name].md`) — do their tasks actually conflict, or are they working on different sub-folders?
2. **Often not a conflict:** One agent may be in `core/src/learning/`, another in `core/src/crypto/` — both can proceed safely
3. **True conflict (same file):** The agent that claimed first has priority. The second agent writes their needed types/interfaces as a separate proposal file in `workspace/context/proposals/[feature].md` and notes the dependency
4. **Escalation:** If coordination is needed, both agents write their status to `workspace/context/coordination/[date]-conflict.md` and the user resolves it

---

*Append-only table. Never remove entries — change status to "idle" instead.*
*Last Updated: 2025-12-27*
