# Side-Kicks — Workspace Build Log
> Append-only history of workspace-level phases. Per-project build logs live in each project's `.gcc/commit.md`.

---

## 2026-05-22 | Phase: AI structure adoption

**Commits on `claude/heuristic-haslett-5438ae`:**
- `a67f2b9` docs: sync README to published v2.0.0 + clarify dual-license
- `2f82255` chore(security): harden public repo against supply-chain + workflow abuse
- `4318f94` fix(ci): move workflows to repo root so GitHub auto-discovers them (reverted in same branch — see decision log)

**What landed:**
- Verified worktree matches Figma Community plugin (1584331992332668732)
- Synced READMEs to published v2.0.0 (window size 1200×628, full feature list)
- Clarified dual licensing: MIT for source, Figma Community Free Resource License for distribution
- Added `.github/CODEOWNERS`, `.github/SECURITY.md`, `.github/dependabot.yml`, `.github/workflows/codeql.yml`
- Locked GitHub Actions `GITHUB_TOKEN` to workflow-scope `contents: read`
- Enabled branch protection on `main` via `gh api`: PR required + Code Owner + CodeQL + linear history + no force-push + no deletion
- Removed `ci.yml` + `release.yml` (no CI build pipeline needed for this workspace)
- Adopted Portfolio-style workspace structure: `AGENTS.md`, `CLAUDE.md` pointer, `.gcc/` at workspace root and inside `variables-styles-extractor/`

**Decisions:**
- **No CI for plugin builds.** Source is checked in pre-built (`code.js`, `ui.html`). CI overhead added no value for a single-maintainer Figma plugin. CodeQL stays for security scanning; Dependabot stays for dep updates.
- **Workflow path discovery bug.** Previously `ci.yml` lived at `variables-styles-extractor/.github/workflows/` which GitHub doesn't scan. Briefly fixed by moving to repo root, then removed entirely.
- **GHAS features unavailable.** Secret-scanning non-provider patterns and validity checks require GitHub Advanced Security (paid). PATCH calls succeeded (HTTP 200) but the flags stay disabled on free tier. Accepted limitation.
- **AGENTS.md is canonical, CLAUDE.md is a pointer.** Mirrors Portfolio.
- **Legacy `docs/AI_CONTEXT.md` + `docs/CHANGELOG.md` retained.** Per the project's protected-files rule, never delete — only rewrite.

**Outstanding follow-ups:**
- 66 Dependabot alerts on `main` (22 high / 40 moderate / 4 low) — triage pending
- `.gcc/` not yet initialised for `nectar-design-toolkit/` and `Design System Builder/` — pending
- `docs/AGENTS.md` and `docs/CLAUDE.md` in `variables-styles-extractor/` are now redirects pointing to the project root — keep for tooling compatibility

---
