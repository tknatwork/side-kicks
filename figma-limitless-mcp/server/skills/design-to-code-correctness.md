# Design→Code Correctness — Token Structure That Survives Code-Gen

**Skill type:** Knowledge recipe (read on demand) + linter seed rules
**Runtime:** figma-limitless-mcp — local Figma plugin, Plugin API **1.130**, `documentAccess: dynamic-page`. No REST, no token, no network.
**Read tools:** `get_variables_deep`, `get_variable_defs`, `get_design_context`, `get_code_mappings`
**Write tools:** `write_variables` (collections/modes/variables/scopes/codeSyntax/aliases/bindings), `set_code_mapping`, `dev_resources`, `set_annotation`

---

## 1. The one canonical rule (do this, not something else)

> Build tokens in **exactly three tiers — Primitives → Semantic → Component** — where:
> 1. **A component only ever binds to a Semantic token.** Never to a Primitive, never to a raw value.
> 2. **Every Semantic token is an *alias*** (a `VARIABLE_ALIAS` in every mode), never a literal value.
> 3. **Every Semantic token carries `codeSyntax.WEB`** (plus `ANDROID`/`iOS` if those platforms ship).
> 4. **Every visual property is bound to a variable** — fill, stroke, effect color, corner radius, gap, padding, size — never a hardcoded paint or number.
> 5. **Every token is scoped** — `scopes` is never `['ALL_SCOPES']` for a typed token.

Code-gen breaks *precisely and only* when one of these five invariants is violated. This skill is the map from each break to its cause, its fix, and the Plugin-API property that detects it.

There is one right way here. Do not invent a fourth tier, do not put raw values in Semantic "just this once," do not skip codeSyntax and hope the name maps. The linter enforces all five.

---

## 2. Why design→code "messes it up" — the five failure modes

Each row is a real reason generated code comes out wrong, tied to the exact Plugin API 1.130 surface that proves it.

| # | Failure | What code-gen emits | Root cause | Detectable via |
|---|---------|---------------------|-----------|----------------|
| F1 | **Hardcoded value** | `background:#3B82F6` | Paint/number set literally, not bound | `node.fills[i].boundVariables?.color` absent; `node.boundVariables[key]` absent |
| F2 | **Missing codeSyntax** | `background: var(--color/bg/brand)` or `color_bg_brand_2` | Variable has no `codeSyntax.WEB`; Dev Mode falls back to the mangled Figma name | `Variable.codeSyntax` = `{}` / missing key |
| F3 | **Name isn't a code identifier** | `--Brand Color`, `--1-blue` (invalid CSS) | Spaces, capitals, leading digits, stray chars in the variable name | regex over `Variable.name` segments |
| F4 | **No semantic layer** | `color:#3B82F6` with no dark-mode variant, no intent | Component bound straight to a Primitive; code inherits a palette value with no meaning and no theming | resolve `node.boundVariables` → variable → `.variableCollectionId` == Primitives |
| F5 | **Unscoped token** | wrong token offered in the code panel (a color suggested for a radius) | `scopes = ['ALL_SCOPES']` — the variable surfaces everywhere | `Variable.scopes`, `Variable.resolvedType` |

The through-line: **Dev Mode / code-gen reads the binding, then reads that variable's `codeSyntax`.** If the property isn't bound, it prints the raw value (F1). If it's bound but there's no `codeSyntax`, it prints the Figma name mangled into an identifier (F2/F3). If it's bound to the wrong tier, it prints a palette value with no theme (F4). Get the binding, the tier, and the codeSyntax right and the output is clean and stable — the first time.

---

## 3. The one right structure (worked example — real names)

Three collections. Copy this shape.

### Tier 1 — `Primitives` (1 mode: `Value`; `hiddenFromPublishing: true`)

Raw values. Internal. Nothing outside this collection is a literal. Hidden from publishing so the code panel never suggests them — but note: hiding does **not** stop a component from binding to them locally, so the linter still enforces "no component→primitive" structurally (F4).

| Variable | `resolvedType` | Value (mode `Value`) | `scopes` |
|----------|----------------|----------------------|----------|
| `color/blue/500` | COLOR | `#3B82F6` | `['FRAME_FILL','SHAPE_FILL','TEXT_FILL','STROKE_COLOR']` |
| `color/blue/600` | COLOR | `#2563EB` | same |
| `color/blue/700` | COLOR | `#1D4ED8` | same |
| `color/neutral/0` | COLOR | `#FFFFFF` | same |
| `color/neutral/900` | COLOR | `#111827` | same |
| `space/400` | FLOAT | `16` | `['GAP','WIDTH_HEIGHT']` |
| `radius/200` | FLOAT | `8` | `['CORNER_RADIUS']` |
| `font-size/300` | FLOAT | `16` | `['FONT_SIZE']` |

