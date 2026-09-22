# Changelog

All notable changes to **figma-limitless-mcp** (the local Figma MCP server + Dev-Mode plugin).
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] — 2026-09-22

### Added — Figma Plugin API Updates 134–139 (typings 1.138.0)

- **Text wrap style (Update 134)** — `textWrapStyle` (`AUTO` / `BALANCE` / `PRETTY`) on
  `set_text_properties`, `create_text`, `create_text_style` and `update_text_style`; read back by
  `get_text_styles`, `get_styles`, the create/update text-style results and the node serializer
  (`get_node` / `get_selection` / `get_design_context`, `'mixed'` when paragraphs differ). On an
  older Figma a write fails with a capability error before anything changes.
- **`set_auto_layout` `primaryAxisAlignItems`: `SPACE_EVENLY` / `SPACE_AROUND` (Update 137)** —
  CSS `justify-content: space-evenly / space-around`. The schema enum and the plugin whitelist
  widen together (the plugin skipped unknown values silently), and the whitelist now fails the
  build if a typings update adds a value it lacks. Reads pass Figma's value through, so consumers
  that switch on MIN/MAX/CENTER/SPACE_BETWEEN should handle the new two. `counterAxisAlignItems`
  is unchanged.
- **Variable fonts (Update 138)**:
  - `variationSettings` (e.g. `{wght: 550}`) on the same four text write tools, validated up
    front: a static family, an axis tag the family doesn't define (the error lists the valid
    ones) or a Figma without the API fails before anything changes. With the family and style
    unchanged the axes merge over the current ones; the style is inferred only when the family
    changes with axes and no style, or `create_text` gets axes and no style. Text styles always
    keep an explicit style.
  - `load_fonts` accepts `{family}` with no style to load every style of the family.
  - `list_fonts` reports `variationAxes` per family whenever styles are included (`null` =
    static family) — the only valid `variationSettings` keys.
  - Reads: `fontVariationSettings` on text nodes, `fontName.variationSettings` on text styles,
    and `create_text` returns the resolved `fontName`.
