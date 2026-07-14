# Component & Variant Structure That Survives Code-Gen

**Purpose:** Build Figma component/variant sets whose property structure maps **1:1 to code component props**, so `get_design_context` → code stops mangling components.
**Read this before:** creating/editing a component set, adding any component property, wiring slots or instance overrides, or exporting a component to code. Also when `lint_design_system` flags component structure.

---

## The pain this kills

Design→code "always messes up components unless you build each part one by one." It messes up because the **property model is the API of the component**, and Figma silently lets you build a property model that has no code equivalent:

- a two-value **variant** (`State=On/Off`) generates a bogus string-union prop instead of a `boolean`;
- an **icon-per-variant** axis (`Icon=Search|Close|Menu|…`) explodes the matrix and generates a 40-member union instead of one swap slot;
- **hardcoded** fills/padding inside variants generate literal `#3B82F6` / `padding: 12px` instead of token references, so the code can't retheme;
- **dead** properties and **incomplete** variant matrices generate props that do nothing and states that are `undefined` at runtime.

Every one of those is a *structural* defect you can see in the file **before** you export. This skill gives you the one correct structure up front, and the enforceable rules the linter uses to catch drift. **Build → `lint_design_system` → fix. Do not export a component the linter has flagged.**

---

## THE CANONICAL RULE

> **A component's property model is its code API. Model each property as the ONE kind that matches its code shape, name it exactly as the code prop, bind every visual value to a variable, and keep the variant matrix complete. If a property has no clean code equivalent, it is modeled wrong — not the code.**

Five clauses, each non-negotiable.

### 1. Four property kinds — pick by what it becomes in code

There are exactly four ways to express a knob. Choosing the wrong one is the #1 cause of bad code-gen. Decide with this table, top to bottom — **stop at the first row that fits.**

| If the knob is… | Use | Figma mechanism | Generates (React) |
|---|---|---|---|
| a **closed set of mutually-exclusive visual treatments** (intent, size, interaction state) | **VARIANT** | component name `axis=value` → `combine_as_variants` | string-union prop: `variant`, `size`, `state` |
| an **independent on/off that shows or hides** a part | **BOOLEAN** | `add_component_property` type `BOOLEAN`, referenced by a layer's `visible` | `boolean` prop: `loading`, `showLeadingIcon` |
| **which sub-component** goes in a fixed hole, from a known set (icons, avatars) | **INSTANCE_SWAP** | `add_component_property` type `INSTANCE_SWAP` + `preferredValues` | constrained node prop / `icon` union: `leadingIcon` |
| a **free-form region the consumer fills** with arbitrary children | **SLOT** | `create_slot` (auto-creates the SLOT property) | `children` / render-prop slot |
| editable copy | **TEXT** | `add_component_property` type `TEXT` | `string` prop: `label` |

**The two hard boundaries people get wrong:**

- **On/off is NEVER a variant.** Two-value axes (`On/Off`, `True/False`, `Yes/No`, `Show/Hide`, `Enabled/Disabled`) are BOOLEAN properties. A variant here doubles the matrix *and* mistypes the prop.
- **"Which icon" is NEVER a variant.** One INSTANCE_SWAP with `preferredValues` replaces N variant options. A variant per icon is the single biggest matrix-explosion source.

> **Figma BOOLEAN properties bind only to a layer's `visible` (or a nested boolean).** A flag that must change *sizing/spacing/layout* (`fullWidth`, `compact`) **cannot** be a Figma boolean. Model it as a VARIANT axis (`width=auto|full`) or accept it as a code-only prop and document it via the code mapping. Do not create a boolean you can't wire.

### 2. One naming vocabulary — property names ARE the code prop names

- Property names (variant **and** non-variant): **camelCase, code-identifier form, matching the code prop exactly** — `variant`, `size`, `state`, `loading`, `leadingIcon`, `label`. No spaces, no Title Case, no synonyms. Pick **one** word per axis for the whole file: `variant` (never also `type`/`style`/`kind`), `size` (never also `scale`).
- Variant **values** are the literal string-union members: `variant=primary|secondary|ghost|destructive`, `size=sm|md|lg`, `state=default|hover|active|focus|disabled`. Casing is consistent across **every** set in the file — `default`, never `Default` in one set and `DEFAULT` in another.
- Booleans are named for the affirmative code prop: `loading`, `selected`, `showTrailingIcon`.

Figma turns these names into the generated prop names verbatim. Drift here **is** the code-gen mess.

