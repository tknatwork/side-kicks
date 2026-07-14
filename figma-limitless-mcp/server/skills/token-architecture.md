---
slug: token-architecture
title: "Token Architecture — The Flawless 3-Tier Derivation Structure"
purpose: "The canonical, opinionated PRIMITIVE → SEMANTIC → COMPONENT variable structure that a code-gen pipeline consumes deterministically, plus the structural laws the linter enforces."
type: knowledge
tier: crown-jewel
reads_with: [scope-matrix, theming-with-modes, naming-convention, lint_tokens]
---

# Token Architecture — The Flawless 3-Tier Derivation Structure

> **Read this before any `write_variables` call that touches color or dimension tokens, and re-read it whenever `lint_tokens` flags a structural error.** This is the one right way. There is no "it depends" here — the whole point is to remove the trial-and-error where design→code "always messes it up unless we build each part one by one to scope out where the issues are."

---

## The one rule, stated once

Build **three tiers, in three collections, aliasing strictly one tier down:**

```
COMPONENT   (optional)   button/primary/bg   ─alias→   SEMANTIC
SEMANTIC    (themeable)  bg/default          ─alias→   PRIMITIVE
PRIMITIVE   (raw)        color/neutral/0     = #FFFFFF (raw value, no alias)
```

- **One collection per tier** — `Primitives`, `Semantic`, `Component`. *Never* one collection per theme.
- **Modes model theme only** — Light/Dark live as **modes on the `Semantic` collection**. Primitives and Component are **single-mode**. Density, platform, and size are **not** modes.
- **Aliases point exactly one tier down.** Component → Semantic → Primitive. Primitives hold raw values and alias nothing. No sideways aliases, no skip-tier aliases, no upward aliases. Resolution depth is therefore bounded at **≤ 2 hops**, always.
- **Only Semantic and Component tokens are ever bound to nodes.** A node bound directly to a Primitive is a defect.
- **Semantic/Component color is tightly scoped; Primitives may keep `ALL_SCOPES` and are hidden from publishing.**

Everything below is the justification, the worked example, and the exact lintable form of each clause.

---

## Why this exact shape — tied to the code-output pain

The design→code pipeline reads **four** signals off each variable: its **collection/tier**, its **alias target**, its **scopes**, and its **codeSyntax**. When the token graph is sloppy, each of those signals lies to the generator, and you get the "rebuild it one part at a time to find where it broke" tax. The tiers fix each signal:

| Symptom in generated code | Root cause in the token graph | The tier/law that removes it |
|---|---|---|
| Dark mode requires re-emitting every component; hex literals everywhere instead of `var(--bg-default)` | Nodes bound to raw hex or bound straight to a **primitive** | **Semantic tier** — the themeable indirection layer. Theme is a *mode swap on one variable*, not a rebuild. |
| Generator emits `color:` where it should emit `background:` / `border-color:` — can't tell which CSS property a variable feeds | Bound color left on **`ALL_SCOPES`** | **Scope law** — the scope *is* the CSS-property type hint. Tight scope → deterministic property mapping. |
| Theme can't map to `:root[data-theme="dark"]` cleanly; combinatorial `light-compact`, `dark-comfortable` modes | Two switching axes (theme + density) folded into one collection's modes | **Single-axis modes** — Semantic modes = theme only; each collection's modes = exactly one axis. |
| Output variable names are guessed from Figma slash-names and collide or drift | No **codeSyntax** set | **codeSyntax law** — `codeSyntax.WEB = '--bg-default'` is the literal token the pipeline emits. |
| Infinite/ambiguous resolution, or a token resolves differently run-to-run | Same-tier or cyclic aliases | **One-tier-down law** — the graph is a DAG with fixed depth ≤ 2. |

**The mental model:** Primitives are *what colors exist*. Semantics are *what colors mean* (and swap by theme). Components are *what one component paints with*. Code-gen flattens the DAG once and emits: primitives → nothing (inlined), semantics → `:root` + `:root[data-theme=dark]`, components → `var(--...)` references. Deterministic, first try.

---

## Tier 1 — PRIMITIVE (the raw palette & scales)

The full, un-editorialized ramp. Raw values only.