Primitives get **no** `codeSyntax` — they never surface in code. (Publishable = false ⇒ exempt from the codeSyntax rule.)

### Tier 2 — `Semantic` (modes: `Light` [default], `Dark`; `hiddenFromPublishing: false`)

**Every value is an alias.** Theming lives here (Light/Dark). `codeSyntax` lives here. This is the *only* tier components bind to.

| Variable | Light → | Dark → | `scopes` | `codeSyntax.WEB` | `codeSyntax.ANDROID` | `codeSyntax.iOS` |
|----------|---------|--------|----------|------------------|----------------------|------------------|
| `color/bg/brand` | alias `color/blue/500` | alias `color/blue/600` | `['FRAME_FILL','SHAPE_FILL']` | `var(--color-bg-brand)` | `R.color.bg_brand` | `Color.bgBrand` |
| `color/bg/brand-hover` | alias `color/blue/600` | alias `color/blue/700` | `['FRAME_FILL','SHAPE_FILL']` | `var(--color-bg-brand-hover)` | `R.color.bg_brand_hover` | `Color.bgBrandHover` |
| `color/text/on-brand` | alias `color/neutral/0` | alias `color/neutral/0` | `['TEXT_FILL']` | `var(--color-text-on-brand)` | `R.color.text_on_brand` | `Color.textOnBrand` |
| `color/text/default` | alias `color/neutral/900` | alias `color/neutral/0` | `['TEXT_FILL']` | `var(--color-text-default)` | `R.color.text_default` | `Color.textDefault` |
| `space/inline-md` | alias `space/400` | alias `space/400` | `['GAP']` | `var(--space-inline-md)` | `R.dimen.space_inline_md` | `Spacing.inlineMd` |
| `radius/control` | alias `radius/200` | alias `radius/200` | `['CORNER_RADIUS']` | `var(--radius-control)` | `R.dimen.radius_control` | `Radius.control` |

### Tier 3 — Component bindings (the `Button` component set)

`Button` — a `ComponentSetNode` with `componentPropertyDefinitions`: `Variant = Primary | Secondary`, `Size = Sm | Md`, `State = Rest | Hover`.

- Background paint → bound to `color/bg/brand` (Rest) / `color/bg/brand-hover` (Hover)
- Label text fill → bound to `color/text/on-brand`
- `itemSpacing` → bound to `space/inline-md`
- `cornerRadius` (all four corners) → bound to `radius/control`

> **Optional 4th tier — component tokens** (`Component` collection, e.g. `button/bg/rest → alias color/bg/brand`). Use this **only** for multi-brand or when a component needs an indirection layer the whole team renames at once. Default answer: **skip it** — components bind straight to Semantic. Don't add tiers you don't need.

### What Dev Mode emits — good vs. broken

