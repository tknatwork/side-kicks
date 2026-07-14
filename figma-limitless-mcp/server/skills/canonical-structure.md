
# The Flawless Design-System Structure (Canonical Build Order)

> This is the single source of truth the AI follows **top-to-bottom** when building or repairing a design system in Figma via `figma-limitless-mcp`. It exists to kill trial-and-error: the hardest problem — *how tokens are derived (primitive → semantic → component) and why code output "always messes it up unless we build each part one by one"* — is solved by making the derivation **explicit, ordered, and lint-gated**. Build one layer, lint it, fix, then descend. Never skip a gate.

## 0. The Iron Law of the Three Tiers

Every value in a correct system lives in exactly one of three collections, and data only ever flows **down one tier at a time**:

```
Primitive  (raw literals, no aliases)          e.g.  color/blue/500 = #2F6FED
   │  alias, exactly one tier down
   ▼
Semantic   (aliases only, theme-aware modes)   e.g.  color/bg/accent → {color/blue/500}
   │  alias, exactly one tier down
   ▼
Component  (aliases only, single mode)          e.g.  button/bg/rest → {color/bg/accent}
```

Nodes and component layers **bind to Component tokens** (or Semantic where no component token is warranted) — **never to Primitives**. This is the rule `design-to-code-correctness` depends on: codegen reads the binding chain and emits `button.bg.rest` → `--color-bg-accent` → `#2F6FED`. Bind a node straight to `color/blue/500` and codegen emits a magic literal — the exact failure the owner keeps hitting.

**Lint gate after this section:** `three-tier-collections-exist`, `no-node-binds-primitive`, `alias-one-tier-down`.

---

## 1. Collections & Modes (build these first, empty)

Create exactly these collections with these mode axes. **One theme axis per collection** — never mix brand and appearance modes in one collection.

| Collection | Purpose | Modes (this is the whole mode set) | `defaultModeId` |
|---|---|---|---|
| **Primitives** | Raw literals. The palette, the raw scale. | **single mode** `Value` | `Value` |
| **Semantic** | Theme-aware roles. Aliases into Primitives. | `Light`, `Dark` (add `hc-light`/`hc-dark` only if HC is real) | `Light` (the base) |
| **Component** | Per-component tokens. Aliases into Semantic. | **single mode** `Value` | `Value` |

Rules baked in here:
- Primitives + Component are **single-mode** (`primitive-component-single-mode`). Theming happens **only** in Semantic. If a primitive needs two values, it was mis-tiered — it is a semantic role.
- Mode names are consistent across the appearance axis (`consistent-mode-names-across-axis`), the default Semantic mode is the neutral base (`semantic-default-mode-is-base` → `Light`).
- Keep the mode count sane: `mode-count-ceiling` (soft cap, heuristic/config: appearance ≤ 4). Multi-brand goes in its **own** collection with its own alias discipline (`one-theme-axis-per-collection`, `multi-brand-alias-discipline`), never as extra modes stapled onto Semantic.

**Lint gate:** `primitive-component-single-mode`, `mode-count-ceiling`, `semantic-default-mode-is-base`, `consistent-mode-names-across-axis`, `one-theme-axis-per-collection`.

---

## 2. Tier 1 — Primitives (raw values only)

Populate Primitives with **literals only — zero aliases** (`primitive-raw-values-only`).

**Naming** (`hue-ramp-words-primitives-only`, `numeric-scale-zero-padded`, `name-kebab-segments`, `name-slash-structure-depth`):
```
color/{hue}/{step}      color/blue/500      color/slate/050     (steps zero-padded, 050→900)
space/{step}            space/04            space/16            (numeric scale)
radius/{step}           radius/sm           radius/lg
font-size/{step}        font-size/md
font-family/{role}      font-family/sans
```
- Hue words (`blue`, `slate`) are **legal in Primitives only** — they must never appear in Semantic/Component names.
- Slash depth ≤ 3, every segment kebab-case, numeric ramps zero-padded so they sort.

**Scopes** — even primitives get typed scopes so they can't be mis-bound (`scope-legal-for-resolved-type`, `no-all-scopes-on-typed-token`):
- COLOR primitive → `ALL_FILLS, STROKE_COLOR` (not `ALL_SCOPES`).
- FLOAT space/gap primitive → `GAP, WIDTH_HEIGHT`.
- FLOAT radius primitive → `CORNER_RADIUS`.
- FLOAT font-size → `FONT_SIZE`.
- STRING font-family → `FONT_FAMILY`.

