# Variables & Styles Extractor — Project Changelog
> Records structural changes at the plugin level (AI docs, file layout, lifecycle).
> Code/version changes live in `docs/CHANGELOG.md` (protected; that file remains the canonical version history).

---

## 2026-05-22 — AI structure adoption + documentation sync

**What changed:**
- Promoted `docs/AGENTS.md` → `AGENTS.md` (project root). `docs/AGENTS.md` becomes a redirect.
- Promoted `docs/CLAUDE.md` → `CLAUDE.md` (project root). `docs/CLAUDE.md` becomes a redirect.
- Added `.gcc/` folder with `session-memory.md`, `commit.md`, `metadata.yaml`, `main.md`, `memory.md`, `changelog.md`.
- `README.md` synced to Figma Community published v2.0.0 state.
- `LICENSE` augmented with Figma CFRL distribution notice (MIT body unchanged for SPDX scanner compatibility).

**Potential conflicts:**
- Any tooling that hardcoded `docs/AGENTS.md` or `docs/CLAUDE.md` continues to work via the redirect files; no change required.
- The protected-files rule in `docs/AI_CONTEXT.md` still applies — never delete the legacy paths, rewrite if needed.

**Migration notes:**
- AI builders should now read `AGENTS.md` at project root instead of `docs/AGENTS.md`.
- Warm-start state lives at `.gcc/session-memory.md`.
- Per-version code changes are still recorded in `docs/CHANGELOG.md`; structural changes go here.
