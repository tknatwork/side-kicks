# AGENTS.md — figma-limitless-mcp

> Canonical AI-builder rules for this project. `CLAUDE.md` is a pointer here.

## What this is

A local Figma MCP server + Figma Desktop plugin. No REST calls, no rate
limits. 72 tools: local fonts, text/paint/effect styles, variable authoring,
grid layout, master components, instances, prototyping, annotations, dev
resources, Motion/shaders (beta), plus a crash-safe orchestration layer
(journal, checkpoints, TTL locks, cached digests). AI operating rules:
`docs/AI-GUIDE.md`.

## Architecture (2 packages)

- `server/` — stdio MCP server (`node dist/index.js`), TypeScript → `tsc`. Leader binds HTTP+WS on **:1994** (`/ws` plugin, `/ping` health, `/rpc` followers); extra clients become followers and proxy via `/rpc`. Multi-file registry keyed by `fileKey`.
- `plugin/` — Figma plugin. `src/main/code.ts` (sandbox: request handlers) + `src/ui/` (React iframe: owns the WebSocket). Built with vite → `dist/code.js` + `dist/index.html`; `manifest.json` points at both. Typings pinned `@figma/plugin-typings` **1.130.0** (Motion/Shaders/Slots/Grid APIs).

## Orchestration layer (server/src/orchestration.ts)

The LEADER owns an `Orchestrator`: disk journal (`~/.figma-limitless-mcp/journal/<fileKey>.jsonl`,
5MB rotation, seq recovered across restarts), checkpoints (`checkpoints/<fileKey>/<name>.json`,
≤256KB), TTL locks (`locks.json`), and an in-memory digest cache. `Leader.execute()` is the single
choke point for every tool call (own client via `Node.sendWithParams`, followers via `/rpc`):
META_TOOLS resolve locally, `get_file_digest` is cache-read-through, everything else forwards to
the plugin with mutations journaled (JOURNALED_TOOLS). Cache invalidation is double-sourced:
plugin-side page `nodechange` events batched 1s into requestId-less `doc-event` WS messages
(`Bridge.onPluginEvent`), plus the leader self-invalidates after its own journaled writes.
Agent identity defaults to MCP clientInfo (`node.agentSupplier`); tools accept an explicit
`agent` for stable task names. **Adding a mutating tool ⇒ add it to both EDIT_REQUEST_TYPES
(plugin) and JOURNALED_TOOLS (orchestration.ts).**

## Beta-API tools (Motion, Shaders)

`get_motion`/`apply_animation_style`/`list_shaders`/`apply_shader` guard with `'motion' in figma` /
`'listAvailableShaders' in figma` and throw clear capability errors on older Figma builds — the
APIs are beta ("subject to change" per Plugin API Update 127, June 2026). Verified live 2026-07-13:
Motion styles enumerate; shaders API present (0 shaders in file).

## Design-system skills + structure linter (closed loop)

Two offline halves that answer "how should the tokens be derived?" and "is the
structure right?" — no network, no Figma AI credits.

- **Knowledge** — Markdown skills bundled in `server/skills/`, copied to
  `dist/skills/` at build (`scripts/copy-skills.mjs`) and served by
  `server/src/skills.ts`: `list_skills` (catalog), `read_skill(slug)` (full doc,
  whitelisted slug — no path traversal), `get_build_recipe(step?)` (the canonical
  Primitive→Semantic→Component order + the step's **actionable lint gate**).
- **Linter** — `lint_design_system` runs 33 detectors over a `LintSnapshot`. The
  plugin's `lint_run` gathers the snapshot (variable graph + styles + components +
  node bindings, after `loadAllPagesAsync()`); the server runs the detectors,
  which are **pure functions** `(snap) => PartialFinding[]` in
  `server/src/lint/detectors/<tier>.ts`, registered into the `DETECTORS` map via
  the `detectors/register.ts` side-effect that `lint/index.ts` imports.

**The closed loop:** `get_build_recipe(step)` → build that tier → run the gate's
`run` call (`lint_design_system {only:[…]}`) → fix `severity:error` findings →
advance to `next_step`. `buildGate` splits each gate into `enforced_now` vs
`forward_declared` from the live registry at runtime, so a gate never asks the
lint tool for a rule whose detector hasn't landed.

