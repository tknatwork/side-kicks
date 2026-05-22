# Session Memory — Variables & Styles Extractor (claude/heuristic-haslett-5438ae)
> Hope Architecture — Medium Layer
> Warm-start context for this plugin. Workspace-level state lives at ../.gcc/session-memory.md.
> If Last Updated is older than 14 days, treat as cold start and reconstruct from .gcc/commit.md or docs/CHANGELOG.md.

---

## Last Updated
2026-05-22

---

## Slow Layer Ref (What to load from AGENTS.md)
- P0 (always needed): "Quick start for AI agents", "Hard constraints" (QuickJS VM + iframe CSS), "Code-change checklist"
- P1 (load when touching backend): `src/code.ts`, `docs/FIGMA_PLUGIN_DEVELOPMENT.md`
- P2 (load when touching UI): `ui.html`, `docs/CODING_STANDARDS.md`
- P2 (load when touching JSON path): `docs/JSON_FORMAT.md`

---

## Medium Layer — Current State
- **Plugin version (published):** 2.0.0 (17 January 2026)
- **Plugin version (dev):** 2.0.0 (same — no dev divergence on this branch)
- **Window size:** 1200×628 px (4-column layout)
- **Last commit (on this branch):** `4318f94` (CI move — reverted same branch since CI was removed)
- **Branch:** `claude/heuristic-haslett-5438ae`
- **PR:** [#2](https://github.com/tknatwork/side-kicks/pull/2) — docs + security + AI structure
- **Open issues:** 2 (per `gh repo view` — not yet triaged in this session)

---

## Last Session (Fast → Medium flush)
### What Was Done
- Verified plugin folder matches Figma Community listing 1584331992332668732
- Synced [`README.md`](../README.md) to v2.0.0 published state: feature list, window size, install URL slug, dual-license badges
- Updated [`LICENSE`](../LICENSE) with CFRL distribution notice (MIT text itself unchanged for SPDX scanner compatibility)
- Promoted `docs/AGENTS.md` → project-root `AGENTS.md` (Portfolio pattern)
- Promoted `docs/CLAUDE.md` → project-root `CLAUDE.md` (pointer)
- Created `.gcc/` folder with full Hope Architecture state files
- Confirmed no CI build pipeline needed — `code.js` ships pre-built from this repo

### Key Decisions Made
- **AGENTS.md at project root** is the canonical AI rules file. The old `docs/AGENTS.md` and `docs/CLAUDE.md` become redirects (protected by the never-delete rule).
- **Dual-license model surfaced in README + LICENSE.** MIT applies to source in this repo; Figma's Community Free Resource License applies to the Figma Community distribution and is auto-applied by Figma at publish.
- **No build CI.** Source is checked in pre-built. Avoids reproducibility tooling burden for a single-maintainer plugin.

### Active Blockers
- Pre-existing BP-001 CSS violations (`contain: strict` at `ui.html:1819`, `content-visibility: auto` at `ui.html:1829, 2083, 2963`). Not fixed in this branch per "no CI" direction — but they remain documented in `docs/CODING_STANDARDS.md` and `AGENTS.md` as rules to follow for new code. Eventually fix as a follow-up PR.

---

## Next Step (Fast Layer Seed)
Land PR #2 (docs + security + AI structure). After merge:
1. (optional) Open follow-up PR to fix the pre-existing BP-001 violations in `ui.html`. Change `contain: strict` → `contain: layout style`. Remove `content-visibility: auto` (three sites). Validate in Figma Desktop before merging.
2. (optional) Reconsider whether a minimal build-validate CI (TypeScript clean + `code.js` exists) adds value. Currently judged "no".

---

## Prior Sessions (rolling log — keep last 5)
| Date | Summary |
|------|---------|
| 2026-05-22 | First `.gcc/` session for this plugin — established Portfolio-style AI docs structure, README + LICENSE sync to published v2.0.0 |
