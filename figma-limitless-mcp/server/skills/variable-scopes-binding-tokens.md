# Variable Scopes — Binding the Right Token to the Right Property

> **One rule, non-negotiable:** every variable that is *not* a raw primitive must declare `scopes` that name the exact property it is allowed to bind to. `ALL_SCOPES` on a semantic or component token is a bug. Scope is the mechanism that makes the *correct* token the *only* token offered in the binding menu — and therefore the only thing the design→code layer can emit.

---

## 1. Why scopes decide whether your code output is right

Building a structurally-correct system in Figma "always messes up the code output unless you build each part one by one." The single biggest cause is **unscoped tokens polluting the binding menu**. Here is the exact mechanism, because you must internalize it:

- Figma's variable picker filters candidates by **two** things: the variable's `resolvedType` (COLOR / FLOAT / STRING / BOOLEAN) **and** its `scopes`. Type-matching alone is not enough — every FLOAT token is type-compatible with corner radius, gap, font size, opacity, icon size, and stroke weight *simultaneously*.
- So when a `radius/*` token carries `ALL_SCOPES` (the default `write_variables` gives you), binding a corner radius offers the designer **every FLOAT variable in the file** — `space/md`, `font/size/body`, `opacity/disabled`, `size/icon/md`, and the raw primitive `number/8`. Under time pressure the designer picks whatever is closest, or grabs the primitive, or gives up and types `8`.
- The Figma render then looks *fine* — 8px is 8px. But the **bound token is wrong**, and the design→code output (`get_design_context` / Dev Mode / Code Connect) reads `boundVariables` and emits the token that is actually bound:

  ```
  /* what shipped (radius bound to the wrong FLOAT token) */
  border-radius: var(--space-md);      /* semantically nonsense */
  border-radius: 8px;                  /* hardcoded — no token at all */

  /* what should have shipped */
  border-radius: var(--radius-md);
  ```

  The pixels matched; the **intent** was destroyed. That is the "it messes up the code output" pain, and it is 100% a scoping failure.

- **Correctly scoped, the failure is impossible.** If `radius/sm|md|lg` are scoped `[CORNER_RADIUS]` and nothing else in the file is, then binding a corner radius offers *only* the three radius tokens. The correct choice is the only choice. `get_design_context` deterministically resolves `boundVariables.topLeftRadius` → a `CORNER_RADIUS`-scoped variable → `radius.md` → `border-radius: var(--radius-md)`. The design→code mapping becomes **correct by construction** instead of correct-if-the-designer-was-careful.

**Scope is not cosmetic menu-tidying. It is the type system for design intent, and it is the thing that keeps generated code honest.** Everything below follows from that.

---

## 2. The 22 scopes — the canonical map

`resolvedType` gates the coarse category; `scopes` gates the exact property. A scope is only legal on a matching `resolvedType`. Memorize this table — it is the whole skill.

