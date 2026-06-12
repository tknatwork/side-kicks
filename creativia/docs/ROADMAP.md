# CREATIVIA — Roadmap

From Designathon case study to a small **working demo** for the portfolio site.

> Build tooling follows the [workspace rules](../../AGENTS.md): **`pnpm` only**
> (never `npm`/`npx`), pinned model IDs for any AI calls, no workspace‑level CI.
> Update [`AGENTS.md`](../AGENTS.md) and [`CHANGELOG.md`](CHANGELOG.md) when a phase starts.

## Phase 0 — Content ✅ (current)

The Designathon submission captured as a structured case study.

- [x] Project scaffold matching the Side‑Kicks conventions (`AGENTS.md`, `CLAUDE.md`, `README.md`, `LICENSE`, `docs/`).
- [x] Case study: brief, persona, research, needs, pain points, solution, brand.
- [x] Optimised screen + process gallery in `assets/screens/`.
- [x] Registered in the workspace `README.md`, `AGENTS.md`, and `docs/CHANGELOG.md`.
- [ ] Fill the owner's specific contribution in `README.md` (TODO).

## Phase 1 — Demo scaffold ⏳

A static, deployable page that presents the case study and screens well.

- [ ] Decide stack — **proposed: Vite + TypeScript** (static‑first, easy to embed in the portfolio).
- [ ] `pnpm` project inside `creativia/` (e.g. `creativia/demo/` or this root).
- [ ] Apply the [brand tokens](BRAND.md) (colours, Outfit/Inter type).
- [ ] Sections: hero → problem → Raj → research → solution (4 features) → brand → credits.
- [ ] Responsive, accessible, lighthouse‑clean.

## Phase 2 — Interactive demo ⏳

A click‑through of the signature flows — not a real backend, a believable prototype.

- [ ] **Capture → Analyse** — "Hey Buddy" home → record (mock) → soundwave → similarity/trends result.
- [ ] **Smart Practice** — pick a reference → record (mock) → metrics + reference‑vs‑user waveform.
- [ ] **Library & Snippets** — browse, filter by tune/instrument/lyric, save to the vault.
- [ ] Mocked data + canned AI responses; if any real model call is added, **pin the model ID**.

## Phase 3 — Polish & ship ⏳

- [ ] Motion/transitions that reinforce "flow."
- [ ] Final responsive + a11y pass.
- [ ] Deploy (static host) and embed/link from [tusharkantnaik.com](https://tusharkantnaik.com).
- [ ] 2‑min show reel link (if available) on the case study.

## Open questions

- Scope of the interactive demo — full four‑feature click‑through, or a single hero flow first?
- Host target (Cloudflare Pages / GitHub Pages / portfolio‑embedded)?
- Do we recreate the screens as live HTML/CSS, or present the existing mockups with light interactivity?

> These are decisions for the owner before Phase 1 — don't assume them.