- **Composed colors + the `COLOR_OPACITY` scope (Update 139)** — a COLOR value can be
  `{color, opacity}`: the color `'#RRGGBB'` / `{r,g,b,a}` / `{alias}`, the opacity a 0–100
  percentage (`60` = 60%) or `{alias}`, and at least one side an alias. `write_variables`
  `set_value` / `create_variable` author it (`'$N.variableId'` refs resolve inside the alias
  sides); `get_variable_defs` / `get_variables_deep` read it as `{type:'COMPOSED_COLOR', color,
  opacity}`, nested aliases resolved. `COLOR_OPACITY` (a color's opacity channel, FLOAT) is
  distinct from `OPACITY` (layer opacity). No published `@figma/plugin-typings` has Update 139 yet
  (1.138.0 is the latest), so it runs on a local shim, `plugin/src/main/figma-139-shim.ts`, plus
  runtime shape detection — delete the shim when typings ≥ 1.139 ship these types.

### Changed

- **`@figma/plugin-typings` 1.137.0 → 1.138.0** (exact pin + lockfile).
- Version 0.5.0 on both halves (server + plugin).
- `update_text_style` validates and loads the new font and axes before any patch, so a bad font,
  family or axis now applies nothing (property patches used to land first).

### Fixed

- **TIMING values are seconds, not milliseconds.** The 0.4.0 notes, the `write_variables`
  descriptions and the plugin's error text said milliseconds; Figma's `VariableValue` reference
  defines seconds (`0.2` = 200 ms). Values have always passed through unchanged, so only the
  documentation was wrong — but check any TIMING values written by following the old wording.
- **Linter false ERRORs** — `scope-legal-for-resolved-type` no longer flags `COLOR_OPACITY` or
  `TEXT_CONTENT` on FLOAT variables (both are in Figma's FLOAT scope list; the `TEXT_CONTENT` one
  predates this release). A FLOAT scoped only `[TEXT_CONTENT]` is exempt from
  `no-text-content-scope-on-token`, like a STRING.
- `dimension-role-scope-match` accepts `opacity/*` scoped `[COLOR_OPACITY]` as well as `[OPACITY]`.
- **Composed references in the alias graph** — a composed color's color/opacity aliases count as
  alias edges for tier classification, alias-in-every-mode, component → semantic, one-tier-down,
  cycles and depth, orphan usage (`unused-variable-orphan`) and multi-brand routing, and a
  dangling reference inside a composed color is an `alias-target-resolves` ERROR.
  `primitive-raw-values-only` still allows a same-collection alpha variant.
- **Text whose ranges differ only in axes** — since Update 138 `fontName` reads `mixed` for it.
  Such nodes now report their family/style plus `fontVariationSettings: 'mixed'` instead of
  `'mixed'` fonts, `set_text_properties` can change their family or style again, and FigJam
  sublayer text writes load every range's font instead of falling back to Inter Medium.
- `create_text` resolves the font before creating the node and removes the node on any later
  failure, so a failed call no longer leaves an orphan text node behind.

### Note for the operator

- `dist/` is untracked on both halves: rebuild both —
  `pnpm --dir figma-limitless-mcp/plugin build && pnpm --dir figma-limitless-mcp/server build` —
  then re-run the plugin in Figma **and restart every MCP client session**.
- A stale 0.4.1 server still holding :1994 as leader validates follower `/rpc` calls with its OLD
  schemas (`leader.ts`), so it answers 400 for the new enum values (`SPACE_EVENLY` /
  `SPACE_AROUND`) and for calls that set only a new field (`textWrapStyle` or
  `variationSettings` alone). `get_workspace_status` reports the leader's version — check it
  says 0.5.0.

## [0.4.1] — 2026-09-01

### Changed

- **`@figma/plugin-typings` 1.133.0 → 1.137.0** — the Figma API surface moved four typings
  releases past the 0.4.0 pin. The refresh compiles clean with **no code changes required**:
  nothing this codebase touches was broken or renamed. No new 1.134–1.137 API surface is
  ADOPTED in this release — this is the pin catching up so the next capability work starts
  from current typings, not a five-week-old view of the API. (`AGENTS.md`'s documented pin
  updated to match — the doc said 1.133.0 and would have kept saying so.)
- Version 0.4.1 on both halves (server + plugin), so `get_workspace_status` reports the
  refreshed build once the plugin is rebuilt and restarted.

### Note for the operator

- `dist/` is untracked on both halves: after merging, rebuild before restarting —
  `pnpm --dir figma-limitless-mcp/plugin build && pnpm --dir figma-limitless-mcp/server build`.

## [0.4.0] — 2026-08-09

### Added — Figma 2026-08 API surface (typings 1.133.0)

- **Motion variables (`EASING` / `TIMING`)** across the variable tools: `write_variables`
  accepts the new resolved types (EASING values are `{ type, easingFunctionCubicBezier?,
  easingFunctionSpring? }`, TIMING values are milliseconds), reads emit a stable plain-copy
  wire shape, and the lint scope rule knows both types are fixed to `ALL_SCOPES`
  (measured: Figma rejects `set_scopes` on motion variables entirely).
- **Video export in `save_screenshots`** — `MP4` / `GIF` / `WEBM` with `fps`, `quality`,
  `loopCount` (GIF) and `videoConstraint` (SCALE 0.5–4 / WIDTH / HEIGHT); `.mp4/.gif/.webm`
  extensions infer their format. Video items get a 120 s bridge budget. Deliberately not
  offered on `get_screenshot`, which returns base64 into the model's context. Measured:
  Figma rejects video export of non-animated nodes with "Cannot export node as video";
  the error is reported per item.

### Added — design-system knowledge & linting layer

An offline, closed-loop layer for building and checking design systems ("build → lint → fix"),
served entirely over the local plugin bridge — no network, no design-tool AI credits.

- **Skills tools** — `list_skills`, `read_skill`, and `get_build_recipe` serve the bundled
  design-system knowledge base (token architecture, scopes, theming, components, code-output,
  accessibility) plus the canonical **Primitive → Semantic → Component** build order. Each build
  step returns an **actionable lint gate**: the exact `lint_design_system` call to run, split into
  enforced-now vs forward-declared rules from the live registry.
- **`lint_design_system`** — a structure linter covering the full **57-rule catalog** across seven
  tiers (tokens, scopes, theming, naming, components, code-output, accessibility). It gathers the
  variable graph, styles, components, node bindings, and bounded per-component enrichment (after
  loading all pages) and reports each defect with a fix hint linked to the skill that explains it.
- **Opt-in / configurable rules** — `enable` / `disable` / `config` options let teams turn on
  house-style rules (kept off by default) and parameterize them (e.g. `variant-count-ceiling`,
  `min-font-size` floor, `numeric-scale-zero-padded` width, `semantic-role-allowlist`,
  `multi-brand-alias-discipline`). Invalid config is reported non-fatally under `config_errors`;
  each report advertises the available opt-in rules and how to enable them.

### Changed

- The plugin's snapshot gather now also collects **bounded per-component aggregates** (raw-paint /
  untyped-text / min-font-size / property references / variant tuples), TEXT-style font metrics,
  and instance / dev-resource / detached-frame signals. Every collection is capped with a
  truncation flag; truncation only ever suppresses findings, never fabricates them.

