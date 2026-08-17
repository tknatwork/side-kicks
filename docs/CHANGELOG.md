# Changelog: Side-Kicks

> ⚠️ PROTECTED FILE - DO NOT DELETE
> This file must NEVER be deleted during cleanup or overhaul operations.
> Instead, rewrite its contents to reflect the new direction.

This changelog tracks **folder-level structure changes only**.

For project-specific changes, see the project's own changelog:
- `variables-styles-extractor/docs/CHANGELOG.md`
- `natural-scroll-switch/CHANGELOG.md`

---

## [Unreleased] - natural-scroll-switch added

### Added
- **`natural-scroll-switch/`** — a new project folder: a macOS utility (Swift/SwiftPM) that switches
  "natural scrolling" to match the pointing device in use, shipped as a launchd user agent plus a
  double-clickable installer app. v1.0.0, MIT, macOS 12+.
- **Two workspace-level workflows**, `.github/workflows/natural-scroll-switch-ci.yml` and
  `-release.yml`, so `codeql.yml` is no longer the only workflow at the root. They are copies of
  `natural-scroll-switch/ci/*`, which stays the source of truth; the CI job diffs the two and fails on
  drift. The release job is tag-gated on `natural-scroll-switch-v*`.
- Root `README.md` (project table + repository layout), `AGENTS.md` (project table + scope rules) and
  `.github/copilot-instructions.md` updated to a multi-project workspace.

### Notes
- CodeQL is unchanged and still scans JavaScript/TypeScript only; `.github/codeql/codeql-config.yml`
  scopes analysis by explicit `paths:`, so the Swift sources are out of scope by construction.
- No new Dependabot ecosystem: the SwiftPM package has zero dependencies, and the existing
  `github-actions` entry at `/` already covers the new workflows' SHA-pinned actions.

---

## Workspace reduced to a single project

### Removed
- **`nectar-design-toolkit/`** and **`Design System Builder/`** were removed from the repository. The workspace now hosts a single active project, `variables-styles-extractor`.
- `.github/dependabot.yml` dropped the removed-project ecosystems; root `README.md`, `AGENTS.md`, and `docs/AI_CONTEXT.md` updated to the single-project layout.
- (Earlier entries below are retained as history.)

---

## [2.1.0] - 2025-12-27

### Added
- **New Project**: `nectar-design-toolkit/` - Multi-component design system orchestration suite
  - Migrated from `Portfolio/My Portfolio/_archive/NDS (planned)/AI_TOOLING/`
  - Components: figma-plugin, nds-builder, nectar-style-generator, orchestration-server, bridge-server, mcp-server

---

## [2.0.0] - 2025-12-27

### Changed
- **Multi-Project Architecture**: Restructured to support multiple isolated projects
- Added folder-level `docs/` for AI_CONTEXT.md and CHANGELOG.md
- Project context files moved to project root level

### Added
- `docs/AI_CONTEXT.md` - Folder-level context
- `docs/CHANGELOG.md` - This file (structure changes)
- `README.md` - Folder overview
- Project template documentation

---

## [1.0.0] - 2024-XX-XX

### Added
- Initial Side-Kicks repository
- `variables-styles-extractor/` project

---

## Changelog Scope

| Level | Tracks |
|-------|--------|
| **This file** | New projects, folder structure changes |
| **Project CHANGELOG** | Code changes, releases, features |

---

*Format based on [Keep a Changelog](https://keepachangelog.com/)*
