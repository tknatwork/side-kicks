# Variables & Styles Extractor — Project Memory Index
> Project-scoped memory. Workspace memory lives at ../.gcc/memory.md.
> Keep under 100 lines. Full rules in `AGENTS.md`.

---

## Source of Truth
- **Workspace rules:** `../AGENTS.md`
- **Project rules:** `AGENTS.md` (project root)
- **Session state:** `.gcc/session-memory.md`
- **Build history:** `.gcc/commit.md` and `docs/CHANGELOG.md`
- **Agent registry:** `.gcc/main.md`

---

## Active Conflicts
| Date | Workspace Rule | Project Rule | Resolution |
|------|----------------|--------------|------------|
| — | — | — | — |

---

## Absorbed Workspace Updates
| Date | Change | Impact on Plugin |
|------|--------|------------------|
| 2026-05-22 | Workspace adopted Portfolio-style AGENTS.md + `.gcc/` | This plugin promoted its `docs/AGENTS.md` and `docs/CLAUDE.md` to project root; old paths kept as redirects |
| 2026-05-22 | Workspace removed CI build pipeline | Plugin must commit `code.js` alongside source changes (no CI builds it) |

---

## Plugin-Specific Quick Reference

- [0.9] `code.js` is checked in, not built in CI. Always run `pnpm build` and commit the result.
- [0.9] QuickJS VM in Figma does not support spread `{...obj}` or generators. Use `Object.assign({}, obj)` and plain loops in `src/code.ts`.
- [0.9] Figma iframe sandbox does not support `contain: strict` or `content-visibility: auto`. Use `contain: layout style` and live without lazy paint.
- [0.9] All Figma API calls must use `*Async()` variants where they exist.
- [0.7] `ui.html` has known BP-001 violations at lines 1819, 1829, 2083, 2963 — pre-existing. Fix as follow-up; do not introduce new ones.
- [0.7] Plugin window size is 1200×628 px (set in `ui.html` `figma.ui.show` call). README + community page must match.
- [0.5] Two-pass alias resolution in the JSON import path — order matters when a variable aliases another in the same payload. See `docs/JSON_FORMAT.md`.
- [0.5] Image fills round-trip via base64 in the JSON payload; hash-only references will fail in destinations that don't have the image.

---

## Pending Decisions
- [ ] Whether to fix the pre-existing BP-001 violations in this branch or schedule as a follow-up PR (currently scheduled as follow-up)
- [ ] Whether to add a minimal CI check (TypeScript clean only) — `pnpm build:dev` step that validates the source compiles even though we don't run the full build
