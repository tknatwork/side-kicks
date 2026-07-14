# Accessibility & Naming Conventions

> Niche, quality-raising checks: **contrast between semantic fg/bg token pairs**, **minimum text sizes**, **naming-convention conformance**, and **orphan / duplicate / unused / mis-tiered tokens**. Every rule below is detectable **locally** via Figma Plugin API 1.130 — no REST, no token, no network. Each rule names the exact API call that proves it.

---

## Why this exists (the code-output pain)

Design→code generation "always messes it up unless you build each part one by one" for two structural reasons, both fixable up front:

1. **There is no guarantee that a foreground goes with the right background.** If `color/content/on-brand` is just a loose variable that happens to sit near `color/surface/brand`, the codegen has no way to know they are a *pair*. It picks a plausible-looking combination, ships it, and you discover the 1.4:1 contrast failure only after rendering the component. Contrast is an **emergent property of a pair**, so it must be encoded as a pair — by naming convention — and checked by the linter, not by eyeballing rendered components.
2. **Ad-hoc names don't survive the trip to code.** A token called `color/blue-btn-text-2` maps to no stable code identifier, so the generator invents a name (`blueBtnText2`, `btnTextBlue`, …) and the design and code namespaces drift apart. Strict kebab/slash naming with an approved vocabulary makes the code name **derivable and stable**, so the same token is the same identifier everywhere.

The linter closes the loop: **build → `lint_design_system` → fix → re-lint**. You stop discovering structural drift by assembling components one at a time; the file tells you.

---

## The one right way (canonical rules)

Pick this structure. Do not improvise alternatives.

### 1. Three token tiers, three collections — strict one-directional layering

| Tier | Collection | Modes | Holds | May reference |
| --- | --- | --- | --- | --- |
| **Primitive** | `primitives` | 1 (`value`) | raw literals only | nothing (literals only) |
| **Semantic** | `theme` | ≥2 (`light`, `dark`, …) | **aliases only** | `primitives` only |
| **Component** | `component` | mirrors `theme` or 1 | **aliases only** | `theme` only |

Hard layering laws (each is a linter rule):

- A **primitive** value in every mode is a literal (`{r,g,b,a}` / number / string), **never** a `VARIABLE_ALIAS`. → `RULE TOK-01`
- A **semantic** value in every mode is a `VARIABLE_ALIAS` into `primitives`, **never** a literal. A raw hex sitting in the `theme` tier is the single most common cause of code drift. → `RULE TOK-02`
- A **component** value is a `VARIABLE_ALIAS` into `theme`. It must **not** alias a primitive directly (skipping the semantic tier defeats theming). → `RULE TOK-03`
- **Themes live in modes, not in names.** There is no `color/surface/base-dark`. Light/dark are two modes of the *same* `color/surface/base` variable. → `RULE TOK-04`

### 2. Naming grammar (kebab + slash, closed vocabulary)

- Every slash segment matches `^[a-z0-9]+(-[a-z0-9]+)*$` — lowercase kebab, no camelCase, no spaces, no underscores. → `RULE NAME-01`
- Path shape is `<category>/<role-or-ramp>/<item>`, depth **2–4** segments. → `RULE NAME-02`
- Numeric scale steps are **zero-padded to 3 digits** (`050`, `100`, `500`, `900`) so lexical and numeric sort agree. → `RULE NAME-03`
- **Primitive** names are ramps: `color/<hue>/<step>`, `space/<step>`, `radius/<step>`, `font-size/<step>`. Raw hue words (`blue`, `amber`) are allowed here and **only** here. → `RULE NAME-04`
- **Semantic** names are roles from a **closed allowlist** — no raw hues, no component names. Approved color roles: `surface`, `content`, `border`, `icon`, plus intent modifiers `brand | neutral | info | success | warning | danger`, plus the pairing prefix `on-*`. A segment outside the allowlist is an ad-hoc name and fails. → `RULE NAME-05`
- Every non-hidden variable has a `codeSyntax.WEB` entry, and it is the dotted/kebab form of the path (`color.surface.brand`). Missing or mismatched codeSyntax is what forces the generator to guess. → `RULE NAME-06`
- No two non-hidden variables produce the **same code identifier** across collections (namespace collision). → `RULE NAME-07`

### 3. The `on-*` pairing convention (this is what makes contrast checkable)

**For every background token `color/surface/<x>` there MUST exist a foreground token `color/content/on-<x>` in the same `theme` collection.** That pair — and only that pair — is the contract the linter checks for contrast, in **every mode**.

- Missing counterpart (`surface/x` with no `content/on-x`, or vice-versa) → `RULE PAIR-01`.
- For each pair, in each mode, resolve both aliases to concrete RGB and compute contrast (below). → `RULE A11Y-01`.

This makes contrast a **deterministic, node-free computation over `valuesByMode`** — you never have to render a component to know if it passes.

### 4. Minimum text size floor

