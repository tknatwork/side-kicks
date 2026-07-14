<!-- === SYSTEM PAIRING ===
Consumed by: All AI builders (Claude Code, Cursor, Copilot, Aider, Continue, Gemini CLI, Codex)
Updated by: manual + commits referencing structural changes
Pairs with: CLAUDE.md (pointer),
            per-project AGENTS.md (e.g. variables-styles-extractor/AGENTS.md)
Update trigger: structural change (new project, new convention, security policy update)
Last verified: 2026-05-22 (initial Portfolio-style AI structure)
Index: README.md → table of projects
=== END PAIRING === -->

# AGENTS.md — Side-Kicks workspace

> Canonical AI-builder rules for the `tknatwork/side-kicks` repository.
> All builder LLMs (Claude Code, Cursor, Copilot, Aider, Continue, Gemini CLI, Codex) read this file.
> AGENTS.md is the [Sourcegraph universal convention](https://agents.md).

---

## What this repo is

A workspace for Figma plugins and design tooling, led by **Limitless MCP for Figma**. Active projects:

| Project | Folder | Status |
|---------|--------|--------|
| **Limitless MCP for Figma** (flagship) | [`figma-limitless-mcp/`](figma-limitless-mcp/) | Active (v0.3.0) — local Figma MCP server + Desktop plugin giving AI full, unthrottled Figma access across Design/Dev/FigJam/Slides/Buzz: local fonts, variable/component/prototype authoring, crash-safe orchestration, and a bundled **design-system knowledge layer + 57-rule structure linter** (build → lint → fix). **98 tools.** |
| Variables & Styles Extractor | [`variables-styles-extractor/`](variables-styles-extractor/) | Published on Figma Community ([1584331992332668732](https://www.figma.com/community/plugin/1584331992332668732/variables-and-styles-extractor)) |

Local working copies may contain extra untracked folders (references,
retired experiments). They are not part of the repo — ignore them.

---

## Read order at session start

1. **This file** (`AGENTS.md`) — workspace conventions and entry points.
2. **`.gcc/session-memory.md`** — warm-start context from the last session
   (branch, last commit, next step). If older than 14 days, treat as cold
   start and reconstruct from `.gcc/commit.md`.
3. **Per-project `AGENTS.md`** — open the AGENTS.md inside the project
   folder you're working in (e.g. `variables-styles-extractor/AGENTS.md`).
   That file owns the project-specific architecture, constraints, and
   conventions. Per-project AGENTS.md takes precedence over this file
   inside its folder.
4. **Per-project `.gcc/session-memory.md`** — same warm-start protocol,
   scoped to the project.

If `CLAUDE.md` is read instead of `AGENTS.md` (legacy Claude Code path),
follow its pointer back here.

---

## Project scope rules

Work inside **one project folder at a time**. Cross-folder edits are
banned without explicit user permission.

| You're editing | You may also touch | You must NOT touch |
|----------------|--------------------|--------------------|
| `variables-styles-extractor/**` | Root `README.md`, `.github/` if it's a security/CI change you've been asked for | — |
| Workspace root files (this file, README, `.gcc/`) | The project's README if cross-cutting | Per-project source unless explicitly asked |

If a future change spans more than one project folder (e.g. extracting
a shared utility once a second project exists), say so in the commit
message and reference both projects.

---

## File-protection rules

Some files capture protected context. **Never delete them — rewrite if
the content becomes wrong.** Treat the file's presence at the listed
path as part of the repo contract.

### Workspace-level
| Path | What it captures |
|------|------------------|
| `AGENTS.md` (this file) | Canonical AI-builder rules |
| `CLAUDE.md` | Pointer for legacy Claude Code path |
| `SECURITY.md` (root) and `.github/SECURITY.md` | Vulnerability disclosure |
| `.github/CODEOWNERS` | Auto-review routing |
| `.github/dependabot.yml` | Update policy |
| `.gcc/session-memory.md` | Warm-start state |
| `.gcc/commit.md` | Build history |
| `.gcc/metadata.yaml` | Workspace phase |
| `.gcc/main.md` | Project registry |
| `.gcc/memory.md` | Cross-session memory |
| `.gcc/changelog.md` | Workspace structural changes |
| `docs/CHANGELOG.md` | Workspace-level changelog |

### Per-project
Each project must keep, at its own root:
- `AGENTS.md` (canonical project AI rules — content lives here; this is the source of truth)
- `CLAUDE.md` (pointer to that project's `AGENTS.md`)
- `README.md` (public-facing)
- `LICENSE` (project license)
- `.gcc/session-memory.md`, `.gcc/commit.md`, `.gcc/metadata.yaml`, `.gcc/main.md`, `.gcc/memory.md`, `.gcc/changelog.md`
- `.github/copilot-instructions.md` (if the project predates AGENTS.md adoption)
- `docs/CHANGELOG.md` (legacy path, kept for tooling)

When a doc becomes a redirect (e.g. content moved from `docs/AGENTS.md`
to project-root `AGENTS.md`), the redirect stays in place and points to
the new location. Do not delete redirects.

---

## Build & dev rules

| Rule | Why |
|------|-----|
| Use `pnpm`. Never `npm`. Never `npx`. Use `pnpm dlx` for one-shots and `pnpm exec` for local bins. | Lockfile integrity + supply-chain consistency across projects |
| Run install with `--frozen-lockfile` in CI and prefer it locally | Catches unexpected dep drift |
| No CI build pipeline runs at the workspace level | Each project owns its own build. Workspace-level workflows are limited to security scanning (CodeQL) and dependency updates (Dependabot). |
| Wrap every `JSON.parse()` in a schema validator | The Figma plugin JSON import path is a parsing seam; mistakes here ship to thousands of files |
| Pin model IDs (no `-latest`) when AI calls are made | Avoid silent behavior change |

Per-project build commands live in that project's `AGENTS.md`.

---

## Security posture

This repository is **public**. Anyone can read, clone, or fork; only
collaborators with write access can push.

| Defense | Where it lives |
|---------|----------------|
| Branch protection on `main` (require PR + Code Owner + CodeQL pass + no force-push + no deletion + linear history) | GitHub repo settings (applied via `gh api`) |
| Vulnerability disclosure policy | [`SECURITY.md`](.github/SECURITY.md) |
| Auto-review routing | [`.github/CODEOWNERS`](.github/CODEOWNERS) |
| Dependency updates | [`.github/dependabot.yml`](.github/dependabot.yml) |
| Source code scanning | [`.github/workflows/codeql.yml`](.github/workflows/codeql.yml) — runs on push/PR to main + weekly |
| Secret scanning + push protection | GitHub default (enabled at repo settings) |
| Dependabot alerts + security updates | GitHub default (enabled at repo settings) |

When AI builders touch security-relevant files (`.github/**`, `LICENSE`,
`SECURITY.md`), do not silently widen permissions or remove guards.
Surface the change in the PR description so the human reviewer can
catch it.

---

## How to report a bug or vulnerability

| Kind | Channel |
|------|---------|
| Bug in a plugin (user-visible) | [GitHub Issues](https://github.com/tknatwork/side-kicks/issues/new/choose) using the bug-report template |
| Feature request | [GitHub Issues](https://github.com/tknatwork/side-kicks/issues/new/choose) using the feature-request template |
| Security vulnerability | **Do not open a public issue.** Use [GitHub Private Vulnerability Reporting](https://github.com/tknatwork/side-kicks/security/advisories/new) or email `hi@tusharkantnaik.com`. See [`SECURITY.md`](.github/SECURITY.md) for SLAs. |

---

## How AI builders should operate

1. **Identify the project** you're in. If the request is ambiguous, ask
   before editing.
2. **Read that project's `AGENTS.md`** before writing code.
3. **Stay inside that project's folder** unless the user names a
   cross-cutting change.
4. **Update `.gcc/session-memory.md`** at the end of any non-trivial
   session (workspace-level for workspace changes, project-level for
   project changes).
5. **Append to `.gcc/commit.md`** when finishing a phase.
6. **Never commit secrets.** GitHub push protection will block known
   token formats; do not work around it.
7. **Surface security-relevant changes** in PR descriptions.

---

## Adding a new project

```bash
mkdir -p Side-Kicks/<project-name>/{.github,.gcc,docs,src}
cd Side-Kicks/<project-name>
# Copy templates from ~/CLAUDE CONTEXT/GCC/templates/
# Required files at project root:
#   AGENTS.md, CLAUDE.md (pointer), README.md, LICENSE,
#   .gcc/{session-memory.md,commit.md,metadata.yaml,main.md,memory.md,changelog.md}
```

Then update this file's "What this repo is" table.

---

*Last updated: 2026-05-22 (initial Portfolio-style structure)*
