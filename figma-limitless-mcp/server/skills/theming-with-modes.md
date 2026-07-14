# Theming with Modes — Light/Dark and Multi-Brand

> **Canonical rule (memorize this):** Themes are **modes on the *semantic* collection**, never duplicated variables and never raw hex per mode on component tokens. Primitives are **mode-less**. Every semantic token is an **alias** to a primitive, and the alias target differs per mode. Flip the mode → every alias re-resolves → the entire UI re-themes from one switch. **Each independent theme axis (light/dark, brand) gets its own collection's modes** — never multiply axes into a single collection.

If you do exactly this, dark mode and multi-brand are *free and correct the first time*, and the code generator can derive `--color-bg-surface → --color-neutral-950` instead of hardcoding a hex it can't switch.

---

## The pain this kills

Building themed tokens in Figma is trial-and-error, and the design→code step "always messes it up unless we build each part one by one." The root cause is almost always **theme logic living in the wrong layer**:

- **Raw hex per mode on component tokens** (e.g. `button/primary/bg` holding `#2563EB` in Light and `#60A5FA` in Dark). Codegen sees two disconnected literals with no derivation, so it emits hardcoded hex. Dark mode then either doesn't switch or switches inconsistently, component by component.
- **Duplicated variables per theme** (`button-bg-light`, `button-bg-dark`). Now every consumer has to pick the right one; the mode switch does nothing; codegen emits two variables that never resolve to one CSS custom property.

When theming is modeled as **modes-on-semantic + aliases**, a single mode switch flips the whole alias tree, and codegen emits one `var(--token)` per decision that resolves through the cascade. **Structural correctness up front is what makes codegen deterministic.** That is the entire point of this skill.

---

## The three-layer model — and where modes live

| Layer | Collection | Modes | Values | Bound to nodes? |
|---|---|---|---|---|
| **1. Primitive** | `Primitives` | **1** (`Value`) — mode-less | Raw literals (`#020617`, `16`) | ❌ Never directly |
| **2. Semantic** | `Semantic` | **Light / Dark** ← *theme axis lives here* | **Aliases only** (→ primitives), one per mode | ✅ Yes — bind these |
| **3. Component** | `Component` | **1** (`Value`) — mode-less | **Aliases** (→ semantic) | ✅ Yes — bind these |

- **Primitives** are the palette. Mode-less. They never change with the theme — `neutral/950` is `#020617` in every theme. They are the raw material the semantic layer *chooses between*.
- **Semantic** is the theme. This is the **only** layer that carries `Light`/`Dark` modes. `color/bg/surface` = `neutral/0` in Light, `neutral/950` in Dark. Same token, two aliases.
- **Component** tokens (optional, for large systems) alias semantic tokens and stay **single-mode**. They inherit theme resolution *through* semantic — they must **never** re-introduce Light/Dark modes with their own literals.

### How Figma actually resolves a mode (so you bind correctly)

You **bind the variable**, not "the dark value." The mode is chosen at the **node/canvas level** — a frame (or page) is given an explicit mode, and descendants inherit it. Figma walks up to the nearest ancestor with an explicit mode for that collection; if none, it uses the collection's **`defaultModeId`**. So:

- Bind `color/bg/surface` to a frame's fill **once**. To preview dark, set that frame's Semantic-collection mode to `Dark` — the fill re-resolves automatically. You do **not** create a second frame or bind a different variable.
- The theme collection's `defaultModeId` **must** be the base mode (Light), because that is what every un-moded frame falls back to.

---

## Worked example — Light/Dark (real names, real `write_variables` batch)

**Collections & tokens**

```
Primitives (mode: Value)               ← mode-less literals
  color/neutral/0    = #FFFFFF
  color/neutral/50   = #F8FAFC
  color/neutral/500  = #64748B
  color/neutral/900  = #0F172A
  color/neutral/950  = #020617
  color/blue/400     = #60A5FA
  color/blue/600     = #2563EB

Semantic (modes: Light | Dark)         ← aliases only; theme axis
  color/bg/surface     Light→neutral/0    Dark→neutral/950
  color/bg/raised      Light→neutral/50   Dark→neutral/900
  color/fg/default     Light→neutral/900  Dark→neutral/50
  color/fg/muted       Light→neutral/500  Dark→neutral/400
  color/action/primary Light→blue/600     Dark→blue/400
  color/border/default Light→neutral/100  Dark→neutral/900

Component (mode: Value)                 ← aliases → semantic; single mode
  button/primary/bg  → color/action/primary
  card/bg            → color/bg/raised
```