**Correct** (bound + aliased + codeSyntax + scoped):
```css
.button--primary { /* State=Rest */
  background: var(--color-bg-brand);
  color: var(--color-text-on-brand);
  gap: var(--space-inline-md);
  border-radius: var(--radius-control);
}
```
Dark mode is automatic (Semantic's `Dark` mode re-points the aliases). One token vocabulary, stable across renames.

**Broken** (F1 hardcoded + F4 no semantic layer):
```css
.button--primary {
  background: #3B82F6;   /* raw — no token, no dark mode, drifts on rebrand */
  color: #FFFFFF;
  gap: 16px;
  border-radius: 8px;
}
```

---

## 4. `codeSyntax` — the mechanics that make F2/F3 impossible

`codeSyntax` is a per-variable map `{ WEB?, ANDROID?, iOS? }`. Set it via `write_variables` (which wraps `Variable.setVariableCodeSyntax(platform, value)`). Dev Mode prints this string verbatim in the code panel for the platform the developer selected.

**Pick one WEB convention and hold it.** This skill's convention:

```
WEB value = "var(--" + <name with "/" replaced by "-"> + ")"
```

So `color/bg/brand` → `var(--color-bg-brand)`. This makes WEB codeSyntax **derivable from the name**, which is exactly what the linter checks (drift rule L4). If your system is Tailwind or a JS token object instead of CSS vars, pick that convention instead and hold it uniformly — but hold *one*.

- **ANDROID:** resource form — `R.color.bg_brand`, `R.dimen.space_inline_md` (snake_case, type-prefixed).
- **iOS:** Swift accessor — `Color.bgBrand`, `Spacing.inlineMd` (camelCase, type-prefixed).

Illustrative `write_variables` payload shape (conceptual — match the tool's schema):
```jsonc
{
  "collection": "Semantic",
  "variable": "color/bg/brand",
  "scopes": ["FRAME_FILL", "SHAPE_FILL"],
  "codeSyntax": {
    "WEB": "var(--color-bg-brand)",
    "ANDROID": "R.color.bg_brand",
    "iOS": "Color.bgBrand"
  },
  "valuesByMode": {
    "Light": { "alias": "color/blue/500" },
    "Dark":  { "alias": "color/blue/600" }
  }
}
```

**Do not** rely on Figma auto-generating codeSyntax from the name — it doesn't for slashes/casing, and the fallback is the mangled failure in F2.

---

## 5. Naming → code identifiers (kills F3)

One casing, enforced per name segment (split on `/`):

- **kebab-case only**: `^[a-z][a-z0-9]*(-[a-z0-9]+)*$` per segment.
- No spaces, no capitals, no leading digits, no `.`/`@`/`&`.
- `/` is the group separator (fine — it's the path), everything between slashes is a valid identifier segment.

Good: `color/bg/brand-hover`, `space/inline-md`, `font-size/300`
Bad: `Brand Color` (space+caps), `500/blue` (leading digit), `bg.brand` (dot).

Why: the name is the fallback identifier when codeSyntax is absent, and it's the source the WEB codeSyntax is derived from. A clean name means even a missed codeSyntax degrades to a *valid* identifier instead of broken code.

---

## 6. Semantic layer + scoping (kills F4/F5)

**F4 — every component binding must resolve into the `Semantic` collection.** The linter resolves `node.boundVariables` → `getVariableByIdAsync(id)` → `.variableCollectionId` and asserts it equals the Semantic collection id, not Primitives. Binding a button straight to `color/blue/500` is the single most common cause of "code got a raw palette value."

**Semantic tokens must be aliases, not literals.** For every variable in `Semantic`, every entry of `valuesByMode` must be `{ type: 'VARIABLE_ALIAS' }`. A raw color sitting in Semantic means the palette leaked one tier down — code gets a hex with no primitive linkage and no cross-mode consistency.

**Scope every typed token** so Dev Mode offers the right token in the right slot (F5). Map by `resolvedType` + intent:

| Token kind | `scopes` |
|------------|----------|
| Background color | `['FRAME_FILL','SHAPE_FILL']` |
| Text/foreground color | `['TEXT_FILL']` |
| Border color | `['STROKE_COLOR']` |
| Spacing / gap | `['GAP']` |
| Padding/size | `['WIDTH_HEIGHT']` |
| Corner radius | `['CORNER_RADIUS']` |
| Font size | `['FONT_SIZE']` |

`['ALL_SCOPES']` on a typed token is always a lint failure.

---

## 7. Components → Code Connect, dev resources, variant props

Tokens make the *values* correct; Code Connect makes the *component* correct.

1. **Map variant props to code props.** Read `ComponentSetNode.componentPropertyDefinitions` (`Variant`, `Size`, `State`) and mirror them to the code component's props via `set_code_mapping`. Detectable gap: a component set with no entry in `get_code_mappings`.
2. **Attach a dev resource** (`dev_resources`) linking the component to its source file / Storybook so the handoff carries a pointer, not a screenshot.
3. **Annotate intent** with `set_annotation` for the properties whose meaning isn't obvious from the token name (e.g. min-hit-target).

Code-gen for an *unmapped* component invents a name and props; a mapped one emits your real `<Button variant="primary" size="md" />`.

---

## 8. Pre-handoff checklist (the gate — run before you say "ready for code")

Run this as a build→lint→fix loop. Do not hand off with any FAIL.

1. `get_variables_deep` → confirm exactly three collections (`Primitives`, `Semantic`, [`Component`]).
2. **F1:** Every component/instance visual property is bound — no raw paints or numbers. Run `lint_design_system`.
3. **F4:** Every component binding resolves into `Semantic` (never `Primitives`). `lint_design_system`.
4. **Semantic = aliases:** Every `Semantic` variable is a `VARIABLE_ALIAS` in every mode. `lint_tokens`.
5. **F2:** Every publishable (`hiddenFromPublishing === false`) variable has `codeSyntax.WEB` (+ platforms you ship). `lint_tokens`.
6. **F3:** Every variable name passes the kebab identifier regex. `lint_tokens`.
7. **F5:** No typed token has `scopes === ['ALL_SCOPES']`. `lint_tokens`.
8. **Tier hygiene:** `Primitives.hiddenFromPublishing === true`, `Semantic === false`. `lint_tokens`.
9. **Modes:** `Semantic` has `Light`+`Dark`, `defaultModeId` → `Light`. `lint_tokens`.
10. **Components:** Every `ComponentSetNode` has a `get_code_mappings` entry and a dev resource.
11. Re-run steps 2–10 until zero FAIL, then hand off.

---

## 9. Common mistakes (don't do these)

- **Binding components to Primitives** "to save a tier." → F4. Always route through Semantic.
- **Putting a raw hex in Semantic** for a one-off. → breaks aliasing + theming. Add the primitive, then alias.
- **Skipping codeSyntax** because the name "looks fine." → Dev Mode mangles slashes/casing (F2).
- **`ALL_SCOPES` everywhere** because scoping is tedious. → wrong-token suggestions (F5); scope on creation.
- **Two casings** (`color/Bg/Brand` here, `color/bg/brand` there). → identifier drift; pick kebab, enforce.
- **Corner radius bound on only one corner.** Bind all four (`topLeft/topRight/bottomLeft/bottomRight`) or the code panel shows a mixed/partial value.
- **codeSyntax that doesn't match the name** (`color/bg/brand` → `var(--brand-color)`). → maintenance drift; keep them derivable (L4).
- **Adding a Component tier by default.** Only for multi-brand. Extra indirection = more to keep in sync.

---

## 10. Enforceable rules this skill implies (linter seed)

Every rule below is detectable via **Plugin API 1.130 locally** — no REST, no hallucinated API. Rules carry the exact surface. `lint_tokens` owns L1–L9; `lint_design_system` owns L10–L12.

| ID | Rule | Severity | Plugin-API detection |
|----|------|----------|----------------------|
| L1 | Every publishable variable (`hiddenFromPublishing === false`) has `codeSyntax.WEB` (and each targeted platform) | ERROR | `getLocalVariablesAsync()` → `Variable.codeSyntax`, `Variable.hiddenFromPublishing` |
| L2 | No typed variable has `scopes === ['ALL_SCOPES']`; scope set matches `resolvedType`+intent | ERROR | `Variable.scopes`, `Variable.resolvedType` |
| L3 | Each `/`-segment of `Variable.name` matches `^[a-z][a-z0-9]*(-[a-z0-9]+)*$` | ERROR | `Variable.name` |
| L4 | `codeSyntax.WEB` is derivable from name (`var(--` + name.replace(`/`→`-`) + `)`) | WARN | `Variable.name` + `Variable.codeSyntax.WEB` |
| L5 | Every variable in the `Semantic` collection is a `VARIABLE_ALIAS` in **every** mode (no literals) | ERROR | `Variable.valuesByMode` entry `.type === 'VARIABLE_ALIAS'` |
| L6 | Every alias resolves (target exists) and depth ≤ 2 (semantic→primitive) | ERROR | follow `valuesByMode` alias `.id` → `getVariableByIdAsync` |
| L7 | `Primitives.hiddenFromPublishing === true`; `Semantic.hiddenFromPublishing === false` | WARN | `Variable.hiddenFromPublishing` grouped by `variableCollectionId` |
| L8 | `Semantic` collection has modes `Light`+`Dark`; `defaultModeId` → `Light` | WARN | `VariableCollection.modes`, `.defaultModeId` |
| L9 | Publishable variable has a non-empty `description` | INFO | `Variable.description` |
| L10 | Every SOLID paint in `fills`/`strokes` and every drop-shadow effect on COMPONENT/COMPONENT_SET/INSTANCE nodes is bound to a variable (no hardcoded color) | ERROR | `findAllWithCriteria({types:[...]})`; `paint.boundVariables?.color`, `effect.boundVariables?.color` |
| L11 | Every scalar visual prop on those nodes (`cornerRadius`×4, `itemSpacing`, `padding*`, `width/height`, `strokeWeight`) that carries a design value is variable-bound | ERROR | `node.boundVariables[key]` |
| L12 | No component/instance binding resolves into the `Primitives` collection (must be `Semantic`) | ERROR | `node.boundVariables` → variable `.variableCollectionId` == Primitives id |
| L13 | Every `ComponentSetNode` has a Code Connect mapping and its `componentPropertyDefinitions` are represented in the mapping | WARN | `ComponentSetNode.componentPropertyDefinitions` + `get_code_mappings` |

### Not detectable via Plugin API (do NOT add these as lint rules)
- **Whether the generated code compiles / renders** — Dev Mode output isn't introspectable from the plugin sandbox.
- **Whether a token name is *semantically meaningful*** (`color/bg/brand` vs `color/bg/thing`) — only the *format* of names/codeSyntax is checkable, not their meaning.
- **Runtime contrast of on-brand text over brand bg** — only *approximable* by `exportAsync` pixel sampling of a rendered swatch (offline, but heavy and out of scope for code-correctness; belongs to an a11y skill, not this one).
- **Whether ANDROID/iOS codeSyntax strings match real resource IDs in the app repo** — the plugin can't see the codebase; verify format only.
