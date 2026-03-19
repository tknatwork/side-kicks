# Copilot Instructions: Side-Kicks

> ⚠️ PROTECTED FILE - DO NOT DELETE
> This file must NEVER be deleted during cleanup or overhaul operations.
> Instead, rewrite its contents to reflect the new direction.

---

## Folder Purpose

**Side-Kicks** is a multi-project workspace for Figma plugins and design tools. Each project is isolated in its own subfolder.

---

## 🗑️ Bin Folder (Fail-Safe)

Before deleting any file, move it to `../bin/` first:
```bash
# Instead of: rm file.md
# Do: mv file.md ../../bin/
```

---

## Folder Structure

```
Side-Kicks/
├── .github/
│   ├── copilot-instructions.md      ← THIS FILE (folder rules)
│   └── ISSUE_TEMPLATE/              ← Shared GitHub templates
├── docs/
│   ├── AI_CONTEXT.md                ← Folder context (PROTECTED)
│   └── CHANGELOG.md                 ← Structure changes (PROTECTED)
├── variables-styles-extractor/      ← PROJECT: Figma Plugin
│   ├── AI_CONTEXT.md                ← Project context (PROTECTED)
│   ├── CHANGELOG.md                 ← Project history (PROTECTED)
│   ├── TASKS.md                     ← Task tracking (PROTECTED)
│   ├── .github/copilot-instructions.md
│   ├── docs/
│   └── src/
└── README.md
```

---

## ⚠️ CRITICAL RULES

### Protected Files

**Folder-Level** (never delete, rewrite instead):
- `.github/copilot-instructions.md` (this file)
- `docs/AI_CONTEXT.md`
- `docs/CHANGELOG.md`

**Project-Level** (each project has its own):
- `AI_CONTEXT.md`
- `CHANGELOG.md`
- `TASKS.md`
- `.github/copilot-instructions.md`

### Changelog Scope
| Level | Tracks |
|-------|--------|
| `docs/CHANGELOG.md` | New projects, folder structure changes |
| `[project]/CHANGELOG.md` | Code changes, releases within project |

### Project Isolation
- **Each project** lives in its own subfolder
- **NEVER mix** files from different projects
- **Stay scoped** - Identify which project before making changes

---

## Current Projects

### variables-styles-extractor/
| Property | Value |
|----------|-------|
| **Purpose** | Figma plugin to export/import variables & styles |
| **Status** | Active - Published on Figma Community |
| **Context** | `variables-styles-extractor/AI_CONTEXT.md` |
| **Tasks** | `variables-styles-extractor/TASKS.md` |

---

## Project Template

When creating a new project:

```
[project-name]/
├── AI_CONTEXT.md       ← Project context (PROTECTED)
├── CHANGELOG.md        ← Project history (PROTECTED)
├── TASKS.md            ← Task tracking (PROTECTED)
├── README.md           ← Public documentation
├── .github/
│   ├── copilot-instructions.md
│   └── workflows/
├── docs/               ← Additional documentation
└── src/                ← Source code
```

---

## Guidelines for AI Assistants

### DO:
1. ✅ Identify which project you're working in first
2. ✅ Read project's `AI_CONTEXT.md` before making changes
3. ✅ Keep changes within that project's folder
4. ✅ Update project's CHANGELOG when making changes
5. ✅ Move files to `bin/` before deleting

### DON'T:
1. ❌ Delete protected files (rewrite instead)
2. ❌ Mix files from different projects
3. ❌ Touch `Portfolio/` folder (different workspace section)
4. ❌ Delete files directly (use bin/ fail-safe)

---

## Adding a New Project

1. Create folder structure (see template)
2. Create `AI_CONTEXT.md` with project context
3. Create `CHANGELOG.md` with initial entry
4. Create `TASKS.md` for task tracking
5. Create `.github/copilot-instructions.md` with project rules
6. Update folder's `docs/AI_CONTEXT.md` to list the project
7. Log in folder's `docs/CHANGELOG.md`

---

*Last Updated: 27 December 2025*
