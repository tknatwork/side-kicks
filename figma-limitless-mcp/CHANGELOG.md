# Changelog

All notable changes to **figma-limitless-mcp** (the local Figma MCP server + Dev-Mode plugin).
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- **The :1994 server no longer accepts tool calls from other devices or from web pages.** It
  listened on every network interface, and `/rpc` (which runs any tool, `execute_code` included)
  had no checks. Anyone on the same network could drive the open Figma file, and so could a web page
  in the user's browser, by sending a plain-text POST to localhost (no CORS preflight). Now:
  - only loopback peers are served;
  - `/rpc` refuses requests that carry an `Origin` header or aren't `application/json`;
  - `/ws` accepts only the plugin's sandboxed-iframe origin (`null`), figma.com, or no origin.

  Followers and the plugin are unaffected (tested).

- **The plugin socket now requires a pairing code.** The origin check above can't tell the plugin
  from a web page: a sandboxed iframe on any site sends the same `null` origin, so a page open in
  the browser could still connect to `/ws` as the plugin and receive (or answer) the AI's
  requests. The server now keeps a pairing code in `~/.figma-limitless-mcp/pairing-token`
  (created on first use, mode 0600), and the plugin must send it when it connects.
  - **One-time setup:** the plugin window asks for the code. The AI gets it with the new
    `get_pairing_code` tool, or the user reads it from the file. The plugin stores it in
    `figma.clientStorage` (private to this Figma install, never in the document).
  - A socket without the right code is held apart. It is never given requests, can't replace the
    paired plugin for its file, and everything it sends is ignored. Tool errors say a plugin is
    open but unpaired and how to fix it.
  - `get_pairing_code {rotate: true}` issues a new code; `LIMITLESS_PAIRING=off` turns pairing
    off. The code is compared in constant time and never logged.
  - **Upgrading:** rebuild and re-run the plugin, then pair once. A plugin built before this
    change can't pair.

- **Server: `@modelcontextprotocol/sdk` 1.30.0 → 1.32.1** (fixes GHSA-6qxp-vccf-f47h, high: the
  OAuth client could send credentials to an authorization server chosen by the MCP server). The
  lockfile also moves the SDK's own dependencies to patched releases: `proxy-addr` 2.0.8
  (critical, GHSA-jqcg-44mw-7w3h), `fast-uri` 3.1.8 (five high, one moderate), `qs` 6.16.1,
  `hono` 4.13.13, and `ip-address` 10.7.4 via `express-rate-limit` 8.7.1. `pnpm audit`: 18 → 0.
  No source changes; the build and all 100 unit tests pass.
- **Plugin (build tooling only; none of it ships in the bundle):** `concurrently` 9.2.4 → 9.2.5,
  the upstream backport whose only change is `shell-quote` 1.12.0 (critical,
  GHSA-pqg4-j6r4-53mv). It stays on major 9. The lockfile also moves `browserslist` 4.29.3,
  `baseline-browser-mapping` 2.11.29 and `source-map-js` 1.2.2 to patched releases. Typecheck and
  both Vite builds pass. `pnpm audit`: 6 → 1.
- **Known, not fixable upstream:** `braces` 3.0.3 (GHSA-vfj7-8cjw-p6xm, stack-exhaustion DoS on
  deeply nested patterns) has no patched release. The only path to it is `vite-plugin-singlefile` →
  `micromatch`, and `vite-plugin-singlefile` calls `micromatch.isMatch` only when `inlinePattern`
  is non-empty. `vite.config.ts` calls `viteSingleFile()` with no options, so the code never runs,
  and it would only run at build time. Revisit when `braces` or `vite-plugin-singlefile` ships a fix.

### Added — long tasks no longer break

- **Timeouts measure silence, not duration.** The plugin sends a heartbeat every 2 s listing each
  request it has queued or running, and each heartbeat restarts that request's timeout window (30 s,
  or `timeoutMs`). Long jobs, and edits queued behind them, keep going while the plugin works, up to
  a 30-minute cap. Before, the clock started at send, so edits queued behind a slow one timed out
  while still waiting, then ran anyway after the agent had moved on or retried.
- **A timeout or a client cancel cancels the request in the plugin.** An edit still queued is
  skipped, so it can't land late; one already running finishes. Cancelling a tool call in the MCP
  client (or a follower hanging up) is passed through the same way.
