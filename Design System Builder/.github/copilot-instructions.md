# DSB Copilot Instructions — HOPE Context Levels

> This file auto-loads every Copilot session via `chat.instructionsFilesLocations`.
> It IS the HOPE outer levels. Do not delete or summarize — it must load in full every session.
> Last Updated: 2025-12-27

---

## SECTION A — HOPE LEVEL 4: Immutable Architecture

> These constraints NEVER change within a project. Check them before writing any code.

### What DSB Is

Design System Builder (DSB) is an **8-package pnpm monorepo** toolkit that creates 3-tier design systems in Figma. Claude Code (CLAUDE CODE tab in VS Code) is the ONLY interface for live Figma operations. Copilot Chat (CHAT tab) builds the TypeScript source.

### The 8 Packages — Roles and Boundaries

| Package | Owns | Does NOT touch |
|---------|------|----------------|
| `core` | Token engine, color utils, validators, style generator, learning engine, crypto, monitoring, build state, telemetry | Figma API, HTTP server, MCP protocol |
| `figma-api` | Thin async wrappers around Figma Plugin API (ES2017-safe) | Business logic, token generation |
| `builder-plugin` | Headless Figma plugin — 59 command handlers, polls for commands, executes them | Any ES2018+ syntax (runs in QuickJS sandbox) |
| `mcp-server` | 86 MCP tools organized by category (incl. cross-file pipeline), stdio transport | Figma API calls (uses orchestration-server as bridge) |
| `orchestration-server` | HTTP bridge (port 9877), config UI serving, build status, tamper routes | MCP protocol, token logic |
| `licensing` | Gumroad license validation, feature gating, admin authentication (secp256k1) | Build pipeline, Figma operations |
| `guardrails` | Sandbox enforcement, path validation, audit logging, rollback, encryption | Business logic |
| `updater` | Secure OTA update system (Ed25519 signatures, atomic updates, rollback) | Figma operations |

### Architecture Communication Flow

```
User <-> Claude Code (CLAUDE CODE tab) <-> MCP Server (stdio)
                                          |
                                 Orchestration Server (HTTP, port 9877)
                                          |
                                 Builder Plugin (Figma, HTTP polling every 500ms)
                                          |
                                 Figma Design File
```

### ES2017 Constraint — builder-plugin Package ONLY

The Figma plugin runs in a **QuickJS sandbox limited to ES2017**.

**BANNED in builder-plugin:**
- `?.` (optional chaining)
- `??` (nullish coalescing)
- Object or array spread syntax
- `for...of` on Maps
- Generators
- `catch {}` without binding variable
- `globalThis`

**ALLOWED everywhere (including builder-plugin):**
- `async/await`, `Promise.all`, template literals
- Destructuring, `const/let`
- `Object.entries/keys/values`, `Array.includes/find/from`
- Arrow functions

Server-side packages (mcp-server, orchestration-server, core, etc.) have NO ES2017 restriction — use modern TypeScript freely.

### 3-Tier Token Hierarchy (Enforcement Rules)

| Tier | Collection | Purpose | Example |
|------|-----------|---------|---------|
| Tier 1: Primitives | Primitives | Raw atomic values | `color/pink-500: #EC4899` |
| Tier 2: Semantic | Semantic | Purpose-driven aliases -> Tier 1 | `bg/primary -> color/pink-500` |
| Tier 3: Mapped | Mapped | Theme modes -> Tier 2 | `button/bg/default -> bg/primary` |
| Tier 3b: Breakpoints | Breakpoints | Responsive modes | `font-size/heading-1: 48/36/28` |

**Non-negotiable rules:**
- Tier 2 MUST alias Tier 1 (never raw values)
- Tier 3 MUST alias Tier 2 (never Tier 1 directly)
- Circular aliases are forbidden
- Every variable must have scopes set correctly

### Shared Memory — .gcc/ + workspace/context/

Two shared locations, two purposes:

**`.gcc/` (Git Context Controller)** — Pre-digested persistent memory. Agents read this to load context cheaply (~500 tokens) instead of re-reasoning from scratch (~6,500 tokens). Updated at session end.

**`workspace/context/`** — Operational state. Active handoffs, agent registry, workflow protocol. Updated at phase boundaries.

