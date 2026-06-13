<!-- === SYSTEM PAIRING ===
Consumed by: All AI builders (Claude Code, Cursor, Copilot, Aider, Continue, Gemini CLI, Codex)
Updated by: manual, on content or roadmap changes
Pairs with: CLAUDE.md (pointer), docs/CASE_STUDY.md, docs/BRAND.md, docs/ROADMAP.md
Update trigger: new content source absorbed, demo phase started, brand/scope change
Last verified: 2026-06-12 (initial content scaffold from Designathon 2025 submission)
Index: AGENTS.md
=== END PAIRING === -->

# AGENTS.md — CREATIVIA

> Canonical AI-builder rules for the CREATIVIA project in this folder.
> All builder LLMs read this file. [AGENTS.md is the Sourcegraph universal convention](https://agents.md).

**Project:** CREATIVIA — an AI creative co‑pilot for musicians (case study + planned portfolio demo)
**Repository:** [`tknatwork/side-kicks`](https://github.com/tknatwork/side-kicks) (this folder)
**Origin:** [Lollypop Designathon 2025](https://lollypop.design/designathon-2025/) · Team 6 · Bangalore · 8–9 Aug 2025
**Persona:** Raj, 24‑year‑old guitarist (Musician track)
**License:** [MIT](LICENSE) © 2025 Tushar Kant Naik (covers code + docs in this folder; not the team's design IP or the Lollypop brand)

---

## What this is (and is NOT)

CREATIVIA is **not a Figma plugin** — it does not share the constraints of the
sibling `variables-styles-extractor/` project. It is a **design case study**
with a **planned working demo** for the owner's portfolio site.

| It IS | It is NOT |
|-------|-----------|
| A structured record of a 24‑hour Designathon entry | A shipped product |
| Content-first: problem, persona, research, features, brand | A Figma plugin (no QuickJS/iframe constraints) |
| The home for a future static/interactive web demo | A backend service or real AI integration (yet) |

**Phase right now: content.** The working demo is a later phase — do not start
building app code unless the user asks to move to Phase 1+ (see
[`docs/ROADMAP.md`](docs/ROADMAP.md)).

---

## Read order at session start

1. **This file** (`AGENTS.md`) — scope, content rules, roadmap.
2. **`.gcc/session-memory.md`** — warm-start state (local-only; gitignored).
3. **[`README.md`](README.md)** — the public case study (source of truth for the narrative).
4. **[`docs/CASE_STUDY.md`](docs/CASE_STUDY.md)** — long-form content.
5. **[`docs/BRAND.md`](docs/BRAND.md)** — colours + type tokens.
6. **[`docs/ROADMAP.md`](docs/ROADMAP.md)** — phased plan toward the demo.

---

## Workspace scope restriction

- ✅ Allowed: `creativia/**`
- ✅ Allowed when asked: root `README.md`, `AGENTS.md`, `docs/CHANGELOG.md` (registering this project is a cross-cutting change you were asked to make)
- ❌ Forbidden without explicit user approval: other project folders (e.g. `variables-styles-extractor/`)

---

## Project structure

```
creativia/
├── AGENTS.md                  ← This file (canonical AI rules)
├── CLAUDE.md                  ← Pointer to AGENTS.md (legacy Claude Code path)
├── README.md                  ← Public-facing case study
├── LICENSE                    ← MIT (+ design-IP note)
├── assets/
│   ├── screens/               ← Optimised gallery rendered from the A4 PDF
│   └── figma/                 ← Frames pulled directly from the Figma design file
├── .github/
│   ├── copilot-instructions.md
│   └── ISSUE_TEMPLATE/        ← bug + feature templates
└── docs/
    ├── AGENTS.md              ← Redirect to ../AGENTS.md
    ├── CLAUDE.md              ← Redirect to ../CLAUDE.md
    ├── CASE_STUDY.md          ← Long-form content (problem → solution)
    ├── BRAND.md               ← Brand tokens (colour + type)
    ├── ROADMAP.md             ← Phased plan toward the working demo
    └── CHANGELOG.md           ← Version history (protected)
```

`.gcc/` (session memory + build log) is **gitignored** workspace-wide — keep it
local; never rely on it being committed.

---

## Content rules (Phase 0 — current)

1. **Stay faithful to the source.** The narrative comes from the Designathon
   submission (problem statement, Musician persona, and the team's A4 process
   document). Do not invent features, metrics, or research that weren't in the
   submission. If something is uncertain, mark it `<!-- TODO -->` rather than
   fabricating.
2. **Attribute honestly.** This is **Team 6's** collective work, organised into
   four design pods (PM, persona & research, presentation & dashboards, graphics
   — see the README). Credit the whole team and keep the owner's documented role
   (presentation & dashboards + niche features) accurate; do not inflate it.
3. **Respect the Lollypop brand.** Document the entry for educational/portfolio
   use; don't imply endorsement or ownership of the Lollypop/Designathon marks.
4. **Keep assets lean.** Screen images live in `assets/screens/` as optimised
   JPEGs. Re-optimise (don't bloat) if you add more.
5. **One narrative, linked everywhere.** `README.md` is the canonical story;
   `docs/CASE_STUDY.md` expands it. Keep them consistent — if you change a fact,
   change it in both.

---

## Build rules (Phase 1+ — when the demo starts)

Follows the [workspace rules](../AGENTS.md):

| Rule | Why |
|------|-----|
| Use **`pnpm`**. Never `npm`/`npx`. `pnpm dlx` for one-shots. | Lockfile integrity across the workspace |
| Prefer **Vite + TypeScript** for the demo (static-first, deployable). | Lightweight, portfolio-friendly |
| **Pin model IDs** (no `-latest`) if/when any AI call is added. | Avoid silent behaviour change |
| Keep the demo **deployable as static** where possible. | Easy to embed in the portfolio site |
| No workspace-level CI builds this. | Each project owns its build |

Document the chosen stack in this file and `docs/ROADMAP.md` when Phase 1 starts.

---

## File-protection rules (project-scoped)

Never delete — rewrite if the content becomes wrong:

| Path | What it captures |
|------|------------------|
| `AGENTS.md` (this file) | Canonical AI rules |
| `CLAUDE.md` | Pointer for legacy Claude Code path |
| `README.md` | Public-facing case study |
| `LICENSE` | MIT + design-IP note |
| `docs/AGENTS.md`, `docs/CLAUDE.md` | Redirects (kept for tooling) |
| `docs/CASE_STUDY.md`, `docs/BRAND.md`, `docs/ROADMAP.md` | Content |
| `docs/CHANGELOG.md` | Version history (protected) |
| `.github/copilot-instructions.md` | Copilot rules |
| `assets/screens/**`, `assets/figma/**` | The source images (A4 gallery + Figma frames) |

---

## How to report a bug or vulnerability

| Kind | Channel |
|------|---------|
| Issue with this case study / demo | [GitHub Issues](https://github.com/tknatwork/side-kicks/issues/new/choose) |
| Security vulnerability | **Do not open a public issue.** Use [GitHub Private Vulnerability Reporting](https://github.com/tknatwork/side-kicks/security/advisories/new) or email `hi@tusharkantnaik.com`. See [`/.github/SECURITY.md`](../.github/SECURITY.md). |

---

*Last updated: 2026-06-12 (initial content scaffold — Designathon 2025 submission captured as a case study; working demo deferred to Phase 1+)*
