# AI Context: Side-Kicks

> ⚠️ PROTECTED FILE - DO NOT DELETE
> This file must NEVER be deleted during cleanup or overhaul operations.
> Instead, rewrite its contents to reflect the new direction.

## Quick Reference

| Key | Value |
|-----|-------|
| **Purpose** | Multi-project workspace for Figma plugins & tools |
| **Structure** | One subfolder per plugin/tool project |
| **Status** | Active - supports multiple isolated projects |
| **Repository** | https://github.com/tknatwork/side-kicks |

---

## Workspace Context

This folder is part of a **multi-project workspace** and contains **multiple tool/plugin projects**:

```
design-docs/                         ← Parent workspace root
├── AI_CONTEXT.md                    ← Workspace overview
├── bin/                             ← 🗑️ FAIL-SAFE: Deleted files go here
├── Portfolio/
│   ├── My Portfolio/                ← Portfolio website (independent)
│   └── Research Study/              ← Design system research (independent)
└── Side-Kicks/                      ← THIS FOLDER (multi-project tools)
    ├── docs/                        ← Folder-level docs
    ├── variables-styles-extractor/  ← Project: Figma plugin
    ├── nectar-design-toolkit/       ← Project: Design system orchestration
    └── [future-projects]/           ← Future tools/plugins
```

### 🗑️ Bin Folder (Fail-Safe)

Before deleting any file, move it to `bin/` first:
```bash
mv file.md ../../bin/
```

---

## Folder Structure

```
Side-Kicks/
├── .git/                            ← Git repository root
├── .github/
│   └── ISSUE_TEMPLATE/              ← GitHub issue templates
├── docs/
│   ├── AI_CONTEXT.md                ← THIS FILE (PROTECTED)
│   └── CHANGELOG.md                 ← Folder-level changelog (PROTECTED)
├── variables-styles-extractor/      ← PROJECT: Figma Plugin
│   ├── AI_CONTEXT.md                ← Project context (PROTECTED)
│   ├── CHANGELOG.md                 ← Project history (PROTECTED)
│   ├── README.md                    ← Public documentation
│   ├── .github/
│   │   ├── copilot-instructions.md  ← Project AI rules (PROTECTED)
│   │   └── workflows/               ← CI/CD pipelines
│   ├── docs/                        ← Additional documentation
│   ├── src/                         ← Source code
│   └── releases/                    ← Version archives
├── [new-project]/                   ← TEMPLATE for future projects
│   ├── AI_CONTEXT.md                ← Project context (PROTECTED)
│   ├── CHANGELOG.md                 ← Project history (PROTECTED)
│   ├── README.md                    ← Public documentation
│   ├── .github/
│   │   └── copilot-instructions.md  ← Project AI rules
│   ├── docs/                        ← Additional documentation
│   └── src/                         ← Source code
└── README.md                        ← Side-Kicks overview
```

---

## Multi-Project Architecture

### Project Isolation Rules

Each tool/plugin project lives in its **own subfolder** with a consistent structure:

```
[project-name]/
├── AI_CONTEXT.md       ← Project-specific AI context (PROTECTED)
├── CHANGELOG.md        ← Project-specific change history (PROTECTED)
├── README.md           ← Public documentation (GitHub)
├── .github/
│   ├── copilot-instructions.md  ← Project AI rules (PROTECTED)
│   └── workflows/      ← CI/CD pipelines
├── docs/               ← Additional documentation
├── src/                ← Source code
└── releases/           ← Version archives (optional)
```

### Why This Structure?
- **No file mixing** - Each project's files stay in its folder
- **Independent repos** - Projects can be extracted to separate repos if needed
- **Shared GitHub** - Parent `.github/` for shared templates
- **Scalable** - Add new projects without affecting existing ones

---

## Current Projects

### 1. variables-styles-extractor/
| Property | Value |
|----------|-------|
| **Purpose** | Figma plugin to export/import variables & styles |
| **Status** | Active - Published on Figma Community |
| **Published Version** | 1.6.0 |
| **Development Version** | 1.7.0 |
| **Context** | `variables-styles-extractor/AI_CONTEXT.md` |
| **History** | `variables-styles-extractor/CHANGELOG.md` |

