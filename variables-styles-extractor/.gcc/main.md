# Variables & Styles Extractor — Project Agent Registry
> Project-scoped agent registry. Workspace-level registry lives at ../.gcc/main.md.

---

## Project Identity
- **Name:** Variables & Styles Extractor
- **Path:** `Side-Kicks/variables-styles-extractor/`
- **Repo:** `tknatwork/side-kicks` (this folder)
- **Phase:** maintenance (published, accepting fixes + minor improvements)
- **Last Updated:** 2026-05-22

---

## Active Agents
| Agent ID | Role | Model | Status | Skills Assigned |
|----------|------|-------|--------|-----------------|
| claude-code | Plugin maintenance + docs | claude-opus-4-7 | active | plugin-dev, code-review, security-guidance |

---

## Task Index
| Task ID | Description | Agent | Status | Outcome |
|---------|-------------|-------|--------|---------|
| V-001 | Sync README to published v2.0.0 | claude-code | completed | commit `a67f2b9` |
| V-002 | Surface dual-license in README + LICENSE | claude-code | completed | commit `a67f2b9` |
| V-003 | Promote AGENTS.md from docs/ to project root | claude-code | in_progress | this branch |
| V-004 | Initialise plugin-level `.gcc/` | claude-code | in_progress | this branch |
| V-005 | Convert `docs/AGENTS.md` + `docs/CLAUDE.md` to redirects | claude-code | in_progress | this branch |
| V-006 | Fix pre-existing BP-001 CSS violations in `ui.html` | — | pending | follow-up PR |
| V-007 | Decide whether a minimal CI check (tsc clean only) adds value | — | pending | follow-up |

---

## Tool Registry
| Tool | Agents With Access | Notes |
|------|--------------------|-------|
| `pnpm` | claude-code | Build + dev workflows |
| `figma-cli` (Desktop hot-reload) | claude-code (advice only) | Plugin testing happens in Figma Desktop |
| `gh` CLI | claude-code | PR management |

---

## Skill Assignments
| Skill | Agent(s) | Last Used | Notes |
|-------|----------|-----------|-------|
| `plugin-dev` | claude-code | 2026-05-22 | AI-structure adoption |
| `code-review` | claude-code | 2026-05-22 | Pre-commit review |
| `security-guidance` | claude-code | 2026-05-22 | LICENSE + SECURITY surface |
