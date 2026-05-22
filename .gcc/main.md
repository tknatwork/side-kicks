# Side-Kicks — Workspace Agent Registry
> Local mirror of `~/CLAUDE CONTEXT/GCC/main.md` scope, scoped to this workspace.
> Global rules live in `~/CLAUDE.md`. This file records what happens here.

---

## Workspace Identity
- **Name:** Side-Kicks
- **Path:** `Side-Kicks/` (Github Project/design-docs/Side-Kicks)
- **Repo:** `tknatwork/side-kicks`
- **GCC Branch:** `~/CLAUDE CONTEXT/GCC/branches/side-kicks/` (registry mirror)
- **Phase:** ai-structure-adopted
- **Last Updated:** 2026-05-22

---

## Sub-projects
> Source of truth: `AGENTS.md` "What this repo is" table.
> This table tracks which sub-projects are tracked by `.gcc/` (and thus eligible for warm-start memory + handoff).

| Project | `.gcc/` initialised | AGENTS.md at root | Notes |
|---------|--------------------|---------------------|-------|
| variables-styles-extractor | ✅ 2026-05-22 | ✅ 2026-05-22 | Published Figma plugin |
| nectar-design-toolkit | ❌ (not yet) | ❌ (legacy structure, `TASKS.md` only) | Schedule for next pass |
| Design System Builder | ❌ (not yet) | ❌ (no AI docs yet) | Schedule for next pass |

---

## Active Agents
| Agent ID | Role | Model | Status | Skills Assigned |
|----------|------|-------|--------|-----------------|
| claude-code | Workspace + plugin maintenance | claude-opus-4-7 | active | github, vercel-unrelated, plugin-dev, security-guidance |

---

## Task Index
| Task ID | Description | Agent | Status | Outcome |
|---------|-------------|-------|--------|---------|
| W-001 | Sync README to Figma Community v2.0.0 | claude-code | completed | commit `a67f2b9` |
| W-002 | Clarify MIT + Figma CFRL dual license | claude-code | completed | commit `a67f2b9` |
| W-003 | Add SECURITY.md + CODEOWNERS + Dependabot + CodeQL | claude-code | completed | commit `2f82255` |
| W-004 | Move CI workflows to repo root | claude-code | reverted | superseded by W-005 |
| W-005 | Remove CI (no build pipeline needed) | claude-code | in_progress | this branch |
| W-006 | Adopt Portfolio-style AGENTS.md + `.gcc/` | claude-code | in_progress | this branch |
| W-007 | Triage 66 open Dependabot alerts on `main` | — | pending | next session |
| W-008 | Initialise `.gcc/` for `nectar-design-toolkit` | — | pending | follow-up |
| W-009 | Initialise `.gcc/` for `Design System Builder` | — | pending | follow-up |

---

## Tool Registry
| Tool | Agents With Access | Notes |
|------|--------------------|-------|
| `gh` CLI | claude-code | Repo + branch protection + PR management |
| `pnpm` | claude-code | Workspace + per-project package management |
| GitHub Private Vulnerability Reporting | claude-code (read-only inbox) | Triage path for security disclosures |

---

## Skill Assignments
| Skill | Agent(s) | Last Used | Notes |
|-------|----------|-----------|-------|
| `security-guidance` | claude-code | 2026-05-22 | Workflow hardening, branch protection |
| `plugin-dev` | claude-code | 2026-05-22 | AI-structure adoption |
| `code-review` | claude-code | 2026-05-22 | Pre-commit review |
