# Session Memory — Side-Kicks workspace (claude/heuristic-haslett-5438ae)
> Hope Architecture — Medium Layer
> Warm-start context for the workspace itself. Per-project state lives in each project's own `.gcc/session-memory.md`.

---

## Last Updated
2026-05-22

---

## Slow Layer Ref (What to load from AGENTS.md)
- P0 (always needed): "Project scope rules", "File-protection rules", "Security posture"
- P1 (loaded when adding a project): "Adding a new project"
- P2 (loaded when investigating CI/security): "Security posture" + `.github/SECURITY.md`

---

## Medium Layer — Current State
- **Phase:** Workspace AI structure adoption (Portfolio-style AGENTS.md + `.gcc/`)
- **Last commit:** `4318f94` fix(ci): move workflows to repo root so GitHub auto-discovers them (now superseded — workflows removed per "no CI" decision)
- **Open PRs / branches:** PR #2 (`claude/heuristic-haslett-5438ae` → `main`) — docs + security hardening, in progress
- **Branch protection on `main`:** active. Requires PR + Code Owner review + CodeQL pass + no force-push + no deletion + linear history. CI requirement dropped (no build pipeline).

---

## Last Session (Fast → Medium flush)
### What Was Done
- Verified worktree contents match Figma Community plugin 1584331992332668732
- Synced both READMEs to published v2.0.0 (window size, slug, feature list)
- Clarified dual-license model (MIT source + Figma CFRL distribution)
- Added security hardening: SECURITY.md, CODEOWNERS, dependabot.yml, CodeQL workflow
- Locked workflow-scope GITHUB_TOKEN to read-only (`permissions: contents: read`)
- Applied branch protection on `main` via `gh api`
- Enabled secret scanning + push protection + Dependabot security updates at repo settings (the extras — non-provider patterns, validity checks — require GHAS, unavailable on free tier)
- Diagnosed pre-existing CI bug (workflows lived under `variables-styles-extractor/.github/workflows/` which GitHub does not discover); fixed by moving to root + adding `working-directory`; then per user direction removed CI entirely (no build pipeline needed for this Figma plugin)
- Restructured AI docs to Portfolio pattern: `AGENTS.md` + `CLAUDE.md` at workspace root and at plugin root; `.gcc/` folders created

### Key Decisions Made
- **No CI for plugin builds.** The Figma plugin source is checked in pre-built (`code.js`, `ui.html`); a CI build pipeline added overhead without value for a single-maintainer repo.
- **CodeQL stays.** Weekly security scan is high-value on a public repo.
- **AGENTS.md at every project root.** Legacy `docs/AGENTS.md` and `docs/CLAUDE.md` become redirects so tooling that hardcoded those paths still works.
- **Workspace-level `.gcc/` AND per-project `.gcc/`.** Workspace tracks structural changes; project tracks code changes.

### Active Blockers
- 66 open Dependabot alerts on `main` (22 high / 40 moderate / 4 low) — not addressed in this branch.

---

## Next Step (Fast Layer Seed)
Land PR #2 (docs + security + AI structure). After merge:
1. Triage the 66 Dependabot alerts on `main` — group by severity, apply Dependabot PRs in batches.
2. Add Figma Community Free Resource License clarification to `nectar-design-toolkit/` README if/when that project publishes.

---

## Prior Sessions (rolling log — keep last 5)
| Date | Summary |
|------|---------|
| 2026-05-22 | First workspace-level session — established AGENTS.md + `.gcc/` structure, security hardening, license clarification |
