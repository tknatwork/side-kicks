# Changelog

All notable changes to **figma-limitless-mcp** (the local Figma MCP server + Dev-Mode plugin).
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
