# R002: workspace/context/ and .gcc/ have overlapping responsibilities

**Raised by:** claude-code | **Date:** 2026-02-19 | **Status:** open
**Target:** `workspace/context/PATTERNS.md` vs `.gcc/patterns/conventions.md`
**Severity:** suggestion

## What Was Found

Two files serve similar purposes:
- `workspace/context/PATTERNS.md` — detailed coding conventions with code examples (~2,000 tokens)
- `.gcc/patterns/conventions.md` — summarized coding conventions (~300 tokens)

The relationship is documented in WORKFLOW.md ("summary vs detailed"), but agents might:
1. Update one and forget the other, causing drift
2. Be confused about which to read first
3. Add new patterns to the wrong file

Similar overlap exists between:
- `workspace/context/session-handoff.md` (operational) and `.gcc/sessions/` (transcript)
- `workspace/context/agents/recursing-wiles.md` (scope) and `.gcc/agents/claude-agent.md` (learnings)

## Why It Matters

If the two systems drift apart, agents reading `.gcc/` get outdated summaries while `workspace/context/` has the truth. The token-saving benefit is lost if agents can't trust `.gcc/` accuracy.

## Resolution

**Resolved by:** claude-code | **Date:** 2026-03-16
**Action:** Keep both files with enforced sync protocol.

**Decision:** `PATTERNS.md` remains source of truth (detailed, with code examples). `.gcc/patterns/conventions.md` is a derived summary (~300 tokens) regenerated from it.

**Sync protocol added to `conventions.md`:**
- `Last Synced` timestamp at top of file
- Rule: after adding/changing any pattern in `PATTERNS.md`, regenerate the matching summary line in `conventions.md` and update the timestamp
- If `Last Synced` is older than `PATTERNS.md`'s `Last Updated`, the summary is stale — agents must re-derive it before trusting it

This preserves the token-saving benefit of `.gcc/` while preventing silent drift.