### 3. Bind every visual value — hardcode nothing inside a component

Inside a component/variant, **every** paint, stroke, effect, corner radius, padding, gap, and size is bound to a variable (or, for paints, a style that itself binds one). Zero raw values. Typography goes through a **text style**. The variant mechanism just selects *which bound token* per state — e.g. `state=hover` binds the background to `component/button/bg-hover`, not to a literal hex.

Raw values are the reason generated code can't retheme and dark mode breaks.

### 4. Component tokens — only when earned

Add a `component/*` variable (a component token) **only** when both hold:
1. the same semantic token is referenced **3+ times** in the component, **and**
2. the component must be re-themeable **independently** of the global semantic layer.

Otherwise **bind straight to the semantic token.** A component token that is a single-use pass-through of a semantic token is noise that confuses code-gen. Every component token **aliases** a semantic variable (never holds a raw value) and carries `codeSyntax` so its generated custom-property name is deterministic.

### 5. Slots for free content

A card body, modal content, or list container is a **SLOT** (`create_slot`) — not a giant `INSTANCE_SWAP="Content"` and not a stack of TEXT variants. Slots generate `children`; the alternatives generate an unusable enum. Populate slots on the **master component** (`append_to_slot`); Figma blocks appending into a slot inside an instance.

---

## Worked example — `Button`

A production Button, built the one correct way. Real collection/variable/scope/alias/codeSyntax names and the actual MCP calls.

### 5a. Token foundation (one `write_variables` batch, `$N` cross-refs)

Three layers: **primitive → semantic → component**. Scopes are always locked (never `ALL_SCOPES` on a real token).

