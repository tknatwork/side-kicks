<!-- === SYSTEM PAIRING ===
Consumed by: Claude Code (legacy path), tooling that hardcodes CLAUDE.md
Updated by: never (this is a redirect)
Pairs with: AGENTS.md (canonical)
=== END PAIRING === -->

# CLAUDE.md — pointer

> **The canonical AI-instruction file is [AGENTS.md](AGENTS.md).** Follow that.
>
> This file is a pointer for Claude Code's built-in file lookup and any
> tooling that still hardcodes the legacy path.
>
> AGENTS.md is the [Sourcegraph universal convention](https://agents.md).
> All builder LLMs (Claude Code, Cursor, Copilot, Aider, Continue, Gemini CLI, Codex) should read it.
>
> **Do NOT add content here.** Edits to AI-builder rules belong in [AGENTS.md](AGENTS.md).
>
> ---
>
> **Read order for new sessions:**
>
> 1. [AGENTS.md](AGENTS.md) — Canonical workspace AI rules
> 2. `.gcc/session-memory.md` — Warm-start state from prior session
> 3. Per-project `AGENTS.md` (e.g. [`variables-styles-extractor/AGENTS.md`](variables-styles-extractor/AGENTS.md)) when working inside a project