- **Collection:** `Primitives`. **Modes:** exactly **one** (`Value`). A primitive's hex does not change with theme — the *mapping* does, and that lives in Semantic.
- **Contents:** the complete color ramps (`color/neutral/0…900`, `color/blue/50…900`), the spacing scale (`space/*`), radii (`radius/*`), and type primitives (`font/family/*`, `font/size/*`, `line-height/*`).
- **Aliases:** none, ever. Primitives are the leaves of the DAG.
- **Scopes:** `['ALL_SCOPES']` is acceptable **because primitives are never bound to a node** (see Tier 2). Scoping them is busywork — the enforcement that matters is "no node binds a primitive," not the primitive's own scope list.
- **Publishing:** **`hiddenFromPublishing: true` on every primitive.** Consumers of the library theme against semantics; exposing 120 raw swatches invites people to bind them directly, which breaks theming.
- **Naming:** `category/family/step` → `color/blue/600`, `space/4`, `radius/md`. Slashes create Figma groups.

## Tier 2 — SEMANTIC (role-based, themeable — the load-bearing tier)

The only tier most nodes should ever touch. Every token is a **role**, and every token **resolves to a primitive by an alias, per mode.**

- **Collection:** `Semantic`. **Modes:** the **theme axis** — `Light`, `Dark` (add `hc`, `brand-b`, etc. as more modes on *this same collection*).
- **Contents — roles, not colors:** `bg/*`, `fg/*`, `border/*`, `brand/*` (and `fg/on-brand`, `bg/subtle`, `border/strong`…). Name by *job*, never by hue: `bg/default`, not `bg/white`.
- **Aliases:** each variable aliases a **Primitive**, and does so **once per mode**. `bg/default` in `Light` → `color/neutral/0`; in `Dark` → `color/neutral/900`. Same variable, two modes, two primitive targets — this is the entire theming mechanism.
- **Scopes:** **tight, and never `ALL_SCOPES`.** The scope declares which CSS property the token feeds (the scope matrix below).
- **codeSyntax:** set `WEB` for every one — `--bg-default`, `--fg-muted`, `--border-default`.

### The scope matrix (memorize this — it is the crown detail)

| Semantic role prefix | Purpose | `scopes` | Emits as |
|---|---|---|---|
| `bg/*` | surface / fill | `['FRAME_FILL','SHAPE_FILL']` | `background` |
| `fg/*` | text & icon foreground | `['TEXT_FILL']` | `color` |
| `border/*` | strokes | `['STROKE_COLOR']` | `border-color` |
| `brand/*` | interactive/brand fills | `['FRAME_FILL','SHAPE_FILL']` | `background` |
| `radius/*` (semantic) | corner radius | `['CORNER_RADIUS']` | `border-radius` |
| `space/*` (semantic) | gap / padding | `['GAP']` | `gap` / `padding` |
| `size/*` (semantic) | width / height | `['WIDTH_HEIGHT']` | `width` / `height` |

Valid Plugin-API 1.130 `VariableScope` values you'll use: `ALL_SCOPES`, `FRAME_FILL`, `SHAPE_FILL`, `TEXT_FILL`, `STROKE_COLOR`, `EFFECT_COLOR`, `CORNER_RADIUS`, `GAP`, `WIDTH_HEIGHT`, `STROKE_FLOAT`, `FONT_SIZE`, `LINE_HEIGHT`, `LETTER_SPACING`, `FONT_FAMILY`, `FONT_STYLE`, `FONT_WEIGHT`, `OPACITY`. **`ALL_SCOPES` on a bound color is the single most common structural defect** — it is the reason the generator can't tell a text color from a background.

## Tier 3 — COMPONENT (optional, per-component — resist it)

A thin adapter layer: one knob per component-part-state, aliasing a Semantic.

- **Collection:** `Component`. **Modes:** exactly **one**. Components inherit theme *through* the semantic they alias — never re-declare Light/Dark here.
- **Contents:** `button/primary/bg`, `button/primary/bg-hover`, `button/primary/fg`, `card/bg`, `card/border` — `component/part/property[-state]`.
- **Aliases:** each aliases a **Semantic** (never a primitive, never another component token).
- **Scopes:** the same tight scope as the semantic it wraps, or tighter.

### When a component token earns its place (and when it's over-engineering)