| Scope | Legal on resolvedType | Figma property it gates | Detect the binding via (Plugin API) |
|---|---|---|---|
| `ALL_SCOPES` | any | **everything** — forbidden on non-primitives | — |
| `ALL_FILLS` | COLOR | any fill (frame + shape + text) — a grouping scope | `node.fills[i].boundVariables.color` |
| `FRAME_FILL` | COLOR | frame / section / component background fill | `fills[].boundVariables.color`, `node.type` is a container |
| `SHAPE_FILL` | COLOR | vector / rectangle / ellipse / icon fill | `fills[].boundVariables.color`, shape `node.type` |
| `TEXT_FILL` | COLOR | text-node fill | `fills[].boundVariables.color`, `node.type==='TEXT'` |
| `STROKE_COLOR` | COLOR | stroke / border color | `node.strokes[i].boundVariables.color` |
| `EFFECT_COLOR` | COLOR | shadow / effect color | `node.effects[i].boundVariables.color` |
| `CORNER_RADIUS` | FLOAT | corner radius (all corners) | `node.boundVariables.topLeftRadius` … / `cornerRadius` |
| `WIDTH_HEIGHT` | FLOAT | width, height, min/max size | `node.boundVariables.width` / `.height` |
| `GAP` | FLOAT | auto-layout **item spacing AND padding** | `boundVariables.itemSpacing` / `paddingLeft`… |
| `STROKE_FLOAT` | FLOAT | stroke weight | `node.boundVariables.strokeWeight` / `strokeTopWeight`… |
| `OPACITY` | FLOAT | layer opacity | `node.boundVariables.opacity` |
| `EFFECT_FLOAT` | FLOAT | effect radius / spread / offset | `node.effects[i].boundVariables.radius`… |
| `FONT_SIZE` | FLOAT | font size | `node.boundVariables.fontSize` (whole-node) / styled segments |
| `FONT_WEIGHT` | FLOAT | numeric font weight (e.g. 400) | `boundVariables.fontWeight` |
| `LINE_HEIGHT` | FLOAT | line height | `boundVariables.lineHeight` |
| `LETTER_SPACING` | FLOAT | letter spacing | `boundVariables.letterSpacing` |
| `PARAGRAPH_SPACING` | FLOAT | paragraph spacing | `boundVariables.paragraphSpacing` |
| `PARAGRAPH_INDENT` | FLOAT | paragraph indent | `boundVariables.paragraphIndent` |
| `FONT_FAMILY` | STRING | font family | `boundVariables.fontFamily` |
| `FONT_STYLE` | STRING | font style ("Regular"/"Semi Bold") | `boundVariables.fontStyle` |
| `TEXT_CONTENT` | STRING | the text string itself | `boundVariables.characters` |

**BOOLEAN variables** support no design-property scope — only `ALL_SCOPES`. (They drive visibility/exposed props, not painted properties.)

**Note on padding:** there is deliberately **no** `PADDING` scope in the 22. Auto-layout padding binds under `GAP`. Therefore a spacing token used for gap *and* padding is scoped `[GAP]` — that is the only correct answer, by elimination.

**Note on `ALL_FILLS`:** it is a *grouping* scope equal to `FRAME_FILL + SHAPE_FILL + TEXT_FILL`. Use it only when a color genuinely applies to all three surfaces (rare for a well-factored system). Combining `ALL_FILLS` with any of its members is redundant and is a lint failure.

---

## 3. The prescriptive role → scope mapping (pick ONE way — this one)

For every non-primitive token, set exactly these scopes. Do not deviate; do not add `ALL_SCOPES` "to be safe."

### Color roles

| Role (by name convention) | resolvedType | **scopes (exactly)** | Never |
|---|---|---|---|
| `color/bg/*`, `color/surface/*` | COLOR | `[FRAME_FILL]` | TEXT_FILL, STROKE_COLOR |
| `color/fg/*`, `color/text/*`, `color/label/*`, `color/icon/*` (content ink) | COLOR | `[TEXT_FILL, SHAPE_FILL]` | FRAME_FILL |
| `color/border/*`, `color/divider/*` | COLOR | `[STROKE_COLOR]` | any *_FILL |
| `color/shadow/*`, `color/overlay/*` | COLOR | `[EFFECT_COLOR]` | any *_FILL |