Both are readable by ALL agents (Copilot, Claude agent, Claude Code tab).

### Role Separation — NON-NEGOTIABLE

| Tool | Role | What it NEVER does |
|------|------|-------------------|
| **Copilot CHAT tab** | TypeScript source code, builds, architecture reasoning | Call dsb_* MCP tools directly |
| **Claude Code tab** | Execute dsb_* MCP tools for live Figma operations | Write TypeScript source files |

The "Claude Code Only" rule in CLAUDE.md applies to **end-users running DSB** to create design systems. It does NOT restrict using Copilot to build DSB's source code.

### Package Manager: pnpm (not npm)

DSB is a monorepo. Always use pnpm:
- `pnpm install` — install workspace deps
- `pnpm run build` — build current package
- `pnpm -r run build` — build ALL packages recursively (parallel)
- `pnpm -r run build --filter @dsb/core` — build specific package
- `pnpm exec tsc` — TypeScript compiler in current package

---

## SECTION B — HOPE LEVEL 2: Established Patterns

> These conventions apply to ALL packages. Load these before implementing anything.
> If proposing a new pattern: announce it explicitly, wait for approval, then append it here.

### Code Quality Patterns

- **`Result<T, E>`** for all fallible operations — no throwing for business logic. Functions return `{ ok: true, value: T }` or `{ ok: false, error: E }`.
- **`readonly`** on all interface properties by default.
- **Guard clause pattern** — early returns, not deep nesting. Check preconditions at top of function, return early if invalid.
- **Use `execFileNoThrow` from guardrails** — shell injection prevention for all child process calls. Never use `exec()` or `execSync()`. The `execFileNoThrow` utility provides Windows compatibility, proper error handling, and structured output.
- **`safeWriteFile` / `safeReadJson`** from `@dsb/guardrails` for all file operations. Never use `fs.writeFile` directly in business code.
- **No `any`** — use `unknown` + type guards instead.

### Naming Conventions

- **Files**: `kebab-case.ts`
- **Types/Interfaces**: `PascalCase`
- **Functions/variables**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Packages**: `@dsb/package-name`

### File Organization

- Section headers for files over 200 lines
- One concern per file — don't mix token logic with file I/O
- Types in `types.ts` within each package's `src/`, re-exported from `index.ts`

### Error Messages

Every error must include:
1. **What happened** — "Failed to create variable collection"
2. **Where** — "in dsb_create_tier1_primitives"
3. **How to fix** — "Verify the plugin is connected: curl http://localhost:9877/status"

### Learning Engine Pattern (core/src/learning/)

**study -> learn -> generate** — NOT copy.
- `study()`: Extracts structural fingerprint from a source design system
- `learn()`: Analyzes fingerprints, builds token vocabulary and naming conventions
- `generate()`: Creates DSB-native token structure inspired by learned patterns

The `StructuralFingerprint` interface is the core data structure — every extractor produces one, every learner consumes one.

<!-- APPEND NEW PATTERNS BELOW THIS LINE -->

---

## SECTION C — HOPE OPERATING RULES: Self-Management Protocol

> These are the rules that prevent catastrophic forgetting and session drift.
> Follow them without being asked.

### Pre-Code Constraint Checks (do this BEFORE writing any code)

1. **Am I writing builder-plugin code?** -> Check every line for ES2017 violations (spread, optional chaining, nullish coalescing)
2. **What package does this belong in?** -> Check the package boundary table in Section A. Don't put Figma logic in core, don't put file I/O in builder-plugin.
3. **Does an established pattern already cover this?** -> Check Section B before inventing a new approach.
4. **Am I about to call a dsb_* MCP tool?** -> STOP. Only the Claude Code tab does that. Write the TypeScript that the MCP tool will call, not the MCP tool call itself.

### Session Bootstrap (do this at the START of every new session)

1. This file auto-loads (Section A + B are now in context)
2. Read `.gcc/index.md` — memory index, points to pre-digested knowledge
3. Read `.gcc/patterns/architecture.md` — cheap context load (~500 tokens vs ~6,500)
4. Read `workspace/context/session-handoff.md` — loads Level 1 session state
5. Check `.gcc/reviews/open/` — resolve any flagged items before new work
6. Ask `@workspace` a DSB-specific question to re-index: `"@workspace What packages exist in DSB and what does each own?"`
7. Now proceed with the task