- No `TextStyle` and no `font-size` primitive is below **12px** (absolute floor). → `RULE A11Y-04`
- Default body text style is **≥ 16px**; a text style tagged/ named `body*` below 16px is a warning. → `RULE A11Y-05`
- The 4.5:1 vs 3:1 contrast threshold is chosen per style using the WCAG **large-text** rule: `fontSize ≥ 24px`, **or** `fontSize ≥ 18.66px` AND weight ≥ 700 (from `TextStyle.fontName.style`). → feeds `A11Y-01`.

---

## Contrast math (compute locally — no rendering needed for solid opaque tokens)

Figma variable colors are already `{r,g,b,a}` floats in `0..1`. For an **opaque solid** pair you have everything; compute WCAG directly.

**WCAG 2.x relative luminance & ratio** (this is the enforcement gate):

```
linearize(c) = c <= 0.03928 ? c/12.92 : ((c + 0.055)/1.055) ** 2.4   // c in 0..1
L = 0.2126*linearize(r) + 0.7152*linearize(g) + 0.0722*linearize(b)
ratio = (Llighter + 0.05) / (Ldarker + 0.05)                          // 1..21
```

Thresholds (gate = **fail below**):

| Context | WCAG min |
| --- | --- |
| Body / normal text | **4.5 : 1** |
| Large text (≥24px, or ≥18.66px bold) | **3 : 1** |
| Borders / icons / focus rings (`border/*`, `icon/*`) — graphical-object contrast, SC 1.4.11 | **3 : 1** |

**APCA (advisory, reported not gated):** also emit APCA `Lc` from the resolved RGB using the bundled offline `apca-w3` (0.1.9) constants shipped in the recipe — do **not** approximate with a homemade polynomial. Advisory targets: `Lc ≥ 60` body, `Lc ≥ 45` large, `Lc ≥ 75` fine print. WCAG remains the pass/fail gate until WCAG 3 is final. → `RULE A11Y-02` (advisory).

**When the raw-RGB shortcut is invalid — you MUST fall back to pixel sampling:** the WCAG formula above is only truthful for a **flat, fully-opaque solid** foreground on a **flat, fully-opaque solid** background. It lies when any of these is true:

- a paint has `color.a < 1` or `paint.opacity < 1` (must composite over the actual backdrop first),
- the fill `type !== 'SOLID'` (gradient / image / video),
- effects, blend modes, or overlapping layers sit between fg and bg.

In those cases resolve nothing — render truth instead: `node.exportAsync({format:'PNG'})` a small swatch of the fg-over-bg composite and sample pixel luminance. Detectable via `paint.opacity`, `paint.type`, `color.a`, `node.effects`, `node.blendMode`. → `RULE A11Y-03`.

**Mode handling:** evaluate every pair in **every mode** of the `theme` collection straight from `valuesByMode`. Do **not** rely on per-node resolved-mode traversal for the gate — `node.explicitVariableModes` only carries explicit overrides and is unreliable for deep nodes. The mode-complete sweep over token pairs is both simpler and more complete.

**Optional empirical sweep (advisory):** additionally, `figma.root.findAllWithCriteria({ types: ['TEXT'] })`; for each text node read `fills[0].boundVariables?.color` → variable `F`, walk ancestors to the nearest node with a bound solid fill variable `B`, and check `contrast(F,B)` per theme mode. This catches *rendered* pairs that dodged the `on-*` convention. It supplements, never replaces, the deterministic pair gate.

---

## Orphan / duplicate / unused / mis-tiered detection

Build one **usage set** = (every variable id in any node's `boundVariables` / `paints[].boundVariables`, via `findAllWithCriteria`) ∪ (every alias-target id found while scanning all variables' `valuesByMode`).

- **Broken alias (error):** a `valuesByMode` `VARIABLE_ALIAS` whose target id no longer resolves via `getVariableByIdAsync`. → `RULE ORPH-01`
- **Unused (warn, advisory):** a variable id absent from the usage set. **Caveat:** cross-file library usage is invisible to the local Plugin API — a token used only in another file looks unused. Emit as a warning, never auto-delete. → `RULE ORPH-02`
- **Duplicate primitive (warn):** two primitives with identical resolved value in the same mode → consolidate to one. Compare `valuesByMode` after alias resolution. → `RULE ORPH-03`
- **Duplicate semantic intent (warn):** two `theme` tokens whose full alias chains land on the same primitive in the same mode AND share a role stem → likely a rename or a merge. → `RULE ORPH-04`

---

## Worked example (real collection / variable / scope / alias names)

### `primitives` (1 mode: `value`)

```
color/neutral/000   = #FFFFFF
color/neutral/900   = #111418
color/blue/050      = #EFF4FF
color/blue/600      = #1D4ED8
color/amber/300     = #FCD34D
font-size/100       = 14   (scope: FONT_SIZE)
font-size/200       = 16   (scope: FONT_SIZE)
```

### `theme` (2 modes: `light`, `dark`) — aliases only