**The `write_variables` call.** One batch creates the collection, its second mode, the variables, and per-mode aliases. Later steps reference earlier results with `$N.<field>` (`$N.collectionId`, `$N.defaultModeId`, `$N.modeId`, `$N.variableId`). `$N` is the **0-based action index**.

```json
{
  "actions": [
    { "action": "create_collection", "name": "Primitives", "initialModeName": "Value" },

    { "action": "create_variable", "collectionId": "$0.collectionId", "name": "color/neutral/0",
      "resolvedType": "COLOR", "scopes": ["ALL_SCOPES"],
      "valuesByMode": { "$0.defaultModeId": "#FFFFFF" } },
    { "action": "create_variable", "collectionId": "$0.collectionId", "name": "color/neutral/950",
      "resolvedType": "COLOR", "scopes": ["ALL_SCOPES"],
      "valuesByMode": { "$0.defaultModeId": "#020617" } },
    { "action": "create_variable", "collectionId": "$0.collectionId", "name": "color/blue/600",
      "resolvedType": "COLOR", "scopes": ["ALL_SCOPES"],
      "valuesByMode": { "$0.defaultModeId": "#2563EB" } },
    { "action": "create_variable", "collectionId": "$0.collectionId", "name": "color/blue/400",
      "resolvedType": "COLOR", "scopes": ["ALL_SCOPES"],
      "valuesByMode": { "$0.defaultModeId": "#60A5FA" } },

    { "action": "create_collection", "name": "Semantic", "initialModeName": "Light" },
    { "action": "add_mode", "collectionId": "$5.collectionId", "name": "Dark" },

    { "action": "create_variable", "collectionId": "$5.collectionId", "name": "color/bg/surface",
      "resolvedType": "COLOR", "scopes": ["FRAME_FILL", "SHAPE_FILL"],
      "description": "App background. Light=neutral/0, Dark=neutral/950." },
    { "action": "set_alias", "variableId": "$7.variableId", "modeId": "$5.defaultModeId", "aliasVariableId": "$1.variableId" },
    { "action": "set_alias", "variableId": "$7.variableId", "modeId": "$6.modeId",        "aliasVariableId": "$2.variableId" },

    { "action": "create_variable", "collectionId": "$5.collectionId", "name": "color/action/primary",
      "resolvedType": "COLOR", "scopes": ["FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR"] },
    { "action": "set_alias", "variableId": "$10.variableId", "modeId": "$5.defaultModeId", "aliasVariableId": "$3.variableId" },
    { "action": "set_alias", "variableId": "$10.variableId", "modeId": "$6.modeId",        "aliasVariableId": "$4.variableId" },

    { "action": "update_variable", "variableId": "$10.variableId",
      "codeSyntax": { "WEB": "--color-action-primary", "ANDROID": "color_action_primary", "iOS": "colorActionPrimary" } }
  ]
}
```

Notes that keep this flawless:
- **Semantic variables are created without literal `valuesByMode`**, then given a `set_alias` for **each** mode. Every mode gets an alias — never leave a mode literal or empty.
- `$5.defaultModeId` is the Light mode (the collection's initial mode, renamed via `initialModeName`); `$6.modeId` is Dark.
- **Scopes** restrict where each token appears: `bg/*` → `FRAME_FILL`/`SHAPE_FILL`, borders → `STROKE_COLOR`, text → `TEXT_FILL`. Primitives may stay `ALL_SCOPES` because they are never bound directly (optionally set `hiddenFromPublishing: true` on primitives to keep them out of the designer picker).
- Put `codeSyntax` on **semantic/component** tokens (the ones code consumes), not on primitives.

**Binding & preview:** bind `color/bg/surface` to your app frame's fill via `bind_to_node` (`field: "fills"`). Set the frame's Semantic mode to `Dark` to preview — do not build a second frame.

---

## Mode-count tier limits (linter-enforced ceiling)

Modes are a **scarce, plan-gated resource**. Commonly documented ceilings:

| Figma plan | Max modes per collection |
|---|---|
| Starter / Free | 1 (default mode only — no theming) |
| Professional | 4 |
| Organization | 4 |
| Enterprise | 40 |

> **Honesty on detectability:** the Plugin API 1.130 **cannot read the account's plan tier** — there is no `figma.plan` or equivalent. So the linter cannot know your ceiling from the file. It enforces a **configured** `maxModesPerCollection` (you set it to your plan's number) and flags any collection whose `collection.modes.length` exceeds it. The mode *count* itself is fully detectable (`getLocalVariableCollectionsAsync()` → `collection.modes`).