- **Run budget.** A request may run 4× its timeout window (at least 1 minute). Past that, the plugin
  treats it as stuck, stops reporting it (so it times out), and frees the edit queue. A hung Figma
  call no longer blocks every later edit until the plugin is reloaded.
- **Reconnect grace.** If the plugin's socket drops, in-flight requests wait up to 15 s for it to
  come back. The plugin UI keeps responses that finish while disconnected and sends them on
  reconnect; before, they were dropped. A request the reconnected plugin no longer knows about fails
  at once with a clear message.
- **MCP progress notifications.** If the client sent a progress token, heartbeats are forwarded as
  `notifications/progress`, so clients that reset their timeout on progress keep waiting through
  long Figma jobs. This applies on the leader only.
- **One undo step per tool call.** The plugin calls `figma.commitUndo()` after each edit. Before,
  every edit in the plugin session was a single undo step, so one Cmd+Z could revert an entire agent
  session.

### Added — Code Connect templates, run locally (102 → 103 tools)

- **`load_code_connect_templates`** loads Figma Code Connect template files (`*.figma.ts` /
  `*.figma.js`, the parserless format of Code Connect CLI v2) from a folder in the repo. From then
  on, `get_design_context` renders each matching instance with its real template, for its current
  property values. No Figma Org/Enterprise plan and no publishing are needed, and the same files
  still publish to real Code Connect.
  - **Bundling.** esbuild bundles each template. A template may import only `figma` and relative
    helpers, and nothing outside the loaded folder (symlinks resolved). The folder must be inside
    the server's working directory. Parser-based `.figma.tsx` files are skipped, with a pointer to
    `figma connect migrate`.
  - **Matching.** When the `// url=` points into a connected file, the plugin resolves it to the
    component (set) key, so instances match exactly in any file. Otherwise the template is keyed by
    its file name (`Button.figma.ts` → `Button`).
  - **Runtime.**
    - `figma.selectedInstance`: `getString`, `getBoolean`, `getEnum`, `getInstanceSwap`, `getSlot`,
      `getPropertyValue`, the `find*` methods (`path` and `traverseInstances` included),
      `executeTemplate`, `codeConnectId` and `hasCodeConnect`.
    - The `figma.code` / `tsx` / `html` / `swift` / `kotlin` tags, `figma.properties`, and
      approximate `figma.helpers`.
    - Nested instances render with their own template, or their props mapping, and their imports
      are merged.
  - **Sandbox.** Templates run in a `vm` context that holds no host object: the runtime is
    serialized into it, data goes in as JSON, and only strings come out. Code generation from
    strings is off and each render has a 1 s timeout. A failing template falls back to the mapping's
    props or static snippet and reports `templateError`.
  - **Mappings.** `get_code_mappings` shows a template's file and hash but not its code, and
    `set_code_mapping` keeps a mapping's template when other fields change.
- New server dependency: `esbuild` ^0.28.2. It's used only by this tool, loaded on first use, and
  `pnpm audit` is clean.

### Added — pages, SVG import, boolean operations (98 → 102 tools)

- **`manage_pages`** creates, renames, moves and deletes pages. `index` is the final position.
  Delete requires `confirm: true`, refuses to delete the only page, and switches away first when
  the page being deleted is the current one. Figma's typings don't say whether a move later in the
  list counts the page's old slot, so the move checks where the page landed and corrects once; a
  test passes every move under both behaviours.
- **`switch_page`** takes a `pageId` or an exact name. It is navigation (like `set_selection`), so
  it works in Dev Mode and isn't journaled. Reads only see the current page, and until now no tool
  could change it without `execute_code`.
- **`create_svg`** imports SVG markup as editable vector layers inside a new frame (Figma's own SVG
  import). It returns `layerCount`, so the caller can check that nothing was dropped.
- **`boolean_operation`** does `UNION`, `SUBTRACT`, `INTERSECT` and `EXCLUDE` (an editable boolean
  group) and `FLATTEN` (a single vector). The result takes the layers' place in their shared parent.
- The three edits are Dev-Mode-gated, journaled, run in the edit queue, and are one undo step each.

### Added — design to code, FigJam reads