| Variable | `light` → alias | `dark` → alias |
| --- | --- | --- |
| `color/surface/base` | `color/neutral/000` | `color/neutral/900` |
| `color/content/on-base` | `color/neutral/900` | `color/neutral/000` |
| `color/surface/brand` | `color/blue/600` | `color/blue/600` |
| `color/content/on-brand` | `color/neutral/000` | `color/neutral/000` |
| `color/surface/warning` | `color/amber/300` | `color/amber/300` |
| `color/content/on-warning` | `color/neutral/000` ⚠️ | `color/neutral/000` ⚠️ |

### `component` (mirrors `theme`) — aliases into `theme` only

```
button/primary/bg     → color/surface/brand
button/primary/label  → color/content/on-brand
```

### What the linter computes (per pair, per mode)

- `surface/base` ↔ `content/on-base`: light `#FFFFFF`↔`#111418` ≈ **17 : 1** PASS; dark inverse PASS.
- `surface/brand` ↔ `content/on-brand`: `#1D4ED8`↔`#FFFFFF` ≈ **6.6 : 1** PASS (AA normal + AAA large).
- **`surface/warning` ↔ `content/on-warning`: `#FCD34D`↔`#FFFFFF` ≈ 1.36 : 1 → `A11Y-01` ERROR.**

### The deliberate failure it catches, and the fix

White-on-amber is the classic mistake a component-by-component build would ship. The linter flags it from `valuesByMode` alone — before any button exists. **Fix:** re-point `color/content/on-warning` (both modes) → `color/neutral/900` (`#111418`), giving ≈ **12 : 1**. Re-lint → green.

This is exactly the guarantee that lets design→code stop being "build one piece, find the break, repeat."

---

## How the linter detects each rule (Plugin API 1.130 grounding)

| Rule | Detection surface |
| --- | --- |
| TOK-01/02/03/04 (tiering, aliasing, modes) | `getLocalVariableCollectionsAsync()` → `.modes` / `.defaultModeId`; `getLocalVariablesAsync()` → `.variableCollectionId`, `.valuesByMode` (literal vs `{type:'VARIABLE_ALIAS'}`), resolve target's collection via `getVariableByIdAsync` |
| NAME-01…05 (grammar, vocabulary) | `Variable.name`, `VariableCollection.name`, style `.name` — regex + allowlist |
| NAME-06 (codeSyntax) | `Variable.codeSyntax` (WEB/ANDROID/iOS keys) |
| NAME-07 (code collision) | derive identifier from `codeSyntax.WEB` ?? name; detect dupes |
| PAIR-01 (`on-*` completeness) | set-diff over `Variable.name` within `theme` collection |
| A11Y-01 (WCAG pair gate) | `valuesByMode` → resolve alias chain → RGB → luminance formula; large-text branch from `TextStyle.fontSize` + `fontName.style` |
| A11Y-02 (APCA advisory) | same resolved RGB → bundled `apca-w3` |
| A11Y-03 (pixel fallback trigger) | `paint.opacity`, `paint.type`, `color.a`, `node.effects`, `node.blendMode`; `node.exportAsync({format:'PNG'})` sampling |
| A11Y-04/05 (text floor) | `getLocalTextStylesAsync()` → `.fontSize`, `.fontName`; `font-size` primitives with scope `FONT_SIZE` |
| ORPH-01 (broken alias) | `valuesByMode` alias id → `getVariableByIdAsync` returns null |
| ORPH-02 (unused) | usage set from `findAllWithCriteria(...).boundVariables` + `paints[].boundVariables` ∪ alias refs; advisory (cross-file blind) |
| ORPH-03/04 (duplicates) | resolved `valuesByMode` value equality within tier |

Anything **not** on this table is **not** locally detectable — e.g. real cross-file token usage, and true rendered contrast through library-component overlays you can't reach. Report those as advisory-only and say so; never gate on them.

---

## Common mistakes to avoid

- **Encoding a theme in the name** (`surface/base-dark`) instead of a mode. Breaks `TOK-04`, doubles your token count, and confuses codegen theming.
- **Literals in the semantic tier** (`color/surface/brand = #1D4ED8`). This is the #1 code-drift cause — semantic must alias. Breaks `TOK-02`.
- **Component tokens aliasing primitives directly**, skipping `theme`. Themes stop propagating. Breaks `TOK-03`.
- **Checking every fg against every bg.** Combinatorial noise. Check the **`on-*` pairs only** for the gate; use the node sweep as advisory.
- **Trusting the WCAG formula on translucent / gradient / effect-laden fills.** It will read "pass" on a lie. Fall back to `exportAsync` pixel sampling (`A11Y-03`).
- **Auto-deleting "unused" tokens.** Local usage is file-scoped; a library consumer elsewhere still needs it. Warn, don't delete (`ORPH-02`).
- **Missing / hand-wavy `codeSyntax`.** Without it the generator invents identifiers. Every non-hidden variable needs a WEB codeSyntax that matches its path (`NAME-06`).
- **Un-padded scale steps** (`color/blue/50` next to `color/blue/500`). Sort order breaks; pad to 3 (`NAME-03`).
- **Approximating APCA by hand.** Ship and call the vendored `apca-w3` constants; a homemade curve gives wrong `Lc`.