**Publishing:** primitives are **hidden from publishing** (`primitive-hidden-from-publishing`) — consumers get Semantic/Component, not the raw palette. Deduplicate: no two primitives with the same value (`duplicate-primitive-value`).

**Lint gate:** `primitive-raw-values-only`, `hue-ramp-words-primitives-only`, `numeric-scale-zero-padded`, `primitive-hidden-from-publishing`, `duplicate-primitive-value`, and the scope pack (`scope-legal-for-resolved-type`, `no-all-scopes-on-typed-token`, `non-redundant-scope-set`).

---

## 3. Tier 2 — Semantic (aliases + theming, the derivation heart)

This is where the owner's "how tokens should be derived" problem is actually answered. Every Semantic variable is an **alias into a Primitive** (`alias-one-tier-down`, `alias-target-resolves`) and is **populated in *every* mode** (`semantic-alias-in-every-mode`).

**Role vocabulary is a closed allowlist** (`semantic-role-allowlist`) — the only legal top segments in Semantic:
```
color/bg/*        surface & fills        color/bg/canvas, color/bg/surface, color/bg/accent
color/fg/*        text & icons           color/fg/default, color/fg/muted, color/fg/on-accent
color/border/*    strokes                color/border/default, color/border/focus
space/*           layout spacing roles   space/inset-md, space/stack-lg
radius/*          role radii             radius/control, radius/card
text/*            composite type roles   text/body-md, text/heading-lg
```

**The fg/bg pairing law** (`surface-on-pair-completeness`): every `color/bg/{role}` that carries content must have a matching `color/fg/on-{role}`. `bg/accent` ⇒ `fg/on-accent`. This is what makes contrast checkable and codegen's surface pairs complete.

**Theming = re-aliasing per mode**, never new literals:
```
color/bg/accent   Light → {color/blue/600}    Dark → {color/blue/400}
color/fg/default  Light → {color/slate/900}   Dark → {color/slate/050}
```
Both modes alias primitives; only the *target* changes. This gives free, correct dark mode (`theming-with-modes`).

**Scopes are role-matched** (`color-role-scope-match`, `dimension-role-scope-match`, `type-role-scope-match`):
| Role | Legal scopes |
|---|---|
| `color/bg/*` | `FRAME_FILL, SHAPE_FILL` |
| `color/fg/*` | `TEXT_FILL` (+ `SHAPE_FILL` for icons) |
| `color/border/*` | `STROKE_COLOR` |
| `space/*` | `GAP, WIDTH_HEIGHT` (inset roles: also padding via `GAP`) |
| `radius/*` | `CORNER_RADIUS` |
| `text/size` | `FONT_SIZE` |
No token ever carries `TEXT_CONTENT` (`no-text-content-scope-on-token` — that scope is for string content variables, not design tokens).

**Lint gate:** `alias-one-tier-down`, `alias-target-resolves`, `semantic-alias-in-every-mode`, `semantic-role-allowlist`, `surface-on-pair-completeness`, `color-role-scope-match`, `dimension-role-scope-match`, `type-role-scope-match`, `no-text-content-scope-on-token`, `alias-graph-acyclic-max-depth-2`.

---

## 4. Tier 3 — Component tokens (single mode, alias Semantic)

Component tokens exist **only** where a component needs a named, swappable hook. Each **must alias a Semantic token** (`component-token-must-alias-semantic`) — never a Primitive, never a raw value.

```
button/bg/rest      → {color/bg/accent}
button/bg/hover     → {color/bg/accent-hover}
button/fg/label     → {color/fg/on-accent}
button/radius       → {radius/control}
```
- Naming: `{component}/{part}/{state}` — kebab segments, depth ≤ 3.
- **Pass-through discipline** (`single-use-component-passthrough`): if a component token is a bare 1:1 alias used exactly once with no state variance, flag it — it may be redundant indirection; bind the layer to the Semantic token directly instead.
- Kill orphans: any Component (or Semantic) variable with zero bindings and zero downstream aliases is dead (`unused-variable-orphan`).

**Lint gate:** `component-token-must-alias-semantic`, `single-use-component-passthrough`, `unused-variable-orphan`, `alias-graph-acyclic-max-depth-2` (re-run whole graph — max depth Component→Semantic→Primitive = 2 hops).

---

## 5. Codegen contract (make design → code deterministic)

The moment tokens are stable, lock the codegen surface. This is the layer that makes output reproducible instead of "messed up".