**Philosophy — advise, don't dictate (load-bearing).** Everyone's DS structure is
their own choice. Only *objectively broken* things are `severity:error`
(alias-target-resolves, scope-legal-for-resolved-type); every opinionated rule is
`warn`. The linter is **read-only — it never mutates the design system.** Rules
must only assert what they can prove: e.g. a11y contrast pairs fg↔bg *only* via
the explicit `on-<X>` naming convention, never by guessing from suffixes (loose
matching fabricated 53 findings on a real 3-tier DS that just doesn't use `on-X`).

**Opt-in config surface.** House-style / config-required rules (`semantic-role-allowlist`,
`top-segment-in-tier-vocabulary`, `numeric-scale-zero-padded`, `codesyntax-web-matches-name`)
are marked `defaultOn:false` in the registry and run ONLY when explicitly enabled
— so the default lint stays advisory-but-precise. `runLint`/`lint_design_system`
take `enable[]` / `disable[]` / `config{}` (per-rule, keyed by rule_id). Config is
validated in `lint/config.ts` (`resolveRuleConfig` → `LintConfigError`); bad/missing
config for an enabled rule is reported under `config_errors` and the rule skipped —
never a crash (detectors also run inside per-rule try/catch → `rule_failures`). The
report's `available_optin[]` advertises every off-by-default rule with its
`config_shape` + an `enable_hint`, so the AI can discover and turn them on.
`analyze(snap)` is WeakMap-memoized so the whole suite classifies the graph once.

**Adding a detector** touches 3 places: the pure fn in
`server/src/lint/detectors/<tier>.ts` (signature `(snap, config?)`) + its bundle
export (already `Object.assign`ed in `detectors/register.ts`), and the rule entry
in `server/src/lint/registry.ts` (objectively-broken → `error`, else `warn`; add
`defaultOn:false` for house-style/config rules). For a **configurable/opt-in**
rule also add a `RULE_CONFIG` entry in `lint/config.ts` (shape + defaults +
validation) and read the resolved `config` arg in the detector. Then add a fixture
case to `server/test/` and, if it belongs to a build step, wire it into
`STEP_GATES` in `skills.ts`.

## Conventions & invariants

- **pnpm only** (workspace rule). Build: `pnpm install && pnpm run build` in each package.
- Port **1994** is hardcoded in `server/src/index.ts`, `plugin/src/ui/App.tsx`, `plugin/manifest.json` — change all three together or not at all.
- Adding a tool touches 4 places: `plugin/src/main/code.ts` (RequestType union + handler, EDIT_REQUEST_TYPES if it writes), `server/src/schema.ts` (input schema + `toolInputSchemas` + `rpcToArgs` — Record types make omissions compile errors), `server/src/tools.ts` (registration). Refined Zod schemas register the **unrefined** `.shape` and validate the refined schema via `parseToolInput` (see `update_text_style`).
- Font rules are load-bearing: exact `{family, style}` strings only (discover via `list_fonts`, never guess); load fonts before any text/style mutation; `lineHeight`/`letterSpacing` are `{unit, value}` objects.
- Write tools must stay Dev-Mode-guarded (`EDIT_REQUEST_TYPES`); `delete_nodes` keeps its `confirm: true` gate; `execute_code` returns JSON-only, size-capped.
- Rebuild `plugin/dist` after ANY `plugin/src` edit and re-run the plugin in Figma — Figma loads the built bundle, not the source.
- File keys: saved team files expose `figma.fileKey` (unique). Personal drafts don't, so the plugin persists a unique random key in the document's shared plugin data (`getFileKey`) — stable across restarts, distinct per file. Do NOT revert to name-derived keys (same-named drafts collide, breaking per-file journal/checkpoint buckets).

## Testing

Two layers:

- **Unit** — `cd server && pnpm test` (builds, then `node --test test/*.test.mjs`).
  Runs against compiled `dist/`, no Figma needed — the lint detectors are pure
  functions. Covers the a11y contrast regression (on-`X` pairing, same-colour
  skip, suffix-only non-pairing) and the **golden clean-file fixture** (a correct
  3-tier DS that must produce 0 findings across the full suite — the anti-noise
  ratchet). **Server/detector code cannot be hot-reloaded into a running MCP
  session** (stdio, spawned once at session start), so verify detector changes
  here offline; a live re-lint only reflects new code after a fresh session.
- **Live E2E** — `scripts/e2e-live-test.mjs` exercises ~50 tool paths against a
  real Figma file. Prereq: Figma Desktop open with the plugin running in a scratch
  file. Run `node scripts/e2e-live-test.mjs` from the repo root (or
  `FILE_KEY=<key> node …` to target one of several connected files). It creates
  everything inside a dedicated test page and removes all artifacts (page, styles,
  variables, collections, temp state) on exit — the file is left as found. Only
  one MCP server may hold `:1994`; kill stragglers first (`lsof -i :1994`) so the
  test runs as leader, not follower.

## Registration

User-scope MCP entry in `~/.claude.json` → `mcpServers.figma-limitless-mcp`
(`node <this>/server/dist/index.js`). The plugin is imported into Figma Desktop
via Plugins > Development > Import plugin from manifest… → `plugin/manifest.json`.

## Boundaries

- `LICENSE.md` ships intact with every copy — never edit or remove it.
- No user-specific font names, file keys, or account details in code, schemas, or docs — examples stay generic.