```jsonc
// write_variables — actions run in order; $N.field references an earlier action's result
{ "actions": [
  // --- primitives (mode "Value") ---
  { "action": "create_collection", "name": "primitives", "initialModeName": "Value" },        // $0
  { "action": "create_variable", "collectionId": "$0.collectionId", "name": "color/blue/500",
    "resolvedType": "COLOR", "scopes": ["ALL_FILLS","STROKE_COLOR"],
    "valuesByMode": { "$0.defaultModeId": "#3B82F6" } },                                        // $1
  { "action": "create_variable", "collectionId": "$0.collectionId", "name": "color/blue/600",
    "resolvedType": "COLOR", "scopes": ["ALL_FILLS","STROKE_COLOR"],
    "valuesByMode": { "$0.defaultModeId": "#2563EB" } },                                        // $2
  { "action": "create_variable", "collectionId": "$0.collectionId", "name": "color/neutral/0",
    "resolvedType": "COLOR", "scopes": ["ALL_FILLS"],
    "valuesByMode": { "$0.defaultModeId": "#FFFFFF" } },                                        // $3
  { "action": "create_variable", "collectionId": "$0.collectionId", "name": "radius/md",
    "resolvedType": "FLOAT", "scopes": ["CORNER_RADIUS"],
    "valuesByMode": { "$0.defaultModeId": 8 } },                                               // $4
  { "action": "create_variable", "collectionId": "$0.collectionId", "name": "space/2",
    "resolvedType": "FLOAT", "scopes": ["GAP","WIDTH_HEIGHT"],
    "valuesByMode": { "$0.defaultModeId": 8 } },                                               // $5
  { "action": "create_variable", "collectionId": "$0.collectionId", "name": "space/4",
    "resolvedType": "FLOAT", "scopes": ["GAP","WIDTH_HEIGHT"],
    "valuesByMode": { "$0.defaultModeId": 16 } },                                              // $6

  // --- semantic (modes Light + Dark) ---
  { "action": "create_collection", "name": "semantic", "initialModeName": "Light" },          // $7
  { "action": "add_mode", "collectionId": "$7.collectionId", "name": "Dark" },                // $8
  { "action": "create_variable", "collectionId": "$7.collectionId", "name": "action/primary/bg",
    "resolvedType": "COLOR", "scopes": ["ALL_FILLS"] },                                        // $9
  { "action": "set_alias", "variableId": "$9.variableId", "modeId": "$7.defaultModeId", "aliasVariableId": "$1.variableId" }, // Light → blue/500
  { "action": "set_alias", "variableId": "$9.variableId", "modeId": "$8.modeId",        "aliasVariableId": "$2.variableId" }, // Dark  → blue/600
  { "action": "create_variable", "collectionId": "$7.collectionId", "name": "action/primary/bg-hover",
    "resolvedType": "COLOR", "scopes": ["ALL_FILLS"] },                                        // $12
  { "action": "set_alias", "variableId": "$12.variableId", "modeId": "$7.defaultModeId", "aliasVariableId": "$2.variableId" },
  { "action": "create_variable", "collectionId": "$7.collectionId", "name": "action/primary/fg",
    "resolvedType": "COLOR", "scopes": ["ALL_FILLS"] },                                        // $14
  { "action": "set_alias", "variableId": "$14.variableId", "modeId": "$7.defaultModeId", "aliasVariableId": "$3.variableId" },

  // --- component tokens (mode "Value") — EARNED: padding used 2×, button re-themed independently ---
  { "action": "create_collection", "name": "component/button", "initialModeName": "Value" },  // $16
  { "action": "create_variable", "collectionId": "$16.collectionId", "name": "button/bg",
    "resolvedType": "COLOR", "scopes": ["ALL_FILLS"] },                                        // $17
  { "action": "set_alias", "variableId": "$17.variableId", "modeId": "$16.defaultModeId", "aliasVariableId": "$9.variableId" },
  { "action": "update_variable", "variableId": "$17.variableId", "codeSyntax": { "WEB": "--button-bg" } },
  { "action": "create_variable", "collectionId": "$16.collectionId", "name": "button/bg-hover",
    "resolvedType": "COLOR", "scopes": ["ALL_FILLS"] },                                        // $20
  { "action": "set_alias", "variableId": "$20.variableId", "modeId": "$16.defaultModeId", "aliasVariableId": "$12.variableId" },
  { "action": "update_variable", "variableId": "$20.variableId", "codeSyntax": { "WEB": "--button-bg-hover" } },
  { "action": "create_variable", "collectionId": "$16.collectionId", "name": "button/fg",
    "resolvedType": "COLOR", "scopes": ["ALL_FILLS"] },                                        // $23
  { "action": "set_alias", "variableId": "$23.variableId", "modeId": "$16.defaultModeId", "aliasVariableId": "$14.variableId" },
  { "action": "update_variable", "variableId": "$23.variableId", "codeSyntax": { "WEB": "--button-fg" } },
  { "action": "create_variable", "collectionId": "$16.collectionId", "name": "button/radius",
    "resolvedType": "FLOAT", "scopes": ["CORNER_RADIUS"] },                                    // $26
  { "action": "set_alias", "variableId": "$26.variableId", "modeId": "$16.defaultModeId", "aliasVariableId": "$4.variableId" },
  { "action": "update_variable", "variableId": "$26.variableId", "codeSyntax": { "WEB": "--button-radius" } },
  { "action": "create_variable", "collectionId": "$16.collectionId", "name": "button/padding-x",
    "resolvedType": "FLOAT", "scopes": ["WIDTH_HEIGHT","GAP"] },                               // $29
  { "action": "set_alias", "variableId": "$29.variableId", "modeId": "$16.defaultModeId", "aliasVariableId": "$6.variableId" },
  { "action": "update_variable", "variableId": "$29.variableId", "codeSyntax": { "WEB": "--button-padding-x" } },
  { "action": "create_variable", "collectionId": "$16.collectionId", "name": "button/gap",
    "resolvedType": "FLOAT", "scopes": ["GAP"] },                                             // $32
  { "action": "set_alias", "variableId": "$32.variableId", "modeId": "$16.defaultModeId", "aliasVariableId": "$5.variableId" },
  { "action": "update_variable", "variableId": "$32.variableId", "codeSyntax": { "WEB": "--button-gap" } }
]}
```

### 5b. The property model (the code API)

| Kind | Property | Values / notes | Code prop |
|---|---|---|---|
| VARIANT | `variant` | `primary \| secondary \| ghost \| destructive` | `variant` |
| VARIANT | `size` | `sm \| md \| lg` | `size` |
| VARIANT | `state` | `default \| hover \| active \| focus \| disabled` (restyles fills → must be a variant, not a boolean) | `state` |
| BOOLEAN | `loading` | toggles a `Spinner` layer's `visible` | `loading` |
| BOOLEAN | `showLeadingIcon` | toggles the leading-icon slot's `visible` | `showLeadingIcon` |
| BOOLEAN | `showTrailingIcon` | toggles the trailing-icon slot's `visible` | `showTrailingIcon` |
| INSTANCE_SWAP | `leadingIcon` | `preferredValues` → `Icon` set key | `leadingIcon` |
| INSTANCE_SWAP | `trailingIcon` | `preferredValues` → `Icon` set key | `trailingIcon` |
| TEXT | `label` | default `"Button"` | `label` |

