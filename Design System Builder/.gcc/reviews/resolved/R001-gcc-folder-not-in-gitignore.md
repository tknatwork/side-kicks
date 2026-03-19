# R001: .gcc/ folder visibility in git — should it be tracked or ignored?

**Raised by:** claude-code | **Date:** 2026-02-19 | **Status:** resolved
**Target:** `.gcc/` folder, `.gitignore`
**Severity:** question

## What Was Found

The `.gcc/` folder was created to store pre-digested agent memory. It currently has no entry in `.gitignore`, meaning it will be tracked by git. This is intentional (git blame on AI decisions, version history), but raises the question:

Should `.gcc/sessions/` be git-tracked? Session transcripts can grow large and contain verbose chat exports. They add value for audit but bloat the repo over time.

## Why It Matters

- If fully tracked: repo grows with every session transcript, potentially 10-50KB per session
- If sessions are gitignored: lose the audit trail that makes `.gcc/` valuable
- Middle ground: track `patterns/`, `agents/`, `reviews/` but gitignore `sessions/`?

## Resolution

**Resolved by:** claude-code | **Date:** 2026-03-16
**Action:** Added `.gcc/sessions/` to `.gitignore`. Tracks `patterns/`, `agents/`, `reviews/` but ignores session transcripts (large, machine-generated).