Rationale for the clean split: **surfaces are `FRAME_FILL`, content ink is `TEXT_FILL + SHAPE_FILL`, borders are `STROKE_COLOR`.** No two role families share a scope, so a fill menu never mixes backgrounds with text colors. This requires one discipline: **build surfaces as auto-layout frames**, not rectangles. (If you must paint a rectangle "card," that's `SHAPE_FILL` and would collide with icon ink — convert it to a frame. This is why modern systems build everything with auto-layout.)

### Dimension & layout roles (all FLOAT)

| Role | **scopes (exactly)** |
|---|---|
| `radius/*` | `[CORNER_RADIUS]` |
| `space/*`, `gap/*`, `padding/*` | `[GAP]` |
| `size/*`, `*/width`, `*/height` (icon size, control height, avatar size) | `[WIDTH_HEIGHT]` |
| `border/width/*`, `stroke/width/*` | `[STROKE_FLOAT]` |
| `opacity/*` | `[OPACITY]` |
| `elevation/*/blur`, `*/spread`, `*/offset` | `[EFFECT_FLOAT]` |

### Type roles

| Role | resolvedType | **scopes (exactly)** |
|---|---|---|
| `font/family/*` | STRING | `[FONT_FAMILY]` |
| `font/style/*` (e.g. "Regular", "Semi Bold") | STRING | `[FONT_STYLE]` |
| `font/size/*` | FLOAT | `[FONT_SIZE]` |
| `font/weight/*` (numeric, e.g. 400/600) | FLOAT | `[FONT_WEIGHT]` |
| `font/lineHeight/*` | FLOAT | `[LINE_HEIGHT]` |
| `font/letterSpacing/*` | FLOAT | `[LETTER_SPACING]` |
| `font/paragraphSpacing/*` | FLOAT | `[PARAGRAPH_SPACING]` |

`TEXT_CONTENT` is **never** used on a design token — it is for binding real content strings (data), not the design system. Any primitive or semantic token carrying `TEXT_CONTENT` is a lint failure.

### Primitives are the one exception

Raw primitives (`number/8`, `color/blue/500`) live in the primitives collection and are **never bound directly** — only aliased by semantic tokens. Leave them `ALL_SCOPES` (their scope is irrelevant because they're not offered) and set `hiddenFromPublishing = true` so they stay out of the consuming binding menu entirely. Primitives are exempt from the "no ALL_SCOPES" rule *precisely because* they are hidden and alias-only.

### The decision procedure you run per variable

1. Is this a raw primitive in the primitives collection? → `hiddenFromPublishing = true`, leave `ALL_SCOPES`, **stop**.
2. Otherwise, name the **one** real property this token represents.
3. Look it up in the tables above → set **exactly** those scopes. Never `ALL_SCOPES`, never empty.
4. Assert every chosen scope is legal for the token's `resolvedType` (Section 2 column 2).

---

## 4. Worked example — a three-tier system, correctly scoped

Collections: `_Primitives` (mode `Value`, hidden), `Semantic` (modes `Light` / `Dark`), `Component` (single mode, aliases Semantic).

### `_Primitives` — raw, hidden, alias-only
```
color/blue/500   = #2563EB   (COLOR)   hiddenFromPublishing:true  scopes:[ALL_SCOPES]
color/slate/50   = #F8FAFC   (COLOR)   hidden, ALL_SCOPES
color/slate/900  = #0F172A   (COLOR)   hidden, ALL_SCOPES
color/white      = #FFFFFF   (COLOR)   hidden, ALL_SCOPES
number/1  = 1 | number/4 = 4 | number/8 = 8 | number/16 = 16 | number/24 = 24  (FLOAT, hidden, ALL_SCOPES)
```

### `Semantic` — aliases primitives, scoped to real use
```
color/bg/canvas     COLOR   Light→color/white     Dark→color/slate/900   scopes:[FRAME_FILL]
color/bg/surface    COLOR   Light→color/slate/50  Dark→color/slate/800   scopes:[FRAME_FILL]
color/fg/default    COLOR   Light→color/slate/900 Dark→color/white       scopes:[TEXT_FILL, SHAPE_FILL]
color/fg/muted      COLOR   Light→color/slate/500 Dark→color/slate/400   scopes:[TEXT_FILL, SHAPE_FILL]
color/border/default COLOR  Light→color/slate/200 Dark→color/slate/700   scopes:[STROKE_COLOR]
color/action/primary/bg  COLOR  Light→color/blue/500  Dark→color/blue/400  scopes:[FRAME_FILL]
color/action/primary/fg  COLOR  Light→color/white     Dark→color/slate/900 scopes:[TEXT_FILL, SHAPE_FILL]

radius/sm  FLOAT →number/4   scopes:[CORNER_RADIUS]
radius/md  FLOAT →number/8   scopes:[CORNER_RADIUS]
space/sm   FLOAT →number/8   scopes:[GAP]
space/md   FLOAT →number/16  scopes:[GAP]
size/icon/md FLOAT →number/24 scopes:[WIDTH_HEIGHT]
border/width/default FLOAT →number/1 scopes:[STROKE_FLOAT]
opacity/disabled FLOAT = 0.4 scopes:[OPACITY]

font/family/sans   STRING = "Inter"     scopes:[FONT_FAMILY]
font/style/emphasis STRING = "Semi Bold" scopes:[FONT_STYLE]
font/size/body     FLOAT  = 16          scopes:[FONT_SIZE]
font/weight/bold   FLOAT  = 600         scopes:[FONT_WEIGHT]
font/lineHeight/body FLOAT = 24         scopes:[LINE_HEIGHT]
```

### `Component` — aliases Semantic, still scoped
```
button/primary/bg  COLOR →color/action/primary/bg  scopes:[FRAME_FILL]
button/primary/fg  COLOR →color/action/primary/fg  scopes:[TEXT_FILL, SHAPE_FILL]
button/radius      FLOAT →radius/md                scopes:[CORNER_RADIUS]
button/padding-x   FLOAT →space/md                 scopes:[GAP]
```

### The payoff, at the binding menu

- Binding the button frame's **corner radius** offers only `radius/sm`, `radius/md`, `button/radius`. → code emits `border-radius: var(--button-radius)`.
- Binding the button frame's **fill** offers only `FRAME_FILL` colors: `color/bg/*`, `color/action/primary/bg`, `button/primary/bg`. It **cannot** offer `color/fg/default`. → `background: var(--button-primary-bg)`.
- Binding the label **text fill** offers only `TEXT_FILL/SHAPE_FILL` ink: `color/fg/*`, `button/primary/fg`. It **cannot** offer `color/bg/canvas`. → `color: var(--button-primary-fg)`.
- Binding **padding / gap** offers only `space/*`, `button/padding-x`. Not `radius`, not `font/size`. → `padding: 0 var(--button-padding-x)`.

Every binding is forced correct; the emitted code is deterministic. That is the entire point.

---

## 5. Common mistakes (each is a real code-output failure)

1. **Shipping the default `ALL_SCOPES`.** `write_variables` creates variables with `scopes:['ALL_SCOPES']` unless you set `scopes` explicitly. Forgetting to set it is the #1 defect. Set `scopes` on **every** non-primitive variable in the same `write_variables` call that creates it.
2. **Binding a background token to text (or vice-versa)** because both were `ALL_SCOPES`. The Figma frame looks right in one mode, then dark mode inverts and the code says `color: var(--color-bg-canvas)` on body copy. Scope the roles apart and it can't happen.
3. **A radius bound to `space/md` or the raw `number/8`.** All FLOAT, all offered under `ALL_SCOPES`. Output: `border-radius: var(--space-md)` or hardcoded `8px`. Fixed by `[CORNER_RADIUS]` isolation.
4. **Scope/type mismatch** — e.g. giving a COLOR token `CORNER_RADIUS`, or a FLOAT token `TEXT_FILL`. Meaningless and never bindable; the token silently never appears where it's wanted, so the designer hardcodes.
5. **Redundant grouping scopes** — `[ALL_FILLS, FRAME_FILL]` or `[ALL_SCOPES, TEXT_FILL]`. `ALL_SCOPES` must be alone; `ALL_FILLS` must not list its own members.
6. **Binding primitives directly.** If primitives aren't hidden and are `ALL_SCOPES`, designers bind `color/blue/500` straight onto a button. Code loses the semantic layer entirely and dark mode breaks. Hide primitives; bind semantics.
7. **Icon/text ink split from surfaces via SHAPE_FILL on a rectangle "card."** A rectangle surface is `SHAPE_FILL` and collides with icon ink. Build surfaces as auto-layout frames so `FRAME_FILL` owns them cleanly.
8. **Using `TEXT_CONTENT` on a design token.** It's for content strings, not tokens — its presence on a semantic token is always wrong.

---

## 6. Enforceable structural rules (linter seed — all Plugin-API-detectable)

Every rule below is checkable with `figma.variables.getLocalVariablesAsync()`, `getLocalVariableCollectionsAsync()`, `Variable.resolvedType / .scopes / .hiddenFromPublishing / .variableCollectionId`, alias resolution, and `node.boundVariables` (incl. `paints[].boundVariables`) via `findAllWithCriteria`. Identify the primitives collection by convention (name matches `/primitive|core|palette|^_/i` or a configured id).

1. **No ALL_SCOPES on non-primitives.** For any variable whose collection is not the primitives collection: `!scopes.includes('ALL_SCOPES')`. Else → error.
2. **Non-empty, type-valid scopes.** Non-primitive variables must have `scopes.length >= 1` and every scope must be legal for `resolvedType` (COLOR→{ALL_FILLS,FRAME_FILL,SHAPE_FILL,TEXT_FILL,STROKE_COLOR,EFFECT_COLOR}; STRING→{FONT_FAMILY,FONT_STYLE,TEXT_CONTENT}; FLOAT→{CORNER_RADIUS,WIDTH_HEIGHT,GAP,STROKE_FLOAT,OPACITY,EFFECT_FLOAT,FONT_SIZE,FONT_WEIGHT,LINE_HEIGHT,LETTER_SPACING,PARAGRAPH_SPACING,PARAGRAPH_INDENT}; BOOLEAN→{}). Any scope outside its type set → error.
3. **No redundant scope sets.** If `scopes` includes `ALL_SCOPES` it must be the only entry. If it includes `ALL_FILLS` it must not also include `FRAME_FILL`/`SHAPE_FILL`/`TEXT_FILL`. Else → warning.
4. **Color-role ⇄ scope by name.** `*/bg/*|*/surface/*` → fill scopes only, must not include `STROKE_COLOR`/`EFFECT_COLOR`; `*/border/*|*/divider/*` → `[STROKE_COLOR]` only; `*/fg/*|*/text/*|*/label/*|*/icon/*` → subset of `{TEXT_FILL,SHAPE_FILL}` only; `*/shadow/*|*/overlay/*` → `[EFFECT_COLOR]` only. Mismatch → error.
5. **Dimension-role ⇄ scope by name.** `radius/*`→`[CORNER_RADIUS]`; `space/*|gap/*|padding/*`→`[GAP]`; `size/*|*/width|*/height`→`[WIDTH_HEIGHT]`; `border/width/*|stroke/width/*`→`[STROKE_FLOAT]`; `opacity/*`→`[OPACITY]`. Mismatch → error.
6. **Type-role ⇄ scope by name.** `font/size/*`→`[FONT_SIZE]`; `*/lineHeight/*`→`[LINE_HEIGHT]`; `*/letterSpacing/*`→`[LETTER_SPACING]`; `font/weight/*`(FLOAT)→`[FONT_WEIGHT]`; `font/family/*`(STRING)→`[FONT_FAMILY]`; `font/style/*`(STRING)→`[FONT_STYLE]`. Mismatch → error.
7. **No TEXT_CONTENT on design tokens.** Any variable in the primitives or semantic/component collections with `scopes.includes('TEXT_CONTENT')` → error.
8. **Bound-property ⇄ scope match (live drift check).** For every `node.boundVariables` and `paints[].boundVariables` entry, resolve the variable and confirm its `scopes` permit that property given `node.type`: fill on a container frame → needs `FRAME_FILL`/`ALL_FILLS`; fill on `TEXT` → `TEXT_FILL`/`ALL_FILLS`; fill on a shape → `SHAPE_FILL`/`ALL_FILLS`; stroke color → `STROKE_COLOR`; `topLeftRadius`/`cornerRadius` → `CORNER_RADIUS`; `itemSpacing`/`padding*` → `GAP`; `strokeWeight` → `STROKE_FLOAT`; `width`/`height` → `WIDTH_HEIGHT`; `fontSize`→`FONT_SIZE`, etc. Off-scope binding → error (this is the check that catches wrong bindings before they reach code output).
9. **No direct primitive bindings.** Any `node`/`paints[]` `boundVariables` that resolves to a variable in the primitives collection → error ("bind the semantic token, not the primitive").
10. **Publishing hygiene.** Primitives must be `hiddenFromPublishing === true`; semantic and component tokens must be `hiddenFromPublishing === false`. Else → warning.

Run order: build → `lint_tokens` (rules 1–7, 10 on the variable set) → `lint_design_system` (rules 8–9 on live nodes) → fix → re-lint. Rules 1–2 alone eliminate the majority of the design→code corruption this system exists to prevent.