- **`get_design_context` reports what each instance is:** a `component` object with the set name,
  variant, keys and current property values (`#id` suffix dropped).
- **Code-Connect-style mappings.**
  - `set_code_mapping` takes `component`, `imports`, `props` (Figma property → code prop, with value
    translation) and `children`.
  - `get_design_context` then gives each mapped instance a `code` block with a snippet for its
    current values, e.g. `<Button size="sm" disabled>Save</Button>` (JSX for tsx/jsx; resolved props
    for other languages).
  - A mapped instance's layers collapse to `childCount`; `expandMapped: true` keeps them.
  - `codeMappings` lists the components in use that still have no mapping.
  - Mappings are matched by component key, then component-set key, then name. Existing static
    mappings keep working and now appear in `code` too.
- **FigJam boards are readable.** Reads now include sticky and shape text, connector endpoints and
  labels, code-block code, and table cell text (first 400 cells). None of this lives in TEXT nodes,
  so a board used to read as empty shapes.
- **`pnpm test` in `plugin/`.** Serializer and composed-color tests run on the sources (Node ≥ 22.6).

### Fixed

- **`get_design_context` cost scaled with the whole subtree, not the requested depth.** It fully
  serialized every node's descendants and then dropped those below `depth`, and it re-fetched and
  re-serialized each level. A shallow read of a large page did several times the work of a full
  read, in one blocking step. It is now one depth-bounded pass, and an equivalence test over 150
  tree/depth pairs gave byte-identical output.

### Changed

- **Plugin: `@figma/plugin-typings` 1.138.0 → 1.141.0, and composed colors use the real
  `VariableComposedColor` type.** The local `ComposedColorValue` stand-in is gone, along with the
  `as unknown as VariableValue` cast that hid it from the compiler. The real type only admits the two
  shapes Figma accepts (an aliased color with a raw or aliased opacity, or a raw color with an
  aliased opacity), so `buildComposedColor` now has one branch per shape and the compiler checks
  the rule. Its checks, their order and its error messages are unchanged. `figma-139-shim.ts` is
  renamed `composed-color.ts`, since it now holds only the plugin's own runtime guards and
  `write_variables` helpers. The read guard `isComposedColorValue` now matches the type exactly, so
  it no longer accepts a raw color with a raw opacity (Figma never stores one). No change to tool
  inputs or outputs.

### Note for the operator

- `dist/` is untracked, so these fixes take effect only after a rebuild: `pnpm --dir
  figma-limitless-mcp/server build` and `pnpm --dir figma-limitless-mcp/plugin build`, then re-run
  the plugin in Figma and restart every MCP client session.
- Mixed versions are safe. An old plugin with the new server sends no heartbeats, so it keeps the
  old absolute timeouts and ignores `cancel`. A new plugin with an old server has its heartbeats
  ignored.

## [0.5.1] — 2026-09-22

### Fixed

- **`alias-target-resolves` no longer reports aliases to team-library variables as dangling.**
  This changes an ERROR rule, and it applies to plain aliases as well as composed colors.
  `getLocalVariablesAsync()` leaves out imported library variables, so every alias to one was
  reported as a dangling ERROR although Figma resolves it. `lint_run` now looks up each distinct
  non-local target (plain aliases and composed-color sides) with `getVariableByIdAsync` and sends
  the ones that resolved as `externalVariableIds` and the ones that resolved to nothing as
  `externalUnresolvedIds`. Only a target that resolves to nothing is still an ERROR, with the
  same message. The lookup stops at 2,000 ids and then sets `externalRefScanTruncated`, which the
  report's `scope` repeats. A checked target that resolved to nothing is still reported past the
  cap; an unchecked one isn't, because it can't be proven dangling. A plugin build older than
  0.5.1 sends no `externalVariableIds`, so the server keeps the old behaviour and reports every
  non-local target until the plugin is rebuilt. A file with no library aliases lints exactly as
  before.
