# How the official Figma MCP understands & helps AI build — distilled

> Source basis: the four official skill packs on this machine
> (`~/.claude/skills/figma-use`, `figma-generate-library`, `figma-generate-design`,
> `figma-code-connect`), read 2026-07-13. This is the mental model our native
> bridge (`figma-limitless-mcp`) borrows from and deliberately diverges from.

## 1. The read path: three representations, three costs

| Tool | Representation | When the official flow uses it |
|------|----------------|-------------------------------|
| `get_metadata` | Compact XML tree: ids, types, names, positions, sizes | Cheap structural validation after **every** write (counts, hierarchy, variant names) |
| `get_design_context` | React+Tailwind *structural approximation* + named text styles + Code Connect snippets | Understanding a selection; explicitly "a structural reference, not a literal source" |
| `get_screenshot` | Pixels | Visual milestones only (colors, typography rendering, mode resolution) |

Key ideas worth copying: **validate cheap, screenshot rarely**; design context is
selection-based (nothing selected → error, recover via metadata); named text
styles ride along with the context so the agent thinks in tokens, not raw values.

Our bridge equivalent: `get_metadata` / `get_design_context` (depth-limited tree)
/ `get_screenshot` already exist upstream. Ours returns raw serialized nodes
rather than React approximations — leaner, less opinionated, and fine for a
design-system session that knows its node IDs.

## 2. The write path: use_figma's execution contract

The official write surface is **one tool** — `use_figma` — executing plain
JavaScript with top-level await against the Plugin API, with hard behavioral
rules (no API rate limits anywhere; the limits are practiced discipline):

- The **return value is the only output channel** (console.log invisible); return all created/mutated node IDs.
- Failed scripts are **atomic** — no partial changes.
- **≤ ~10 logical operations per call**; mutations strictly sequential, never parallelized across calls.
- One `setCurrentPageAsync` per call max; page context resets each call.
- Efficiency helpers: `node.query(css)`, `node.set(props)`, `figma.createAutoLayout`, `findAllWithCriteria` + `figma.skipInvisibleInstanceChildren=true`.
- Error protocol: STOP on error, diagnose via metadata/screenshot before retrying.

Our bridge equivalent: dedicated typed tools for the common 90% (safer than
freeform JS: Zod-validated, Dev-Mode-guarded, per-tool font handling) **plus**
`execute_code` as the escape hatch with the same shape (top-level await, `figma`
in scope, JSON-return-only, size-capped). The ≤10-ops and sequential-mutation
disciplines apply to how an agent *uses* `execute_code`, and belong in any
consuming session's prompt.

## 3. Fonts: the most-legislated constraint (and our whole reason to exist)

Official rules, verbatim in spirit:

1. **Every text mutation requires `loadFontAsync` of the exact `{family, style}` first** — including indirect ones (appendChild into text, setBoundVariable on text fields, valuesByMode writes touching text).
2. **Style strings must be discovered via `figma.listAvailableFontsAsync()` — "never guess or probe with try/catch"** ('SemiBold' vs 'Semi Bold' is the canonical footgun).
3. When mutating existing text, load the node's *current* fonts (`getStyledTextSegments(['fontName'])` / `getRangeAllFontNames`) — not a hardcoded default.
4. Applying a text style to a node (`setTextStyleIdAsync`) does **not** require the font loaded; editing content/properties does.
5. Font-family design tokens are STRING variables scoped `FONT_FAMILY` / `FONT_STYLE`, values are exact Figma `fontName` strings, bindable to text styles via `setBoundVariable`.

**The gap we close:** remotely, `listAvailableFontsAsync` sees only Google/shared
families (1723 on this account) — zero local licensed faces. Inside Figma Desktop
the same API sees everything installed on the Mac. Hence `list_fonts` (enumerate
exact strings, the rule-2 source of truth) and `load_fonts` (rule-1 compliance +
availability report) as first-class tools.

## 4. Text styles: creation and application rules

- `lineHeight` / `letterSpacing` must be `{value, unit}` objects or `{unit:'AUTO'}` — bare numbers throw. (Our schemas enforce this shape; the DSB relic silently multiplied numbers ×100 into PERCENT — a bug class we avoid by construction.)
- Font must be loaded before setting `style.fontName`; TextStyle property setters require the style's font loaded even when unchanged.
- Style names are slash-grouped and **not unique** — target by id; description convention `CSS: var(--token-name)`.
- Type ramps are created idempotently: dedupe fonts → `Promise.all` loads → skip existing names → create. (`create_text_style.skipIfExists` encodes this.)
- **Updating a style's `fontName` re-fonts every bound node automatically** — the design-system-wide swap lever (`update_text_style`).

## 5. Library building order (figma-generate-library)

Phases are strict: **Discovery → Foundations (collections/modes → primitives →
semantic aliases → scopes on ALL variables → effect + text styles) → file
structure → components one-at-a-time in atom→molecule order → Code Connect /
audits**. "Variables BEFORE components — no token = no component." State is
ledgered to disk (`/tmp/dsb-state-{RUN_ID}.json`) with `setSharedPluginData`
tags on every created node; resume = read-only rescan. Never hallucinate node
IDs — read them back.

Relevance to the rebuilt file (`yIzO6LwpGMO8z11XYx5PIW`): its 8 collections
(Seed-colour, Seed, Alias, Alias-colour, Map, Responsive, Type, Semantic),
24 text styles and 6 elevation styles are already built; our job is the **font
layer only**. The obscured-name divergence is intentional: Figma keeps real
faces, the token graph ships role names ('Sans Face' etc.) — never sync them.

## 6. Variables and discovery scope

- `getLocalVariableCollectionsAsync()` sees **only file-local** variables; empty ≠ none (library variables need `search_design_system` / import-by-key remotely). Our bridge is local-file-scoped by design — fine for the DS file which owns its collections.
- Aliases come back as `{type:'VARIABLE_ALIAS', id}`; the official tooling resolves them to names. (Upstream `get_variable_defs` returns raw ids — a known gap; resolve via `execute_code` join when needed.)
- Bindings: `setBoundVariableForPaint` returns a NEW paint to reassign; text fields (fontFamily/fontSize/…) are bindable as of plugin-typings 1.130.

## 7. Code Connect (context, not a bridge concern)

Code Connect makes Dev Mode / `get_design_context` return *real* code instead of
approximations and requires published library components + Org/Enterprise plan.
It lives entirely in the official/remote surface — out of scope for the local
bridge, listed here so nobody wonders where it went.

## 8. What our native bridge deliberately does differently

| Official MCP | figma-limitless-mcp |
|---|---|
| Remote, rate-limited, no local fonts | Local plugin in Figma Desktop: all installed fonts visible/loadable, no REST calls at all |
| One freeform `use_figma` JS tool | Typed Zod-validated tools for the common cases + `execute_code` escape hatch |
| Selection-centric context | Node-id-centric (multi-file via `fileKey` registry) |
| Skills legislate font discipline | Font discipline is **built into the tools** (auto-load before style ops, exact-string discovery tool) |
| No style application tool documented | `apply_text_style` / `update_text_style` first-class |
