# Side-Kicks — Workspace Changelog
> Records structural changes at the workspace level (new projects, AI-doc structure, security posture).
> Code-level changes live in each project's `docs/CHANGELOG.md` (or per-project `.gcc/changelog.md` going forward).

---

## 2026-05-22 — AI structure adoption + security hardening

**What changed:**
- Adopted Portfolio-style AI documentation structure: `AGENTS.md` (canonical) + `CLAUDE.md` (pointer) at workspace root and inside `variables-styles-extractor/`.
- Created workspace-level `.gcc/` folder with `session-memory.md`, `metadata.yaml`, `main.md`, `memory.md`, `commit.md`, `changelog.md`.
- Created plugin-level `.gcc/` folder under `variables-styles-extractor/` with the same six files.
- Promoted `variables-styles-extractor/docs/AGENTS.md` → `variables-styles-extractor/AGENTS.md`; original path retained as a redirect (per protected-files rule).
- Promoted `variables-styles-extractor/docs/CLAUDE.md` → `variables-styles-extractor/CLAUDE.md`; original path retained as a redirect.
- Added `.github/SECURITY.md`, `.github/CODEOWNERS`, `.github/dependabot.yml`, `.github/workflows/codeql.yml`.
- Removed `.github/workflows/ci.yml` and `.github/workflows/release.yml` (no CI build pipeline needed).
- Updated `variables-styles-extractor/LICENSE` with a notice clarifying MIT applies to source, Figma Community Free Resource License applies to the Figma platform distribution.

**Potential conflicts:**
- Tooling that hardcoded `variables-styles-extractor/docs/AGENTS.md` or `variables-styles-extractor/docs/CLAUDE.md` continues to work via the redirect files; no change required.
- The protected-files rule from `docs/AI_CONTEXT.md` still applies. All retired paths must be rewritten as redirects rather than deleted.

**Migration notes for AI builders:**
- New canonical entry point at workspace root is `AGENTS.md`. Read that first when entering this repo.
- When working inside `variables-styles-extractor/`, switch to its own `AGENTS.md`.
- Warm-start state lives at `.gcc/session-memory.md` (workspace) and `<project>/.gcc/session-memory.md` (project).
