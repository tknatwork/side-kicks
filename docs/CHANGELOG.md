# Changelog: Side-Kicks

> ⚠️ PROTECTED FILE - DO NOT DELETE
> This file must NEVER be deleted during cleanup or overhaul operations.
> Instead, rewrite its contents to reflect the new direction.

This changelog tracks **folder-level structure changes only**.

For project-specific changes, see each project's changelog:
- `variables-styles-extractor/docs/CHANGELOG.md`
- `creativia/docs/CHANGELOG.md`

---

## [Unreleased] - New project: CREATIVIA (design case study)

### Added
- **`creativia/`** — CREATIVIA, an AI creative co‑pilot for musicians, captured as a
  structured case study from the [Lollypop Designathon 2025](https://lollypop.design/designathon-2025/)
  (Team 6, Musician persona). Content‑first scaffold: README case study, `docs/CASE_STUDY.md`,
  `docs/BRAND.md`, `docs/ROADMAP.md`, an optimised screen gallery in `assets/screens/`, plus the
  standard project files (`AGENTS.md`, `CLAUDE.md`, `LICENSE`, redirects, Copilot + issue templates).
  A working demo for the portfolio is planned (see the project roadmap).
- The workspace now hosts **two active projects** of different types: a Figma plugin
  (`variables-styles-extractor/`) and a design case study (`creativia/`).

### Changed
- Root `README.md` and `AGENTS.md` updated from the single‑project layout to a
  two‑project layout (Projects table, repository layout tree, project‑scope rules,
  and "what this repo is" framing now includes design case studies).

---

## [Previous] - Workspace reduced to a single project

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