### 5c. Build the variant matrix — the fixed order

`create_component_from_node`'s own guidance: **create/refine frames → name each `axis=value` → `create_component_from_node` each → `combine_as_variants` → `add_component_property`.** Multi-axis names are comma-joined:

```jsonc
// each base frame, once styled, is named with the FULL axis tuple, then componentized
name = "variant=primary, size=md, state=default"
name = "variant=primary, size=md, state=hover"
// … one frame per legit combination (see matrix math) …

// combine_as_variants — Figma reads the names into VARIANT properties (do NOT add variants via add_component_property)
{ "nodeIds": ["<all button component ids>"], "name": "Button", "arrange": true }
```

### 5d. Add the non-variant properties (variants already exist from names)

```jsonc
{ "nodeId": "<Button set id>", "name": "label", "propertyType": "TEXT", "defaultValue": "Button" }
{ "nodeId": "<Button set id>", "name": "loading", "propertyType": "BOOLEAN", "defaultValue": false }
{ "nodeId": "<Button set id>", "name": "showLeadingIcon", "propertyType": "BOOLEAN", "defaultValue": false }
{ "nodeId": "<Button set id>", "name": "showTrailingIcon", "propertyType": "BOOLEAN", "defaultValue": false }
{ "nodeId": "<Button set id>", "name": "leadingIcon", "propertyType": "INSTANCE_SWAP",
  "defaultValue": "<Icon/search component id>",
  "preferredValues": [ { "type": "COMPONENT_SET", "key": "<Icon set published key>" } ] }
{ "nodeId": "<Button set id>", "name": "trailingIcon", "propertyType": "INSTANCE_SWAP",
  "preferredValues": [ { "type": "COMPONENT_SET", "key": "<Icon set published key>" } ] }
```

`add_component_property` returns each key **with its `#` suffix** (e.g. `loading#12:3`). **Wire it** — a property no layer references is dead. Non-variant props are wired by setting the child layer's `componentPropertyReferences` (via `execute_code`, the escape hatch; `set_node_properties` does not expose it):

```js
// execute_code
const spinner = figma.getNodeById("<spinner layer id>");
spinner.componentPropertyReferences = { visible: "loading#12:3" };            // BOOLEAN → visible
figma.getNodeById("<label layer id>").componentPropertyReferences = { characters: "label#12:1" }; // TEXT → characters
figma.getNodeById("<leading icon inst>").componentPropertyReferences = { mainComponent: "leadingIcon#12:5" }; // SWAP → mainComponent
```

### 5e. Bind every variant's visuals

For **each** variant (`bind_to_node` per node), bind background/foreground/radius/padding/gap to the component tokens; hover/active/disabled bind to the `-hover`/`-active`/`-disabled` peers. Nothing raw.

```jsonc
// variant=primary,size=md,state=default
{ "action": "bind_to_node", "nodeId": "<bg frame>",   "field": "fills",       "aliasVariableId": "<button/bg>" }
{ "action": "bind_to_node", "nodeId": "<bg frame>",   "field": "topLeftRadius","aliasVariableId": "<button/radius>" }  // + the other 3 corners
{ "action": "bind_to_node", "nodeId": "<bg frame>",   "field": "paddingLeft", "aliasVariableId": "<button/padding-x>" } // + right
{ "action": "bind_to_node", "nodeId": "<bg frame>",   "field": "itemSpacing", "aliasVariableId": "<button/gap>" }
{ "action": "bind_to_node", "nodeId": "<label text>", "field": "fills",       "aliasVariableId": "<button/fg>" }
// state=hover → same fields, but background binds <button/bg-hover>
```
Label typography rides a **text style** (`apply_text_style` with `label/md`), which itself binds the type variables — never a raw font size on the layer.

### 5f. Lock design→code

```jsonc
// set_code_mapping — closes the 1:1 loop; codegen and the linter read this
{ "target": "<Button set id>", "source": "src/components/Button/Button.tsx", "language": "tsx",
  "snippet": "<Button variant=\"primary\" size=\"md\" state=\"default\" loading label=\"Button\" leadingIcon={<SearchIcon/>} />",
  "notes": "Props mirror componentPropertyDefinitions 1:1. fullWidth is code-only (Figma boolean can't drive sizing)." }
```

### 5g. The matrix math (why the four-kind discipline matters)

