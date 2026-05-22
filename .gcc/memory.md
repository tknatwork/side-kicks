# Side-Kicks — Workspace Memory Index
> Local mirror of `~/MEMORY.md` scope, scoped to this workspace.
> Keep under 100 lines. Full rules in `AGENTS.md` (workspace) and per-project `AGENTS.md`.

---

## Source of Truth
- **Global rules:** `~/CLAUDE.md`
- **Workspace rules:** `AGENTS.md` (this folder)
- **Workspace session state:** `.gcc/session-memory.md`
- **Workspace build history:** `.gcc/commit.md`
- **Workspace agent registry:** `.gcc/main.md`
- **Per-project rules:** `<project>/AGENTS.md`
- **Per-project session state:** `<project>/.gcc/session-memory.md`

---

## Active Conflicts
| Date | Global Rule | Workspace Rule | Resolution |
|------|-------------|----------------|------------|
| — | — | — | — |

---

## Absorbed Global Updates
| Date | Change | Impact on Workspace |
|------|--------|---------------------|
| 2026-05-22 | Adopted Portfolio-style `AGENTS.md` + `.gcc/` pattern | Workspace + per-project structure changed; legacy `docs/AI_CONTEXT.md` and `docs/CHANGELOG.md` retained as protected files |

---

## Workspace-Specific Quick Reference

- [0.9] Public repo. Anyone can read; only collaborators push. Branch protection on `main` blocks force-push + deletion + non-Code-Owner-approved merge.
- [0.9] No CI build pipeline. Each project is responsible for its own build. CodeQL + Dependabot run at workspace level.
- [0.9] `pnpm` only. Never `npm`/`npx`.
- [0.9] AGENTS.md at every project root is the contract. `docs/AGENTS.md` redirects exist for tooling that hardcoded the legacy path.
- [0.7] Figma Community plugin distribution carries Figma's CFRL automatically; MIT applies to source. Two-tier licensing is intentional — see project READMEs.
- [0.5] 66 open Dependabot alerts on `main`. Not addressed in current branch; triage pending.
- [0.5] GHAS-only secret-scanning features (non-provider patterns, validity checks) are unavailable on the free public-repo tier. PATCH calls return 200 but the flags stay disabled.

---

## Pending Decisions
- [ ] When to triage the 66 Dependabot alerts — block-merge gate vs background sweep
- [ ] Whether to retire `docs/AI_CONTEXT.md` and `docs/CHANGELOG.md` once tooling stops hardcoding them, or keep indefinitely