- **No other rule draws conclusions from a library target it can't see.** A collection with no
  tier word in its name that aliases the library is no longer inferred primitive (so
  `primitive-raw-values-only`, `primitive-hidden-from-publishing`, `no-node-binds-primitive` and
  `primitive-component-single-mode` stop firing on it) or semantic; its tier is unknown and the
  rules that need the exact tier skip it. If it also aliases another local collection, it is
  still semantic or component: it is component when a target is proven semantic or component,
  and otherwise the typed-token rules (`no-all-scopes-on-typed-token`, the color, dimension and
  type role-scope matches, `hue-ramp-words-primitives-only`) still check it. A target collection
  of unknown tier may be primitive, so it doesn't make the collections above it component.
  `three-tier-collections-exist` doesn't report a missing tier when the file aliases library
  variables (the library may supply it). `multi-brand-alias-discipline` doesn't report a token
  whose chain reaches a library variable. `component-token-must-alias-semantic` skips an
  unknown-tier target, `hue-ramp-words-primitives-only` skips an unknown-tier variable that may be
  primitive, and an unknown-tier composed color adds no hop to the alias depth, as a primitive's
  alpha variant doesn't. For a library target itself, the depth, one-tier-down, component →
  semantic, contrast and binding rules were already silent, and still are.

### Changed

- Version 0.5.1 on both halves (server + plugin).

### Note for the operator

- Rebuild both halves — `pnpm --dir figma-limitless-mcp/plugin build && pnpm --dir
  figma-limitless-mcp/server build` — then re-run the plugin in Figma **and restart every MCP
  client session**. The fix needs the new plugin: until it is rebuilt and re-run, library aliases
  are still reported as dangling ERRORs.

## [0.5.0] — 2026-09-22

### Added — Figma Plugin API Updates 134–139 (typings 1.138.0)

- **Text wrap style (Update 134)** — `textWrapStyle` (`AUTO` / `BALANCE` / `PRETTY`) on
  `set_text_properties`, `create_text`, `create_text_style` and `update_text_style`; read back by
  `get_text_styles`, `get_styles`, the create/update text-style results and the node serializer
  (`get_node` / `get_selection` / `get_design_context`, `'mixed'` when paragraphs differ). On an
  older Figma a write fails with a capability error before anything changes.
- **`set_auto_layout` `primaryAxisAlignItems`: `SPACE_EVENLY` / `SPACE_AROUND` (Update 137)** —
  CSS `justify-content: space-evenly / space-around`. The schema enum and the plugin whitelist
  widen together (the plugin skipped unknown values silently), and the whitelist now fails
  `pnpm typecheck` if a typings update adds a value it lacks — and so the plugin build, which now
  type-checks before bundling (vite/esbuild strip types without checking them). Reads pass
  Figma's value through, so consumers that switch on MIN/MAX/CENTER/SPACE_BETWEEN should handle
  the new two. `counterAxisAlignItems` is unchanged.
- **Variable fonts (Update 138)**:
  - `variationSettings` (e.g. `{wght: 550}`) on the same four text write tools, validated up
    front: a static family, an axis tag the family doesn't define (the error lists the valid
    ones) or a Figma without the API fails before anything changes. With the family and style
    unchanged the axes merge over the current ones (range by range on text whose ranges differ
    only in axes), and repeating the current family/style without axes keeps custom axes instead
    of resetting them to the named instance; the style is inferred only when the family
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
  (1.138.0 is the latest), so composed values run on a local stand-in type plus runtime shape
  detection in `plugin/src/main/figma-139-shim.ts` — swap the stand-in for the real
  `VariableComposedColor` when typings ≥ 1.139 ship it (the runtime guards and input helpers
  stay). `COLOR_OPACITY` needs no shim: scope strings are already cast to `VariableScope`.

### Changed

- **`@figma/plugin-typings` 1.137.0 → 1.138.0** (exact pin + lockfile).
- Version 0.5.0 on both halves (server + plugin).
- The plugin `build` script type-checks (`tsc --noEmit`) before bundling, so a type error — such
  as a typings value missing from a whitelist — now fails the build instead of shipping.
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
  alias edges for alias-in-every-mode, component → semantic, one-tier-down, cycles and depth,
  orphan usage (`unused-variable-orphan`) and multi-brand routing, and a dangling reference inside
  a composed color is an `alias-target-resolves` ERROR. Tier classification counts only the color
  side (a COLOR drawing its opacity from a FLOAT collection doesn't re-tier its palette).
  `primitive-raw-values-only` still allows a same-collection alpha variant, which adds no hop to
  the alias depth; a composed color at 100% opacity is contrast-checked only when its color side
  is opaque too.
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
