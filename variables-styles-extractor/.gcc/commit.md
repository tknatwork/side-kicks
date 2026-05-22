# Variables & Styles Extractor — Project Build Log
> Append-only history of plugin-level phases. Workspace-level log at `../.gcc/commit.md`.
> Detailed per-version history lives in `docs/CHANGELOG.md`. This file captures phase decisions.

---

## 2026-05-22 | Phase: AI structure adoption + documentation sync

**Branch:** `claude/heuristic-haslett-5438ae`
**PR:** [#2](https://github.com/tknatwork/side-kicks/pull/2)

**What landed:**
- README.md synced to v2.0.0 published state (17 January 2026):
  - Feature list expanded to match Figma Community page (gradient/image fills, multi-paint, automatic rollback, web worker parsing, library + font validation, merge modes)
  - Window size corrected: 1000×580 → 1200×628 px
  - Install URL updated to canonical `/<id>/<slug>` form
  - "v2.0.0 in development" framing dropped (v2.0.0 has shipped)
- LICENSE updated with CFRL distribution notice. MIT text itself untouched (SPDX scanner compatibility).
- README license section rewritten as a two-surface table:
  - Source code → MIT
  - Figma Community distribution → CFRL (auto-applied by Figma)
- README badges split: Source (MIT) + Distribution (CFRL).
- AGENTS.md promoted from `docs/AGENTS.md` to project root.
- CLAUDE.md promoted from `docs/CLAUDE.md` to project root.
- `.gcc/` folder initialised with `session-memory.md`, `commit.md`, `metadata.yaml`, `main.md`, `memory.md`, `changelog.md`.

**Decisions:**
- **AGENTS.md is canonical at project root.** Mirrors Portfolio pattern. Old `docs/AGENTS.md` and `docs/CLAUDE.md` retained as redirects per the never-delete protected-files rule.
- **No CI build pipeline.** `code.js` ships pre-built from this repo. Author commits the minified output alongside source changes.
- **BP-001 violations in `ui.html` remain.** Pre-existing (`contain: strict` at line 1819; `content-visibility: auto` at lines 1829, 2083, 2963). Documented as a known issue in `.gcc/memory.md`. Scheduled as a follow-up PR — not blocking this branch.

**Outstanding follow-ups (project-scoped):**
- Fix BP-001 violations in `ui.html` (V-006 in `.gcc/main.md`).
- Decide on minimal TypeScript-clean CI gate (V-007).
- Bump `package.json` `version` field if the next change ships as v2.0.1+.

---
