# Changelog: Side-Kicks

> ⚠️ PROTECTED FILE - DO NOT DELETE
> This file must NEVER be deleted during cleanup or overhaul operations.
> Instead, rewrite its contents to reflect the new direction.

This changelog tracks **folder-level structure changes only**.

For project-specific changes, see each project's `CHANGELOG.md`:
- `variables-styles-extractor/docs/CHANGELOG.md`

---

## [3.0.0] - 2026-06-06

### Removed
- **Project deletion**: `nectar-design-toolkit/` removed from the workspace.
  Multi-component design-system orchestration suite (figma-plugin,
  nds-builder, nectar-style-generator, orchestration-server, bridge-server,
  mcp-server). Discontinued before reaching a published release.
- **Project deletion**: `Design System Builder/` removed from the workspace.
  Claude-native Figma design system toolkit (pnpm workspace with
  builder-plugin and installer). Discontinued before reaching a published
  release.

### Changed
- Workspace collapses from three projects to one. `variables-styles-extractor/`
  is now the sole active project. The multi-project layout (subfolder per
  project, isolated lifecycles) is retained so future projects can land
  without restructuring.
- `README.md`, `AGENTS.md`, `docs/AI_CONTEXT.md` updated to reflect the
  single-project state and to record what was removed.
- `.github/dependabot.yml` cleaned: the 7 update entries scoped to the
  deleted projects were removed.

### Migration notes
- No data loss for active users — neither deleted project shipped a public
  release. Source remains in git history (commits `6ccb455`, `b83cce2`).
- Anyone with local clones should `git pull` to drop the deleted folders;
  no manual cleanup is required.

---

## [2.1.0] - 2025-12-27

### Added
- **New Project**: `nectar-design-toolkit/` - Multi-component design system orchestration suite
  - Migrated from `Portfolio/My Portfolio/_archive/NDS (planned)/AI_TOOLING/`
  - Components: figma-plugin, nds-builder, nectar-style-generator, orchestration-server, bridge-server, mcp-server
- *Reverted by [3.0.0] on 2026-06-06 — project deleted.*

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