Create a Component token **only if at least one is true:**
1. **Divergence** — the component needs a value that differs from the plain semantic (a brand button whose hover is a *specific* step you want to tune independently of `brand/*`).
2. **Reuse** — the same value is painted by **≥ 2 nodes/states/parts** of that component, and you want one place to change it.
3. **Published surface** — you ship the component in a library and want consumers to re-theme *per component* without touching global semantics.

Otherwise **bind the node straight to the semantic** (`bg/default`, `fg/default`) and skip the token. A `card/bg → bg/subtle` that always equals `bg/subtle` and is used once is pure indirection tax; the linter flags it as a single-use pass-through.

---

## Worked example — real names, the actual `write_variables` calls, and the code it yields

A minimal but complete slice: neutral + blue primitives, four semantic roles across Light/Dark, and one component (primary button). This is exactly what a `write_variables` batch looks like — note the `$N.<field>` step-references that chain create → set_value → set_alias in one atomic batch.

### Batch A — Primitives (single mode, raw values, hidden)

```jsonc
{ "actions": [
  { "action": "create_collection", "name": "Primitives", "initialModeName": "Value" },          // $0
  { "action": "create_variable", "name": "color/neutral/0",   "collectionId": "$0.collectionId", "resolvedType": "COLOR", "scopes": ["ALL_SCOPES"] }, // $1
  { "action": "create_variable", "name": "color/neutral/50",  "collectionId": "$0.collectionId", "resolvedType": "COLOR", "scopes": ["ALL_SCOPES"] }, // $2
  { "action": "create_variable", "name": "color/neutral/700", "collectionId": "$0.collectionId", "resolvedType": "COLOR", "scopes": ["ALL_SCOPES"] }, // $3
  { "action": "create_variable", "name": "color/neutral/900", "collectionId": "$0.collectionId", "resolvedType": "COLOR", "scopes": ["ALL_SCOPES"] }, // $4
  { "action": "create_variable", "name": "color/blue/600",    "collectionId": "$0.collectionId", "resolvedType": "COLOR", "scopes": ["ALL_SCOPES"] }, // $5
  { "action": "create_variable", "name": "color/blue/700",    "collectionId": "$0.collectionId", "resolvedType": "COLOR", "scopes": ["ALL_SCOPES"] }, // $6

  { "action": "set_value", "variableId": "$1.variableId", "modeId": "$0.defaultModeId", "value": "#FFFFFF" },
  { "action": "set_value", "variableId": "$2.variableId", "modeId": "$0.defaultModeId", "value": "#F7F8FA" },
  { "action": "set_value", "variableId": "$3.variableId", "modeId": "$0.defaultModeId", "value": "#33383F" },
  { "action": "set_value", "variableId": "$4.variableId", "modeId": "$0.defaultModeId", "value": "#0B0D10" },
  { "action": "set_value", "variableId": "$5.variableId", "modeId": "$0.defaultModeId", "value": "#2563EB" },
  { "action": "set_value", "variableId": "$6.variableId", "modeId": "$0.defaultModeId", "value": "#1D4ED8" },

  { "action": "update_variable", "variableId": "$1.variableId", "hiddenFromPublishing": true },
  { "action": "update_variable", "variableId": "$2.variableId", "hiddenFromPublishing": true },
  { "action": "update_variable", "variableId": "$3.variableId", "hiddenFromPublishing": true },
  { "action": "update_variable", "variableId": "$4.variableId", "hiddenFromPublishing": true },
  { "action": "update_variable", "variableId": "$5.variableId", "hiddenFromPublishing": true },
  { "action": "update_variable", "variableId": "$6.variableId", "hiddenFromPublishing": true }
]}
```

### Batch B — Semantic (Light + Dark modes, aliases per mode, tight scopes, codeSyntax)

> Capture the Primitive ids returned by Batch A (e.g. `neutral0`, `neutral900`, `blue600`, `blue700`) and reference them below. Within one batch you may keep using `$N` refs.