- **Naive** (everything a variant): `variant(4) × size(3) × state(5) × hasIcon(2) × icon(20) = 4,800 variants` — impossible to build, generates a 20-member `icon` union and a redundant `hasIcon`.
- **Correct**: `variant(4) × size(3) × state(5) = 60 variants` + booleans `loading`, `showLeadingIcon`, `showTrailingIcon` + swaps `leadingIcon`, `trailingIcon` + text `label`. Clean props, complete matrix, one `Icon` set behind the swaps.

Legit enum axes (`variant`, `size`, `state`) **are** allowed to cross — 60 is fine because it maps to three clean props. Explosion comes from *illegitimate* axes (booleans-as-variants, icon-as-variant), which the linter flags.

---

## Slot mini-example — `Card`

A Card's body is arbitrary consumer content → **SLOT**, not `INSTANCE_SWAP="Content"`.

```jsonc
// 1) create_slot on the Card master → auto-creates the SLOT component property (returns its key; do NOT add another)
{ "nodeId": "<Card body frame id>" }
// 2) populate the master's slot with a placeholder (append_to_slot works on the MASTER, not an instance)
{ "slotId": "<slot id from get_slots>", "nodeId": "<placeholder content id>" }
```
Card keeps `variant` (VARIANT), `elevated` (BOOLEAN → shadow layer `visible`), `header`/`footer` (SLOT or BOOLEAN-gated slots). Body content → `children` in code. Verify with `get_slots` (reports `limitViolations`).

---

## Build order (checklist)

1. **Tokens first** — primitive → semantic → (earned) component tokens, scopes locked, aliases set, `codeSyntax` on code-gen'd tokens. (`write_variables`)
2. **One base frame per legit variant combination**, fully styled with **bound** values.
3. Name each frame `axis=value, axis=value, …`.
4. `create_component_from_node` each frame.
5. `combine_as_variants` → the set. (VARIANT props come from names — never `add_component_property` for variants.)
6. `add_component_property` for BOOLEAN / TEXT / INSTANCE_SWAP; `create_slot` for slots.
7. **Wire** every non-variant property to a layer (`componentPropertyReferences` via `execute_code`).
8. Bind every visual value in every variant.
9. `set_code_mapping` to lock the 1:1 API.
10. **`lint_design_system` → fix → re-lint until clean. Only then export.**

---

## Common mistakes → the fix

1. **On/off as a 2-value variant** (`State=On/Off`, `Disabled=True/False`) → BOOLEAN property.
2. **Icon-per-variant** (`Icon=Search|Close|…`) → one INSTANCE_SWAP + `preferredValues`.
3. **Title Case / spaces / synonyms** in names (`Variant` vs `Type` vs `Style`; `Size` vs `Scale`) → one camelCase vocabulary = the code prop names.
4. **Free content faked** as a giant `INSTANCE_SWAP="Content"` or stacked TEXT variants → SLOT.
5. **Hardcoded** fills/radius/padding inside variants → bind every visual value to a variable.
6. **`fullWidth` / sizing as a BOOLEAN** → impossible (booleans drive only `visible`); use a VARIANT axis (`width=auto|full`) or a documented code-only prop.
7. **Dead properties** (a BOOLEAN/TEXT/SWAP no layer references) → wire it or delete it.
8. **Incomplete variant matrix** (missing combinations) → complete the cartesian product of legit axes, or remove the illegitimate axis. Code-gen turns gaps into `undefined` states.
9. **Over-tokenizing** (a component token per property that just equals the semantic token) → bind straight to semantic; component tokens only when repeated 3+ and independently re-themed.
10. **Instance-level restyle overrides** (paint/text-style override on an instance) → change the variant or the bound token, not the instance.
11. **Detached components** (a frame that duplicates a component) → always an instance.
12. **Default variant isn't the neutral base** → set `defaultVariant` to `variant=primary, size=md, state=default`.

---

## Lint → fix loop

After building, run `lint_design_system` (component/variant checks). It reads the live file via Plugin API 1.130 and flags the structural rules below. Fix every finding, re-lint, and only export when clean — this is what replaces "build each part one by one to find the issue."

---

## Enforceable structural rules (linter seeds)

Each rule with its **Plugin-API 1.130 detection surface**. Where a check is heuristic or not fully API-detectable, it is called out.

