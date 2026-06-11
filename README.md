# Side-Kicks

A multi-project workspace for Figma plugins and design tools.

📖 **AI builders start here:** [AGENTS.md](AGENTS.md) — workspace-level canonical rules.
🔒 **Reporting a vulnerability:** [`.github/SECURITY.md`](.github/SECURITY.md).
🐛 **Reporting a bug:** [Open an issue](https://github.com/tknatwork/side-kicks/issues/new/choose).

---

## Projects

| Project | Folder | Status | Notes |
|---------|--------|--------|-------|
| Variables & Styles Extractor | [`variables-styles-extractor/`](variables-styles-extractor/) | Published v2.1.2 · first published 17 Jan 2026 | Figma plugin · [Community page](https://www.figma.com/community/plugin/1584331992332668732/variables-and-styles-extractor) |

---

## Repository layout

```
side-kicks/                                     (this repo: tknatwork/side-kicks)
├── AGENTS.md                       ← Workspace AI rules (canonical)
├── CLAUDE.md                       ← Pointer to AGENTS.md (legacy Claude Code path)
├── README.md                       ← This file
├── .github/
│   ├── CODEOWNERS                  ← Auto-review routing
│   ├── SECURITY.md                 ← Vulnerability disclosure policy
│   ├── dependabot.yml              ← Update policy
│   ├── ISSUE_TEMPLATE/             ← Bug + feature templates
│   ├── copilot-instructions.md
│   └── workflows/
│       └── codeql.yml              ← Security scanning (only workflow at workspace level)
├── .gcc/                           ← Workspace session memory + build log
│   ├── session-memory.md
│   ├── commit.md
│   ├── metadata.yaml
│   ├── main.md
│   ├── memory.md
│   └── changelog.md
├── docs/
│   └── CHANGELOG.md                ← Workspace-level changelog (PROTECTED)
├── variables-styles-extractor/     ← Project: Figma plugin
│   ├── AGENTS.md                   ← Project AI rules (canonical)
│   ├── CLAUDE.md                   ← Pointer to project AGENTS.md
│   ├── README.md                   ← Public-facing plugin docs
│   ├── LICENSE                     ← MIT + Figma CFRL distribution notice
│   ├── manifest.json               ← Figma plugin manifest
│   ├── code.js                     ← Compiled output (CHECKED IN — no CI builds it)
│   ├── ui.html                     ← UI source
│   ├── src/code.ts                 ← Backend source (Figma QuickJS VM)
│   ├── .gcc/                       ← Project session memory + build log
│   ├── START_HERE.md               ← Boot check (constraints, build, danger zones)
│   ├── assets/                     ← Plugin logo (SVG) + icon
│   ├── .github/copilot-instructions.md
│   └── docs/                       ← CHANGELOG, CODING_STANDARDS, FIGMA_PLUGIN_DEVELOPMENT, etc.
└── (single active project: variables-styles-extractor)
```

---

## AI documentation pattern

This workspace uses the [Sourcegraph AGENTS.md convention](https://agents.md):

| Layer | Canonical file | Pointer |
|-------|----------------|---------|
| Workspace | `AGENTS.md` (this folder) | `CLAUDE.md` (this folder) |
| Project | `<project>/AGENTS.md` | `<project>/CLAUDE.md` |

All builder LLMs (Claude Code, Cursor, Copilot, Aider, Continue, Gemini CLI, Codex) read `AGENTS.md`. `CLAUDE.md` exists at the same paths as a pointer for legacy Claude Code lookups and tooling that hardcodes the older path.

**Read order at session start:**
1. Workspace [`AGENTS.md`](AGENTS.md) — what this repo is, project scope rules, security posture
2. Workspace [`.gcc/session-memory.md`](.gcc/session-memory.md) — warm-start state
3. Per-project `AGENTS.md` (when working inside a project folder)
4. Per-project `.gcc/session-memory.md`

---

## Protected files

Some paths capture context that other tooling depends on. **Never delete — rewrite if the content becomes wrong.**

### Workspace-level
- `AGENTS.md`, `CLAUDE.md`, `README.md`
- `.github/SECURITY.md`, `.github/CODEOWNERS`, `.github/dependabot.yml`
- `.gcc/*` (six files)
- `docs/CHANGELOG.md`

### Per-project
- `<project>/AGENTS.md`, `<project>/CLAUDE.md`
- `<project>/README.md`, `<project>/LICENSE`
- `<project>/.gcc/*` (six files)
- `<project>/.github/copilot-instructions.md` (where present)
- `<project>/docs/CHANGELOG.md`
- Any path that became a redirect during a structure change (e.g. `<project>/docs/AGENTS.md` → redirect to project root after 2026-05-22)

---

## Security

- **Visibility:** Public repository. Anyone can clone or fork; only collaborators with write access can push.
- **Branch protection on `main`:** PR required + Code Owner review + CodeQL must pass + linear history + no force-push + no deletion.
- **Vulnerability reporting:** [`.github/SECURITY.md`](.github/SECURITY.md). Use [GitHub Private Vulnerability Reporting](https://github.com/tknatwork/side-kicks/security/advisories/new) — do not file public issues for security bugs.
- **Bug + feature reporting:** [GitHub Issues](https://github.com/tknatwork/side-kicks/issues/new/choose).
- **Automated scanning:** Dependabot alerts + security updates + secret scanning + push protection + CodeQL.

---

## Adding a new project

```bash
mkdir -p "Side-Kicks/<project-name>"/{.github,.gcc,docs,src}
cd "Side-Kicks/<project-name>"

# Required at project root:
#   AGENTS.md          — canonical project AI rules
#   CLAUDE.md          — pointer to AGENTS.md
#   README.md          — public-facing
#   LICENSE            — project license
#   .gcc/              — six files (session-memory, commit, metadata, main, memory, changelog)
#
# Optional:
#   docs/              — additional documentation (CODING_STANDARDS, KNOWN_ISSUES, etc.)
#   src/               — source code
```

Then update:
1. This README's "Projects" table.
2. Workspace [`AGENTS.md`](AGENTS.md) "What this repo is" table.
3. Workspace [`.gcc/main.md`](.gcc/main.md) "Sub-projects" table.

---

## Related folders

| Folder | Relationship |
|--------|--------------|
| My Portfolio | Independent |
| Research Study | Independent |

---

*Last updated: 2026-05-22 (Portfolio-style AI structure adopted)*
