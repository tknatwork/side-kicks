# Changelog — CREATIVIA

> ⚠️ PROTECTED FILE - DO NOT DELETE
> This file must NEVER be deleted during cleanup or overhaul operations.
> Instead, rewrite its contents to reflect the new direction.

All notable changes to the CREATIVIA project are documented here.

**Repository:** https://github.com/tknatwork/side-kicks/tree/main/creativia

---

## [0.2.0] - 2026-06-13

### 🔍 Enriched from the Figma design file

Folded in content read directly from Team 6's Figma design file (design page `2:433`,
research board `129:5851`) — richer and more accurate than the A4 PDF the v0.1.0 scaffold
was built from.

### Added
- **User-interview research method** — four themes (🧠 Creative Process · 🎹 Practice &
  Iteration · 🤝 Collaboration · 🤖 Tech & Tools) with their questions, in
  [`../README.md`](../README.md) and [`CASE_STUDY.md`](CASE_STUDY.md).
- **Affinity-board synthesis** (Target Audience · What Raj does · Needs · Pain points · Key
  Pointers) and per-use-case breakdowns in `CASE_STUDY.md`.
- New Figma-sourced assets in [`../assets/figma/`](../assets/figma/) — cover, "what are we
  solving for", the **User Interview** frame, the high-fidelity **Practice Session Analysis
  dashboard**, the **userflow** sketches, and the **landing-page** concept (pulled from a
  duplicate of the file once the live frames were shared).
- Note of additional design artifacts (a **Userflow** diagram and a **landing-page** mockup).

### Changed / Fixed
- **Brand tokens corrected to the documented Figma values:** primary gradient
  **`#FF0F7B → #F89B29`** (was `#FE1E72→#F89030`) and **Accent Magenta `#E23670`** (was
  `#E32678`). Updated `BRAND.md`, README (table + badges), and the CSS variables.
- **Pain points 10 → 11** — added "Lack of instant validation and feedback"; needs stated as the canonical 5.
- **Creative loop corrected:** Unrefined Skill → Practice → Document & Recall → Collaborate
  → **Refined Skill** (was "Improvise").
- Sources/attribution now credit the Figma design file (nodes `2:433`, `129:5851`).

---

## [0.1.0] - 2026-06-12

### 🎸 Initial content scaffold — Designathon 2025 submission captured

First version of the project: the Lollypop Designathon 2025 entry (Team 6,
Musician persona) captured as a structured, portfolio‑ready case study. Content
first; the working demo is deferred to a later phase.

### Added
- **Case study** ([`README.md`](../README.md)) — brief, problem, persona (Raj),
  research, needs, pain points, solution (4 features), brand system, team & credits.
- **Long-form write-up** ([`CASE_STUDY.md`](CASE_STUDY.md)) — Designathon context,
  program flow, evaluation, detailed persona use cases, pain‑point→feature mapping.
- **Brand system** ([`BRAND.md`](BRAND.md)) — colour tokens (AI Soundwave gradient,
  Soundwave Blue, Accent Magenta, Almost Black, White) + Outfit/Inter type, with
  CSS custom properties for the demo.
- **Roadmap** ([`ROADMAP.md`](ROADMAP.md)) — phased plan from content → static demo
  → interactive demo → ship.
- **Screen gallery** ([`../assets/screens/`](../assets/screens/)) — 11 optimised
  images rendered from the team's A4 process document.
- **Project scaffold** — `AGENTS.md`, `CLAUDE.md`, `LICENSE` (MIT + design‑IP note),
  `docs/` redirects, `.github/copilot-instructions.md` + issue templates.

### Notes
- `.gcc/` session memory is gitignored workspace‑wide (local only).
- Team documented as four design pods (PM · persona & research · presentation &
  dashboards · graphics); the owner's role (presentation & dashboards + niche
  features) is credited within the wider Team 6 effort.

---

## Changelog Scope

| Level | Tracks |
|-------|--------|
| Workspace `docs/CHANGELOG.md` | New projects, folder structure changes |
| **This file** | CREATIVIA content + demo changes |

---

*Format based on [Keep a Changelog](https://keepachangelog.com/)*