```jsonc
{ "actions": [
  { "action": "create_collection", "name": "Semantic", "initialModeName": "Light" },             // $0  (Light = $0.defaultModeId)
  { "action": "add_mode", "collectionId": "$0.collectionId", "name": "Dark" },                    // $1  (Dark  = $1.modeId)

  // bg/default — surface
  { "action": "create_variable", "name": "bg/default", "collectionId": "$0.collectionId", "resolvedType": "COLOR", "scopes": ["FRAME_FILL","SHAPE_FILL"] }, // $2
  { "action": "set_alias", "variableId": "$2.variableId", "modeId": "$0.defaultModeId", "aliasVariableId": "<neutral0>" },   // Light → #FFFFFF
  { "action": "set_alias", "variableId": "$2.variableId", "modeId": "$1.modeId",        "aliasVariableId": "<neutral900>" }, // Dark  → #0B0D10
  { "action": "update_variable", "variableId": "$2.variableId", "codeSyntax": { "WEB": "--bg-default" }, "description": "Default page/surface background" },

  // fg/default — text
  { "action": "create_variable", "name": "fg/default", "collectionId": "$0.collectionId", "resolvedType": "COLOR", "scopes": ["TEXT_FILL"] },                // $6
  { "action": "set_alias", "variableId": "$6.variableId", "modeId": "$0.defaultModeId", "aliasVariableId": "<neutral900>" },
  { "action": "set_alias", "variableId": "$6.variableId", "modeId": "$1.modeId",        "aliasVariableId": "<neutral0>" },
  { "action": "update_variable", "variableId": "$6.variableId", "codeSyntax": { "WEB": "--fg-default" } },

  // border/default — stroke
  { "action": "create_variable", "name": "border/default", "collectionId": "$0.collectionId", "resolvedType": "COLOR", "scopes": ["STROKE_COLOR"] },         // $10
  { "action": "set_alias", "variableId": "$10.variableId", "modeId": "$0.defaultModeId", "aliasVariableId": "<neutral50>" },
  { "action": "set_alias", "variableId": "$10.variableId", "modeId": "$1.modeId",        "aliasVariableId": "<neutral700>" },
  { "action": "update_variable", "variableId": "$10.variableId", "codeSyntax": { "WEB": "--border-default" } },

  // brand/solid + brand/solid-hover + fg/on-brand — brand fills stay constant across themes here
  { "action": "create_variable", "name": "brand/solid", "collectionId": "$0.collectionId", "resolvedType": "COLOR", "scopes": ["FRAME_FILL","SHAPE_FILL"] }, // $14
  { "action": "set_alias", "variableId": "$14.variableId", "modeId": "$0.defaultModeId", "aliasVariableId": "<blue600>" },
  { "action": "set_alias", "variableId": "$14.variableId", "modeId": "$1.modeId",        "aliasVariableId": "<blue600>" },
  { "action": "update_variable", "variableId": "$14.variableId", "codeSyntax": { "WEB": "--brand-solid" } },

  { "action": "create_variable", "name": "brand/solid-hover", "collectionId": "$0.collectionId", "resolvedType": "COLOR", "scopes": ["FRAME_FILL","SHAPE_FILL"] }, // $18
  { "action": "set_alias", "variableId": "$18.variableId", "modeId": "$0.defaultModeId", "aliasVariableId": "<blue700>" },
  { "action": "set_alias", "variableId": "$18.variableId", "modeId": "$1.modeId",        "aliasVariableId": "<blue700>" },
  { "action": "update_variable", "variableId": "$18.variableId", "codeSyntax": { "WEB": "--brand-solid-hover" } },

  { "action": "create_variable", "name": "fg/on-brand", "collectionId": "$0.collectionId", "resolvedType": "COLOR", "scopes": ["TEXT_FILL"] },                // $22
  { "action": "set_alias", "variableId": "$22.variableId", "modeId": "$0.defaultModeId", "aliasVariableId": "<neutral0>" },
  { "action": "set_alias", "variableId": "$22.variableId", "modeId": "$1.modeId",        "aliasVariableId": "<neutral0>" },
  { "action": "update_variable", "variableId": "$22.variableId", "codeSyntax": { "WEB": "--fg-on-brand" } }
]}
```

### Batch C — Component (single mode, aliases Semantic; only because the button diverges + is multi-state)

