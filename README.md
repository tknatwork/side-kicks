# Side-Kicks

> ⚠️ Protected Files Rule
>
> These files must NEVER be deleted, only rewritten:
> - `docs/AI_CONTEXT.md`
> - `docs/CHANGELOG.md`
> - Project-level: `AI_CONTEXT.md`, `CHANGELOG.md`, `.github/copilot-instructions.md`

A multi-project workspace for Figma plugins and design tools.

---

## Structure

```
Side-Kicks/
├── .git/                            ← Git repository
├── .github/
│   └── ISSUE_TEMPLATE/              ← Shared issue templates
├── docs/
│   ├── AI_CONTEXT.md                ← Folder context (PROTECTED)
│   └── CHANGELOG.md                 ← Structure changes (PROTECTED)
├── variables-styles-extractor/      ← Figma plugin project
│   ├── AI_CONTEXT.md                ← Project context (PROTECTED)
│   ├── CHANGELOG.md                 ← Project history (PROTECTED)
│   ├── README.md
│   ├── .github/
│   │   ├── copilot-instructions.md  ← Project AI rules (PROTECTED)
│   │   └── workflows/
│   ├── docs/
│   ├── src/
│   └── releases/
└── README.md                        ← This file
```

---

## Projects

### [variables-styles-extractor/](variables-styles-extractor/)
Figma plugin to export and import variables & styles between files.

| Property | Value |
|----------|-------|
| **Status** | Active - Published |
| **Version** | 2.0.0 (published 17 January 2026) |
| **Figma** | [Community Page](https://www.figma.com/community/plugin/1584331992332668732/variables-and-styles-extractor) |

---

## Adding a New Project

Each project gets its own folder:

```
[project-name]/
├── AI_CONTEXT.md       ← Project context (PROTECTED)
├── CHANGELOG.md        ← Project history (PROTECTED)
├── README.md           ← Public documentation
├── .github/
│   ├── copilot-instructions.md  ← Project AI rules (PROTECTED)
│   └── workflows/
├── docs/               ← Additional documentation
└── src/                ← Source code
```

### Steps
1. Create the folder structure
2. Add `AI_CONTEXT.md` with project context
3. Add `CHANGELOG.md` with initial entry
4. Add `.github/copilot-instructions.md` with AI rules
5. Add `README.md` with public documentation
6. Update `docs/AI_CONTEXT.md` to list the project
7. Log in `docs/CHANGELOG.md`

---

## Related Folders

| Folder | Relationship |
|--------|--------------|
| My Portfolio | Independent |
| Research Study | Independent |

---

*Last updated: 27 December 2025*
