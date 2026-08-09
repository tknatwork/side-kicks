# Changelog

All notable changes to **figma-limitless-mcp** (the local Figma MCP server + Dev-Mode plugin).
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