```jsonc
{ "actions": [
  { "action": "create_collection", "name": "Component", "initialModeName": "Value" },             // $0
  { "action": "create_variable", "name": "button/primary/bg",       "collectionId": "$0.collectionId", "resolvedType": "COLOR", "scopes": ["FRAME_FILL"] }, // $1
  { "action": "set_alias", "variableId": "$1.variableId", "modeId": "$0.defaultModeId", "aliasVariableId": "<brand/solid>" },
  { "action": "update_variable", "variableId": "$1.variableId", "codeSyntax": { "WEB": "--button-primary-bg" } },

  { "action": "create_variable", "name": "button/primary/bg-hover", "collectionId": "$0.collectionId", "resolvedType": "COLOR", "scopes": ["FRAME_FILL"] }, // $4
  { "action": "set_alias", "variableId": "$4.variableId", "modeId": "$0.defaultModeId", "aliasVariableId": "<brand/solid-hover>" },
  { "action": "update_variable", "variableId": "$4.variableId", "codeSyntax": { "WEB": "--button-primary-bg-hover" } },

  { "action": "create_variable", "name": "button/primary/fg",       "collectionId": "$0.collectionId", "resolvedType": "COLOR", "scopes": ["TEXT_FILL"] },  // $7
  { "action": "set_alias", "variableId": "$7.variableId", "modeId": "$0.defaultModeId", "aliasVariableId": "<fg/on-brand>" },
  { "action": "update_variable", "variableId": "$7.variableId", "codeSyntax": { "WEB": "--button-primary-fg" } }
]}
```

### What the code-gen pipeline emits — cleanly, first try

```css
/* Primitives are inlined, never emitted as their own vars. */
/* Semantic tier → theme-switchable custom properties */
:root {
  --bg-default: #FFFFFF;
  --fg-default: #0B0D10;
  --border-default: #F7F8FA;
  --brand-solid: #2563EB;
  --brand-solid-hover: #1D4ED8;
  --fg-on-brand: #FFFFFF;
}
:root[data-theme="dark"] {
  --bg-default: #0B0D10;
  --fg-default: #FFFFFF;
  --border-default: #33383F;
  --brand-solid: #2563EB;
  --brand-solid-hover: #1D4ED8;
  --fg-on-brand: #FFFFFF;
}
/* Component tier → references, theme-agnostic */
:root {
  --button-primary-bg:       var(--brand-solid);
  --button-primary-bg-hover: var(--brand-solid-hover);
  --button-primary-fg:       var(--fg-on-brand);
}
```

Because scopes are tight, the generator knows `--bg-default` is a `background`, `--fg-default` a `color`, `--border-default` a `border-color`. Because theme is a mode on one collection, dark mode is one `:root[data-theme]` block, not a rebuild. Because aliases go one tier down, every value resolves in ≤ 2 hops with no cycles.

---

## Common mistakes to avoid (each is a real defect the linter catches)

1. **Leaving semantic/component color on `ALL_SCOPES`.** The classic. The generator loses the property type. Scope every bound color.
2. **Binding a node — or a component token — directly to a Primitive.** Skips the themeable layer; dark mode dies. Nodes bind Semantic/Component only; component tokens alias Semantic only.
3. **One collection per theme** (`Light Colors`, `Dark Colors`). Theme is **modes on one collection**, so a single variable id carries both values. Separate collections mean two ids code-gen can't reconcile.
4. **Folding a second axis into modes** (`light-compact`, `dark-comfortable`). Mode explosion. One axis per collection's modes; density/size get their own collection.
5. **Naming semantics by hue** (`bg/white`, `fg/black`). In dark mode `bg/white` resolves to near-black — a lie. Name by role (`bg/default`).
6. **Same-tier or skip-tier aliases** (`fg/link → brand/solid`, or `button/bg → color/blue/600`). Breaks the fixed depth-≤2 guarantee. One tier down, always.
7. **A semantic mode left unresolved** (Light aliased, Dark empty). Code-gen emits a hole for that theme. Every mode of every semantic must have a value.
8. **Skipping `codeSyntax`.** The generator then guesses names from slash-paths and they drift/collide. Set `codeSyntax.WEB` on every bound token.
9. **Over-eager component tokens.** A single-use pass-through (`card/bg → bg/subtle`, used once, never diverges) is indirection tax. Bind the node to the semantic instead.
10. **Publishing primitives.** `hiddenFromPublishing: true` on all of them, or consumers bind raw swatches and defeat theming.