### Handoff Ritual (do this at PHASE BOUNDARIES and after writing >5 files)

Write `workspace/context/session-handoff.md` with:
- What was completed (files written, new patterns established)
- What is in progress (file, status of partial implementation)
- Next step (exact instruction to give Copilot next session)
- Blockers / decisions pending

Then offer to start a fresh chat.

### Session Export to .gcc/ (do this BEFORE ending every session)

At the END of every session, without being asked:

1. **Write session transcript** to `.gcc/sessions/{date}-{agent}-{N}.md`:
   - What was discussed, decided, and built
   - Key decisions with rationale
   - Patterns discovered or established

2. **Update your agent file** (`.gcc/agents/copilot.md`):
   - Append any new learnings under the relevant section
   - Note any Figma API behaviors, build issues, or architectural insights

3. **Update `.gcc/patterns/decisions.md`** if any new decisions were made:
   - Append with format: Decision + Rationale + Date + Alternatives

4. **Update `.gcc/index.md`** session log table with this session's entry

This ensures Claude agents can read your accumulated knowledge cheaply in future sessions.

### Review Queue Protocol (.gcc/reviews/)

**At session start:** Check `.gcc/reviews/open/` for unresolved items. Prioritize resolving them before new work — they represent doubts another agent flagged about the codebase.

**During work:** When you spot something questionable (logic flaw, naming inconsistency, structural issue, missing rationale for a decision), write a review item to `.gcc/reviews/open/R{NNN}-{short-slug}.md` using the template in `.gcc/reviews/README.md`.

**When resolving:** Move the file from `open/` to `resolved/`. Add the resolution section explaining WHY the current approach is correct, or describe what was changed to fix it. The resolution becomes permanent "why" documentation — more valuable than code comments.

**Severity levels:**
- `question` — curious, no urgency
- `suggestion` — could be better, not blocking
- `concern` — probably wrong, should investigate
- `flaw` — definitely wrong, must fix before next build

### Context Budget Rule

- Section A + B = compact summaries (< 5K tokens). They load FIRST, always.
- If context is tight: compress session-handoff.md content — NEVER drop Section A or B.
- Pattern: outer levels survive session boundaries; inner levels (session notes) are compressible.

### Chunking Rule

Tasks touching >3 files OR >200 lines total -> break into phases upfront:
1. Announce the phases before starting
2. Complete one phase fully
3. Check in with user before starting next phase

Never start implementing a large task as one continuous stream.

### Terminal Timeout Rule

Any terminal command running >60 seconds with no output -> stop it immediately and report:
"Stopped [command] after 60s with no output — was it stuck? Last output: [last output line]"

Never wait indefinitely for a build, install, or test command.

### Pattern Evolution Protocol

1. You notice a repeated pattern not in Section B
2. Announce: "I'm about to establish a new pattern: [description]. Should I add this to Section B?"
3. Wait for user approval
4. If approved: add it to Section B of THIS file + note it in the session handoff

---

## SECTION D — SAFETY RULES

> These protect the project structure. They apply always.

### File Safety

- **Never delete files** — move to bin/ first before removing
- **Protected files** (rewrite, never delete): `CLAUDE.md`, `copilot-instructions.md`, `TASKS.md`, `AI_CONTEXT.md`, `CHANGELOG.md`

### Sandbox Rules (from CLAUDE.md)

- Read files ONLY from `workspace/context/`, `.gcc/`, and `templates/`
- Write files ONLY to `workspace/`, `.gcc/`, and `.dsb/`
- Never search outside the DSB project folder
- Never access `.env` files or credentials
- Before any destructive Figma operation (delete variables, clear styles): create rollback snapshot first
- Log every file operation to `workspace/reports/audit.log`

### Project Isolation

- Stay scoped to DSB folder — never touch other Side-Kicks projects
- Never modify files in sibling projects (variables-styles-extractor, etc.)

### Build Safety

- Always run `pnpm exec tsc --noEmit` to check types before a full build
- Always run `pnpm run build` in staging before swapping during updates
- If a build fails: report the exact error + file + line

---

*LIVING DOCUMENT: Section B is append-only (new patterns added at bottom).*
*Sections A and D are IMMUTABLE — never modify them.*