This ceiling is exactly why axis-mixing (next section) is fatal: burn all 4 Pro modes on `Acme-Light / Acme-Dark / Globex-Light / Globex-Dark` and you cannot add a third brand.

---

## Multi-brand — a different axis, a different collection

Multi-brand differs from light/dark: **brand changes the palette** (the accent hue, sometimes the neutral tint), while **light/dark changes how tokens map** to that palette. These are **two independent axes**. The rule:

> **One axis per collection. Never multiply axes into a single collection's mode list.**

Insert a **Brand** collection *between* Primitives and Semantic. Brand modes swap which primitive ramp the brand anchors point at; Semantic modes stay Light/Dark and alias the **brand anchors** instead of primitives directly.

```
Primitives (mode: Value)                     ← all brands' raw ramps
  color/blue/600, color/blue/400,
  color/green/600, color/green/400, …

Brand (modes: Acme | Globex)                 ← BRAND axis
  brand/accent        Acme→blue/600   Globex→green/600
  brand/accent-hover  Acme→blue/400   Globex→green/400

Semantic (modes: Light | Dark)               ← THEME axis
  color/action/primary  Light→brand/accent        Dark→brand/accent-hover
  color/bg/surface      Light→neutral/0           Dark→neutral/950   (brand-neutral: still → primitives)

Component (mode: Value)
  button/primary/bg → color/action/primary
```

The alias chain is now **Primitives → Brand → Semantic → Component**, with **two independent mode axes**. Set the Brand mode and the Theme mode independently at the canvas level; they compose multiplicatively (`2 brands × 2 themes = 4 looks`) while each collection stays within a **2-mode** budget.

**Why not one collection with 4 modes (`Acme-Light`, `Acme-Dark`, `Globex-Light`, `Globex-Dark`)?**
1. **Combinatorial explosion** — you hit the 4-mode Pro ceiling at 2 brands and cannot add a third (3×2 = 6 > 4).
2. **Duplicated decisions** — every light/dark choice is re-authored per brand; a change to a semantic mapping must be made 2× (or N×).
3. **No composition** — codegen can't express "brand × theme" as two orthogonal switches; it emits a flat 4-way lookup that doesn't map to CSS.

**Multi-brand trap to avoid:** do **not** let Semantic skip the Brand layer and alias a brand-specific primitive directly (`color/action/primary Light → blue/600`). That re-hardcodes Acme's blue into the semantic layer and Globex loses its accent. Semantic accent/action tokens must alias **`brand/*`**, and only `brand/*` aliases the raw ramp.

---

## The build → lint → fix loop (do this every time)

Never hand-verify structure. Author, then run the linter, then fix what it flags:

1. **`read_skill("theming-with-modes")`** (this doc) before authoring.
2. **`write_variables`** the primitive layer (mode-less), then the semantic layer (modes + aliases), then component (single-mode aliases) — in that order, one layer at a time.
3. **`lint_tokens`** (or `lint_design_system`) — it reads the live file via the Plugin API and reports structural violations.
4. **Fix each finding** with a follow-up `write_variables` (e.g. replace a raw literal with `set_alias`), then **re-lint until clean.**

Example `lint_tokens` finding on the anti-pattern (raw hex in a semantic mode):

```json
{
  "rule": "semantic-token-must-be-alias",
  "severity": "error",
  "collection": "Semantic",
  "variable": "color/action/primary",
  "mode": "Dark",
  "detail": "valuesByMode[Dark] is a raw COLOR literal {r,g,b,a}=#60A5FA, not a VARIABLE_ALIAS. Semantic tokens must alias a primitive in every mode.",
  "fix": "set_alias variableId=<id> modeId=<Dark> aliasVariableId=<color/blue/400>"
}
```

Fix it, re-run, ship only when the theming rules return zero errors.

---

## Common mistakes to avoid