1. **No dead properties.** Every non-VARIANT property is referenced by ≥1 descendant. *Detect:* keys of `ComponentSetNode.componentPropertyDefinitions` (strip `#…`) vs union of descendants' `componentPropertyReferences` (`visible`/`characters`/`mainComponent`). Exact.
2. **On/off is not a variant.** No VARIANT property whose option set equals a boolean vocabulary (`{true,false}`,`{on,off}`,`{yes,no}`,`{show,hide}`,`{enabled,disabled}`,`{visible,hidden}`). *Detect:* `componentPropertyDefinitions[type=VARIANT].variantOptions`. Exact (vocabulary list).
3. **Complete matrix.** Product of every VARIANT property's option count === number of `COMPONENT` children in the set; no stray/un-named children. *Detect:* `variantOptions` product vs COMPONENT child count. Exact.
4. **No explosion.** Variant count ≤ 60; above that at least one axis must be re-expressed as BOOLEAN/INSTANCE_SWAP/SLOT. *Detect:* child count. Exact (threshold configurable).
5. **Assets are swaps, not variants.** No VARIANT axis with > 6 options that reads as an asset list (icon/avatar/logo). *Detect:* `variantOptions` cardinality (exact) + name heuristic (**fuzzy** — the "looks like an icon list" part is a heuristic, not a hard API signal).
6. **Code-identifier names.** Every property base name matches `^[a-z][a-zA-Z0-9]*$`, is unique in the set, and uses no cross-file synonym for a shared axis. *Detect:* `Object.keys(componentPropertyDefinitions)` across all sets via `findAllWithCriteria({types:['COMPONENT_SET']})`. Exact for shape; synonym clustering is heuristic.
7. **Consistent value vocabulary/casing.** For each shared property name, variant values are casing- and vocabulary-consistent across every set. *Detect:* aggregate `variantOptions` per property name file-wide. Exact.
8. **Swaps are constrained.** Every INSTANCE_SWAP property declares `preferredValues`. *Detect:* `componentPropertyDefinitions[type=INSTANCE_SWAP].preferredValues`. Exact.
9. **Bind everything.** Every paint/stroke/effect/cornerRadius/padding/itemSpacing/size on a component or variant layer is bound to a variable (or a style for paints/effects). *Detect:* per descendant `node.boundVariables`, `fills[].boundVariables`, `strokes[].boundVariables`, `strokeStyleId`, `effectStyleId`. Exact.
10. **Typography via style/vars.** Every TEXT layer in a component has `textStyleId` set or fully bound type variables (fontSize/lineHeight/etc.). *Detect:* `textStyleId` + `boundVariables`. Exact.
11. **Booleans don't resize.** Flag a BOOLEAN whose name implies sizing/layout (`fullWidth`, `wide`, `compact`) — Figma booleans bind only to `visible`. *Detect:* BOOLEAN names (**heuristic** — intent isn't API-encoded; structural warning).
12. **Clean instances.** No INSTANCE has restyle overrides (`overriddenFields` containing `fills`/`strokes`/`fontName`/`textStyleId`/`effects`). *Detect:* `InstanceNode.overrides` / `overriddenFields`. Exact.
13. **No detached duplicates.** No FRAME shares a COMPONENT's name (and layer structure) while not being an INSTANCE. *Detect:* `findAllWithCriteria` FRAME name-match against component names (**heuristic** — Plugin API 1.130 exposes **no** "was-detached" flag, so this is a name/structure signal only, not a certainty).
14. **Neutral default variant.** `ComponentSetNode.defaultVariant` resolves to the base tuple. *Detect:* `defaultVariant.variantProperties` vs a caller-supplied base-value map (**needs convention input** — "which value is base" is not API-derivable).
15. **Component tokens are aliases, and earned.** Every `component/*` variable is a `VARIABLE_ALIAS` to a semantic-collection variable (never a raw value) and is referenced ≥2× in its component subtree. *Detect:* `variable.valuesByMode` type `VARIABLE_ALIAS` + resolve target collection; count `boundVariables` references in the subtree. Exact.
16. **Deterministic code names.** Every code-gen'd component token carries `codeSyntax.WEB` (plus platform peers as needed). *Detect:* `variable.codeSyntax`. Exact.
17. **Figma↔code prop parity.** Each published COMPONENT_SET has a saved code mapping whose prop list matches its `componentPropertyDefinitions` keys. *Detect:* cross-reference `get_code_mappings` (the **MCP mapping store, not the Plugin API**) with `componentPropertyDefinitions`. Parity check is exact; note it depends on the MCP store, so it only fires for components a mapping was saved for.
