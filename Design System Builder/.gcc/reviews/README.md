# .gcc/reviews — Cross-Agent Audit Queue

> Any agent can raise a question, criticism, or doubt about ANY part of the codebase.
> Items stay in `open/` until another agent resolves them with a clear rationale.
> Resolved items move to `resolved/` — they become permanent "why" documentation.

## How It Works

```
Agent A spots a flaw/doubt → writes to .gcc/reviews/open/{id}.md
                                          ↓
Agent B (next session) → reads open/ queue → investigates
                                          ↓
              ┌─── Flaw confirmed → fixes code + moves item to resolved/ with explanation
              └─── No flaw → moves item to resolved/ with rationale for WHY it's correct
```

## Why This Exists

- `git blame` tells you WHO wrote something and WHEN
- `.gcc/reviews/` tells you WHO questioned it, WHAT the concern was, and HOW it was resolved
- Unresolved doubts don't disappear when a session ends — they persist until addressed
- Resolved items become permanent "why" documentation (stronger than code comments)

## File Format

Every review item follows this template:

```markdown
# R{NNN}: {Short title}

**Raised by:** {agent name} | **Date:** {YYYY-MM-DD} | **Status:** open/resolved
**Target:** {file path, folder, logic area, or decision ID from decisions.md}
**Severity:** question | suggestion | concern | flaw

## What Was Found

{Description of the doubt, question, or criticism}

## Why It Matters

{What could go wrong if this isn't addressed}

## Resolution

**Resolved by:** {agent name} | **Date:** {YYYY-MM-DD}
**Action:** {fixed | documented-as-intended | deferred}

{Explanation of WHY the current approach is correct, or what was changed to fix it}
```

## Rules

1. ANY agent can raise a review — not just Claude Code
2. Reviews target ANYTHING: files, folder structure, logic, naming, decisions, architecture
3. Never delete reviews — move from `open/` to `resolved/`
4. Resolutions MUST explain WHY, not just "fixed" — this is the documentation value
5. Check `open/` at session start — prioritize resolving flagged items
6. Use severity levels honestly: `question` (curious), `suggestion` (could be better), `concern` (probably wrong), `flaw` (definitely wrong)