**Links:**
- Figma: https://www.figma.com/community/plugin/1584331992332668732
- GitHub: https://github.com/tknatwork/side-kicks

### 2. nectar-design-toolkit/
| Property | Value |
|----------|-------|
| **Purpose** | Multi-component suite for AI-controlled design system building in Figma |
| **Status** | Active - Migrated from Portfolio archive |
| **Version** | 1.0.0 |
| **Context** | `nectar-design-toolkit/docs/AI_CONTEXT.md` |
| **History** | `nectar-design-toolkit/docs/CHANGELOG.md` |

**Components:**
- **figma-plugin** - Main AI-controlled Figma plugin
- **nds-builder** - Standalone NDS bootstrapper
- **nectar-style-generator** - Style generation from variable modes
- **orchestration-server** - HTTP polling server for AI communication
- **bridge-server** - WebSocket bridge
- **mcp-server** - VS Code MCP integration

---

## Creating a New Project

When creating a new tool/plugin:

```bash
# Create project structure
mkdir -p "Side-Kicks/[project-name]/.github/workflows"
mkdir -p "Side-Kicks/[project-name]/docs"
mkdir -p "Side-Kicks/[project-name]/src"

# Create required files
touch "Side-Kicks/[project-name]/AI_CONTEXT.md"
touch "Side-Kicks/[project-name]/CHANGELOG.md"
touch "Side-Kicks/[project-name]/README.md"
touch "Side-Kicks/[project-name]/.github/copilot-instructions.md"
```

### Required Files

1. **AI_CONTEXT.md** (PROTECTED) - Project-specific context for AI assistants
2. **CHANGELOG.md** (PROTECTED) - Project-specific change history
3. **README.md** - Public documentation
4. **.github/copilot-instructions.md** (PROTECTED) - Project AI rules

---

## Protected Files

### Folder-Level (Side-Kicks/)
| File | Purpose |
|------|---------|
| `docs/AI_CONTEXT.md` | This file - folder context |
| `docs/CHANGELOG.md` | Structure changes only |

### Project-Level (each project/)
| File | Purpose |
|------|---------|
| `AI_CONTEXT.md` | Project-specific AI context |
| `CHANGELOG.md` | Project-specific history |
| `.github/copilot-instructions.md` | Project AI rules |

### Changelog Scope
| Level | Tracks |
|-------|--------|
| **Folder** (`docs/CHANGELOG.md`) | New projects, folder structure changes |
| **Project** (`[project]/CHANGELOG.md`) | Code changes, releases, features |

---

## Relationships to Other Folders

| Folder | Relationship |
|--------|--------------|
| My Portfolio | **Independent** - No connection |
| Research Study | **Independent** - No connection |

---

## For AI Assistants

### Working in Side-Kicks

1. **Identify the project** - Determine which subfolder you're working in
2. **Read project context** - Check `[project]/AI_CONTEXT.md` first
3. **Stay isolated** - Keep changes within that project's folder
4. **Follow project rules** - Check `[project]/.github/copilot-instructions.md`

### Adding New Projects

1. Create the project folder structure (see template above)
2. Create `AI_CONTEXT.md` with project context
3. Create `CHANGELOG.md` with initial entry
4. Create `.github/copilot-instructions.md` with project rules
5. Add `README.md` with public documentation
6. Update this folder's `docs/AI_CONTEXT.md` to list the new project
7. Log the addition in folder's `docs/CHANGELOG.md`

### Folder-Level vs Project-Level

| Scope | Protected Files | Tracks |
|-------|-----------------|--------|
| **Folder** (Side-Kicks/) | `docs/AI_CONTEXT.md`, `docs/CHANGELOG.md` | Projects list, structure changes |
| **Project** (variables-styles-extractor/) | `AI_CONTEXT.md`, `CHANGELOG.md`, `.github/copilot-instructions.md` | Project-specific content & history |

---

*Last updated: Multi-project restructure*