Every **published** variable must carry:
- `codeSyntax.WEB` set (`published-variable-has-codesyntax-web`), **unique** across the system (`codesyntax-web-unique`), and **derivable from its name** (`codesyntax-web-matches-name` → `color/bg/accent` ⇒ `--color-bg-accent` or `colorBgAccent`, per convention).
- A `description` (`published-variable-has-description`) — the human/codegen intent.

Every **ComponentSet** must have a code mapping (`component-set-has-code-mapping`) — the Plugin API supplies the prop keys via `componentPropertyDefinitions`; the mapping half is stored in the local MCP `get_code_mappings`/`set_code_mapping` store (local, no REST). This binds Figma variant props to code component props so codegen emits `<Button variant="primary" size="md">` not a detached snapshot.

**Lint gate:** `published-variable-has-codesyntax-web`, `codesyntax-web-unique`, `codesyntax-web-matches-name`, `published-variable-has-description`, `component-set-has-code-mapping`.

---

## 6. Components & variants (structure for codegen)

Build component sets **after** tokens exist so every fill/stroke/radius/gap on every layer **binds a token** (`no-raw-value-on-component-node`, `binding-on-scope-for-property`), and every text layer uses a text style or a bound type token (`text-layer-uses-style-or-bound-type`).

Variant discipline:
- **Boolean-shaped props are booleans** (`boolean-vocab-variant-should-be-boolean`): `disabled`, `loading` → boolean props, not `True/False` string variants. Booleans carry no sizing intent (`boolean-prop-no-sizing-intent`).
- **Variant matrix is complete** (`variant-matrix-complete`) — no missing cells in the `size × variant` grid; and bounded (`variant-count-ceiling-60`, heuristic cap).
- **No asset enumeration as variants** (`no-asset-enumeration-variant`): 40 icons ≠ 40 variants — use an instance-swap prop with `preferredValues` (`instance-swap-preferred-values`).
- Prop names unique & conventional (`property-name-convention-unique`); shared prop values consistent across the set (`shared-property-value-consistency`); no dead props (`no-dead-component-property`, via `componentPropertyDefinitions` vs `componentPropertyReferences`).
- Instances don't restyle (`no-instance-restyle-override` — `overrides[].overriddenFields` must not include fills/strokes that should be token-driven). A design-time detached frame that mirrors a component is a drift signal (`detached-component-frame-signal`, heuristic).
- The **default variant is the base tuple** (`default-variant-is-base-tuple`, config): `defaultVariant` = `{ size: md, variant: primary, state: rest }`.

**Lint gate:** `no-raw-value-on-component-node`, `binding-on-scope-for-property`, `text-layer-uses-style-or-bound-type`, `no-dead-component-property`, `boolean-vocab-variant-should-be-boolean`, `variant-matrix-complete`, `variant-count-ceiling-60`, `no-asset-enumeration-variant`, `property-name-convention-unique`, `shared-property-value-consistency`, `instance-swap-preferred-values`, `boolean-prop-no-sizing-intent`, `no-instance-restyle-override`, `detached-component-frame-signal`, `default-variant-is-base-tuple`.

---

## 7. Accessibility & naming final pass

Last, run the perceptual checks that only make sense once real fg/bg pairs exist:
- `fg-bg-pair-contrast`: every `fg/on-{role}` vs its `bg/{role}` meets WCAG AA (4.5:1 text) **in every Semantic mode** — resolve both aliases per-mode down to primitive literals and compute.
- `border-icon-graphical-contrast`: 3:1 for borders/icons.
- `min-font-size`: no bound/style type below the floor.
- `contrast-fallback-export-sampling`: where a fill can't be resolved analytically (gradients, images, effects), `exportAsync` a swatch and sample pixels.
- Re-assert naming across the whole graph: `name-kebab-segments`, `name-slash-structure-depth`, `top-segment-in-tier-vocabulary`.

**Final gate:** full `lint_design_system` — all 57 rules green.

---

## The build loop (what the AI actually does)

```
for tier in [Primitives, Semantic, Component]:
    build tier
    run the tier's focused linter (lint_tokens / lint_scopes / lint_modes / lint_naming)
    fix every ERROR before descending          ← this is what replaces trial-and-error
lock codegen  → lint_codegen
build components → lint_components
a11y pass       → lint_accessibility
ship gate       → lint_design_system (all 57)
```

Whole-file node scans (components, bindings, contrast) **must** be preceded by `figma.loadAllPagesAsync()` — the manifest is `documentAccess: dynamic-page`, so without it `findAllWithCriteria` sees only the current page and the linter silently under-reports. This preamble is baked into every linter that walks nodes.