---

## Build → lint → fix loop

Author a tier, then run **`lint_tokens`** before moving on. Do not build all three tiers blind and hope. The order is: Primitives → lint → Semantic → lint → (Component → lint). Each rule below is checked by reading the live file through the Plugin API — no REST, no guessing.

---

## Enforceable structural rules (these seed the linter)

Each rule names its **Plugin API 1.130 detection path**. Rules marked *(not lintable)* are judgment calls a linter can only approximate — stated so the AI doesn't expect the linter to catch them.

1. **Three-collection tiering.** `getLocalVariableCollectionsAsync()` returns collections identifiable as Primitive/Semantic/Component (by name and by signature: Primitive = all-raw single-mode, Semantic = multi-mode + aliases). Every variable belongs to exactly one tier.
2. **No node bound to a Primitive.** Traverse with `findAllWithCriteria`; for each node read `node.boundVariables` (fields like `itemSpacing`, `topLeftRadius`, `width`, `opacity`, `strokeWeight`) **and** each `paint.boundVariables.color` in `fills`/`strokes`. Resolve the referenced variable → its collection → its tier. If tier is Primitive ⇒ **error**.
3. **Alias direction is one tier down.** For each variable, inspect `valuesByMode` for `{ type: 'VARIABLE_ALIAS', id }`; resolve the target's collection/tier and assert `targetTier === sourceTier − 1`. Flags skip-tier (Component→Primitive), sideways (Semantic→Semantic, Component→Component), and upward aliases.
4. **Primitives hold raw values only.** No entry in a Primitive's `valuesByMode` is a `VARIABLE_ALIAS`.
5. **Primitives hidden from publishing.** Every Primitive `Variable.hiddenFromPublishing === true`.
6. **No `ALL_SCOPES` on bound color.** For COLOR variables in Semantic/Component tiers, `Variable.scopes` must be non-empty and must **not** contain `ALL_SCOPES`.
7. **Semantic color scope matches role.** Parse the name prefix (`bg/`,`fg/`,`border/`,`brand/`) and assert `scopes` ⊆ the allowed set (bg/brand→`FRAME_FILL`/`SHAPE_FILL`; fg→`TEXT_FILL`; border→`STROKE_COLOR`). Flags e.g. a `border/*` scoped `TEXT_FILL`.
8. **Single-axis modes.** `VariableCollection.modes.length` — Primitive and Component collections must have exactly **1** mode; theme modes live only on Semantic. Report any Primitive/Component collection with >1 mode.
9. **Full mode coverage.** For every variable, `Object.keys(valuesByMode)` covers all of its collection's `modes` — no mode left unresolved (which would emit a per-theme hole).
10. **codeSyntax present on bound tiers.** `Variable.codeSyntax.WEB` is set and non-empty for every Semantic/Component variable. *(warning)*
11. **codeSyntax uniqueness.** No two variables share the same `codeSyntax.WEB` (would collide as one CSS var).
12. **Acyclic, depth ≤ 2.** Walk the alias graph from `valuesByMode`; assert no cycles and that max chain length from Component to a raw Primitive value is ≤ 2.
13. **Slash-structured naming.** `Variable.name` contains `/` and its top segment is in the tier's allowed set (Primitive: `color|space|radius|font|size|line-height`; Semantic: `bg|fg|border|brand`). *(warning)*
14. **Single-use component pass-through.** A Component variable whose alias equals its semantic *and* whose id appears in ≤ 1 node's `boundVariables` across the file → flag as likely over-engineering. Detectable via the same node scan as rule 2. *(warning)*
15. **Contrast of `fg/*` over `bg/*`** — the only rule needing pixels: `exportAsync` a swatch of the resolved fg color over the resolved bg color per mode, sample, compute WCAG ratio. Heavier; run on demand. *(optional)*

**Not lintable (judgment, stated so the AI owns them):** whether a semantic's *intent* is right (`bg/brand` actually reading as brand), whether the primitive ramp has the right number of steps, and whether a chosen alias is *semantically* correct (Light `bg/default`→`neutral/0` vs `neutral/50`). The linter guarantees the **structure**; the AI still owns the **meaning**.