1. **Raw hex per mode on component tokens.** The headline anti-pattern. Component tokens alias semantic; they carry no modes. (Rule 2 & 5.)
2. **Duplicating variables per theme** (`bg-light`, `bg-dark`). One token, two aliases across two modes — not two tokens.
3. **Putting modes on the Primitives collection.** Primitives are the fixed palette; they never theme. Mode-less, always. (Rule 1.)
4. **Missing a mode value.** A semantic token aliased in Light but left empty/literal in Dark resolves wrong. Every mode must have an alias. (Rule 4.)
5. **Lateral / self aliasing** (semantic → another semantic in the *same* collection). Aliases must point one layer **down**. (Rule 6.)
6. **Cramming brand × theme into one collection's modes.** Separate axes → separate collections. (Rule 7.)
7. **Semantic aliasing a brand's primitive directly** in a multi-brand system, skipping the Brand layer. (Rule 10.)
8. **`defaultModeId` set to Dark.** New frames then default to dark. The base mode (Light) must be default. (Rule 8.)
9. **Inconsistent mode names** across a shared axis (`Light` in one collection, `light`/`Day` in another) — breaks mode-set inheritance and reads. (Rule 9.)
10. **Binding "the dark value" to a node.** You bind the *variable*; the mode is chosen on the frame/page. Set the node's collection mode to preview.

---

## Enforceable structural rules (these seed the linter)

All are detectable via Figma Plugin API 1.130 — `getLocalVariableCollectionsAsync()` (`.modes`, `.defaultModeId`, `.variableIds`) and `getLocalVariablesAsync()` (`.resolvedType`, `.scopes`, `.valuesByMode`, `.variableCollectionId`, `.codeSyntax`, `.hiddenFromPublishing`). Layer identity (primitive/semantic/component) is **inferred structurally**: classify each `valuesByMode` entry as `LITERAL` vs `VARIABLE_ALIAS` (`value.type === "VARIABLE_ALIAS"`), then a collection is *primitive-like* if ~all values are literals, *semantic-like* if ~all values are aliases whose targets resolve into primitive-like collections, *component-like* if ~all aliases target semantic-like collections — cross-checked against collection names.

1. **Primitives are mode-less.** A primitive-layer collection MUST have `modes.length === 1`; flag any primitive collection with more.
2. **Semantic tokens are aliases in every mode.** For every variable in a semantic collection, EVERY `valuesByMode` entry MUST be `{type:"VARIABLE_ALIAS"}`. A raw literal in any semantic mode is an `error` (the "raw hex per mode" anti-pattern).
3. **Mode-count ceiling.** No collection may have `modes.length > maxModesPerCollection`. Plan tier is **not** Plugin-API-detectable, so the ceiling comes from linter config (Starter 1 / Pro 4 / Org 4 / Enterprise 40), not the file.
4. **Every mode is populated.** For each variable, `Object.keys(valuesByMode).length === owningCollection.modes.length`. A mode with no defined value is a violation.
5. **Component tokens alias semantic and stay single-mode.** A component-layer collection MUST have `modes.length === 1`, and its values MUST be aliases into semantic-like collections. Component tokens holding raw per-mode literals (theme logic duplicated below the semantic layer) is an `error`.
6. **Aliases point down, never sideways.** A semantic alias's target variable MUST resolve (via its `variableCollectionId`) to a **lower** layer (primitive or brand), never to another variable in the same semantic collection. No lateral or self aliasing.
7. **One theme axis per collection.** Flag a collection whose mode **names** encode two axes (e.g. `Acme / Dark`, `Brand A-Light`) — detectable by name pattern (separator + a brand-ish and a theme-ish token). Heuristic, name-based → `warning` (LOW), not a hard structural signal; state that it is a naming heuristic.
8. **Base mode is default.** A theme collection's `defaultModeId` MUST resolve to the base mode (name matches the base, e.g. `Light`). Detectable via `defaultModeId` → mode name.
9. **Consistent mode names across an axis.** All collections participating in the same theme axis MUST use identical mode names (exactly `Light`/`Dark`); mismatched, duplicate, or empty mode names within a collection are flagged.
10. **Multi-brand alias discipline.** Brand-collection tokens MUST alias primitives, and semantic accent/action tokens MUST alias `brand/*` tokens — a semantic token that aliases a brand-specific *primitive* directly (skipping the Brand layer) is a `warning`, detectable by resolving the alias target's collection.

**Out of scope for this linter (stated for honesty):** per-mode WCAG contrast (fg vs bg in each theme) is *possible* via `exportAsync` pixel sampling but belongs to a dedicated contrast lint, not this structural one. Detecting whether a chosen alias is the *aesthetically right* primitive is not detectable — the linter enforces structure, not taste.