### Notes

- **Advisory, not prescriptive.** The linter is strictly read-only and never modifies a design
  system. Only objectively-broken issues are errors (a reference that resolves nowhere, a scope the
  tool rejects for the type); every opinionated structural rule is a warning, and house-style rules
  are off by default. Contrast pairing only fires on the explicit `on-<X>` naming convention rather
  than guessing.
- Verified against a real 1,121-variable / 48-page / 376-component design system, and covered by a
  `node:test` suite (`pnpm test`) including a golden clean-file fixture that must report zero findings.

### Fixed

- **Video export 400'd on the follower → leader path.** `save_screenshots` executes on the
  follower and fans out per-item wire `get_screenshot` requests; the leader re-validated that
  RPC against the MCP-facing `get_screenshot` schema, which rejects video *by design* — so every
  video item failed with "Leader returned status 400" in multi-instance topologies. `validateRpc`
  now checks that hop against a wire schema. Found by live leader/follower testing; the MCP
  boundary is unchanged (`get_screenshot` still rejects video formats).
- **Plugin typecheck restored** — newer `@figma/plugin-typings` type `.parent` as a distributed
  union containing impossible members (`CodeBlockNode & ChildrenMixin`); the instance-ancestor
  walk now widens explicitly to `BaseNode | null` (#44).
- **Dependency security** — all open Dependabot alerts resolved: fast-uri 3.1.5, ip-address
  10.4.0, hono 4.13.1, `@hono/node-server` 2.1.0 (via `@modelcontextprotocol/sdk` 1.30.0),
  postcss 8.5.26. Within-semver, test-gated.

### Changed (housekeeping)

- `@figma/plugin-typings` pinned **1.130.0 → 1.133.0** (video export settings, motion variables,
  `playheadPosition`).

## [0.3.0] — 2026-07-13

### Added

- Batch of ~17 tools: prototyping, master components & instances, screens, styles, published
  library assets, dev resources, and local code-mapping.
- Crash-safe orchestration layer: op-journal, named checkpoints, TTL locks, cached file digests,
  and workspace-status introspection for session resume.
- New authoring surfaces: deep variable read + write, grid layout, annotations, reactions, and the
  beta Motion / Shaders APIs.

## [0.2.0] — 2026-07-13

### Added

- Local-font enumeration/loading and text / paint / effect style tooling.
- A Plugin-API `execute_code` escape hatch (JSON-only, size-capped).

## [0.1.0] — 2026-07-13

### Added

- Initial project: a local Figma MCP server + Dev-Mode plugin bridged over `ws://localhost:1994`,
  using the Figma Plugin API only (no REST, no token — the Plugin API has no REST-style rate limits). Registered as a user-scope
  MCP server; dev plugin imported into Figma Desktop.
