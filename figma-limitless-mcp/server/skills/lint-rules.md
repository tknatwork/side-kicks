# Design-System Structure Linter — Rule Catalog (57 rules)

Every rule is detectable locally via Figma Plugin API 1.130 (verified — 0 need REST). Whole-file scans prepend `figma.loadAllPagesAsync()` (dynamic-page manifest).

## a11y

### `fg-bg-pair-contrast` — ERROR
- **Checks:** For each surface/on-* (bg/fg) pair, in every theme mode, resolved-RGB WCAG contrast >=4.5:1 for normal text and >=3:1 for large text (fontSize>=24px, or >=18.66px with weight>=700) (A11Y-01).
- **Detect:** When resolving an alias into a primitive, read the primitive in ITS collection's mode (single-mode → defaultModeId), not the semantic modeId. Pairing fg/bg is name-convention (surface/on-*) but RGB+contrast is fully local.
- **Fix:** Re-point the fg or bg alias to a primitive that clears the ratio in every mode; verify Light and Dark independently.

### `border-icon-graphical-contrast` — WARN
- **Checks:** border/* and icon/* semantic tokens must meet >=3:1 against their paired surface in every theme mode (SC 1.4.11) (A11Y-03).
- **Detect:** Resolve the paired surface RGB in the same mode; follow each alias into its target collection's own mode as in fg-bg-pair-contrast.
- **Fix:** Choose a darker/lighter primitive for the border/icon token so it clears 3:1 against its surface in all modes.

### `min-font-size` — WARN
- **Checks:** No TextStyle.fontSize and no FONT_SIZE-scoped primitive below 12px; a body-tagged text style below 16px is a warning (A11Y-04).
- **Detect:** figma.getLocalTextStylesAsync() -> TextStyle.fontSize; and FONT_SIZE-scoped FLOAT primitives via getLocalVariablesAsync(); warn on values <12px, and on body-role styles <16px.
- **Fix:** Raise the offending font-size token/style to at least the minimum (12px hard floor, 16px for body).

### `contrast-fallback-export-sampling` — INFO
- **Checks:** When a paint has color.a<1, paint.opacity<1, type!=='SOLID', or the node has effects/blend modes, the raw-RGB WCAG shortcut is invalid - contrast must come from exportAsync pixel sampling (A11Y-05). Methodology guard for the contrast rules.
- **Detect:** Inspect paint.color.a, paint.opacity, paint.type, and node.effects/blendMode; when any trip, switch the contrast computation to node.exportAsync({format:'PNG'}) and sample the rendered pixels instead of resolved token RGB.
- **Fix:** Run the contrast check via exportAsync sampling for these nodes; do not trust the alias-resolved RGB when alpha/effects are present.

## code-output

### `no-raw-value-on-component-node` — ERROR
- **Checks:** Every SOLID paint (fills/strokes), drop-shadow effect, cornerRadius (x4), itemSpacing, padding*, width/height, and strokeWeight on COMPONENT/COMPONENT_SET/INSTANCE and their layers must be variable-bound (paints/effects may alternatively use a style). No raw values.
- **Detect:** Prepend loadAllPagesAsync before findAllWithCriteria({types:['COMPONENT','COMPONENT_SET','INSTANCE']}); traverse descendants; corner radius is four separate boundVariables keys, not a single 'cornerRadius'.
- **Fix:** Bind each raw paint/scalar to the appropriate semantic/component token (or apply a paint/effect style); build the token first if it doesn't exist.

### `text-layer-uses-style-or-bound-type` — ERROR
- **Checks:** Every TEXT layer inside a component must set textStyleId, or have fontSize and lineHeight fully bound to type variables.
- **Detect:** Scan TEXT nodes after loadAllPagesAsync; treat mixed textStyleId (figma.mixed) as unset when deciding the style-or-bound branch.
- **Fix:** Apply a text style via apply_text_style, or bind fontSize/lineHeight to type tokens.

### `published-variable-has-codesyntax-web` — ERROR
- **Checks:** Every publishable variable (hiddenFromPublishing===false - i.e. all Semantic/Component tokens) must have a non-empty codeSyntax.WEB (plus platform peers for shipped platforms).
- **Detect:** Variable.codeSyntax read from getLocalVariablesAsync(); for each variable with hiddenFromPublishing===false assert codeSyntax.WEB is a non-empty string.
- **Fix:** Set codeSyntax.WEB (e.g. var(--<name>)) via write_variables for every published token so codegen emits a stable custom property.

### `codesyntax-web-unique` — ERROR
- **Checks:** No two variables may emit the same CSS custom property / code identifier (namespace collision) (NAME-07).
- **Detect:** Aggregate Variable.codeSyntax.WEB across all getLocalVariablesAsync(); error on any duplicate value.
- **Fix:** Rename one token (and regenerate its codeSyntax.WEB) so every emitted identifier is unique.

### `codesyntax-web-matches-name` — WARN
- **Checks:** codeSyntax.WEB should equal var(--<name with '/' replaced by '-'>); drift between name and emitted property is flagged (NAME-06).
- **Detect:** Compute expected string from Variable.name and compare to Variable.codeSyntax.WEB; warn on mismatch.
- **Fix:** Regenerate codeSyntax.WEB from the canonical name so design and code stay in lockstep.

### `published-variable-has-description` — INFO
- **Checks:** Publishable variables should carry a non-empty description for consumer docs.
- **Detect:** Variable.description; info-flag empty descriptions on variables with hiddenFromPublishing===false.
- **Fix:** Add a short description explaining the token's role via write_variables.

### `component-set-has-code-mapping` — WARN
- **Checks:** Each published COMPONENT_SET should have a saved code mapping whose prop list matches its componentPropertyDefinitions keys. NOTE: the mapping store is NOT the Plugin API - it is the MCP mapping surface (get_code_mappings/set_code_mapping); only the prop-list side is Plugin-API-derivable.
- **Detect:** Prop-key side: ComponentSetNode.componentPropertyDefinitions (Plugin API). Mapping side: query the MCP's local get_code_mappings store (not Plugin API, but local). Warn if no mapping or key-set mismatch.
- **Fix:** Create/update the Code Connect mapping via set_code_mapping so its props match componentPropertyDefinitions exactly.

## components

### `no-dead-component-property` — WARN
- **Checks:** Each non-VARIANT property (BOOLEAN->visible, TEXT->characters, INSTANCE_SWAP->mainComponent) must be referenced by >=1 descendant; dead properties are flagged.
- **Detect:** Match on the full '#id'-suffixed property key (definition keys carry the suffix; componentPropertyReferences values reference that same suffixed key). Scan descendants after loadAllPagesAsync if the set is off the current page.
- **Fix:** Wire the property to a layer via componentPropertyReferences, or delete the unused property.

### `boolean-vocab-variant-should-be-boolean` — ERROR
- **Checks:** No VARIANT property may enumerate a boolean vocabulary ({true,false}/{on,off}/{yes,no}/{show,hide}/{enabled,disabled}/{visible,hidden}); that axis must be a BOOLEAN property.
- **Detect:** componentPropertyDefinitions[type==='VARIANT'].variantOptions; error if the option set matches a known boolean vocabulary.
- **Fix:** Convert the axis to a BOOLEAN property bound to layer visibility instead of a two-value variant.

### `variant-matrix-complete` — ERROR
- **Checks:** The product of every VARIANT property's option count must equal the number of COMPONENT children in the set (no missing combinations).
- **Detect:** Count children via componentSet.children filtered to type==='COMPONENT'; run after loadAllPagesAsync if the set may be off-page.
- **Fix:** Add the missing variant combinations, or reduce an axis to BOOLEAN/INSTANCE_SWAP so the matrix is fully enumerated.

### `variant-count-ceiling-60` — WARN
- **Checks:** A component set with >60 COMPONENT children should re-express at least one axis as BOOLEAN/INSTANCE_SWAP/SLOT.
- **Detect:** Count COMPONENT children of the ComponentSetNode; warn if >60.
- **Fix:** Collapse a combinatorial axis into a BOOLEAN, INSTANCE_SWAP, or SLOT to shrink the matrix.

### `no-asset-enumeration-variant` — WARN
- **Checks:** No VARIANT axis may enumerate icons/avatars/assets as options - use INSTANCE_SWAP with preferredValues.
- **Detect:** Inspect variantOptions cardinality (large/exact) plus an asset-name heuristic on option values; warn on suspected asset enumeration.
- **Fix:** Replace the asset variant axis with an INSTANCE_SWAP property whose preferredValues list the assets.

### `property-name-convention-unique` — ERROR
- **Checks:** Property base names (variant and non-variant, '#...' suffix stripped) must match ^[a-z][a-zA-Z0-9]*$, be unique per set, and avoid cross-file synonyms for a shared axis.
- **Detect:** Prepend loadAllPagesAsync so findAllWithCriteria enumerates every component set in the file, not just the current page.
- **Fix:** Rename properties to a single camelCase base name and reuse one canonical name for the same axis across the file.

### `shared-property-value-consistency` — WARN
- **Checks:** For each shared property name, variant option values must be vocabulary- and casing-consistent across every set in the file.
- **Detect:** Run after loadAllPagesAsync for true file-wide aggregation.
- **Fix:** Normalize option values (e.g. 'sm/md/lg' everywhere) so the same axis reads identically across components.

### `instance-swap-preferred-values` — ERROR
- **Checks:** Every INSTANCE_SWAP property must declare preferredValues (constrains the code union type).
- **Detect:** componentPropertyDefinitions[type==='INSTANCE_SWAP'].preferredValues; error if missing/empty.
- **Fix:** Add preferredValues listing the allowed swap targets so codegen emits a bounded union.

### `boolean-prop-no-sizing-intent` — INFO
- **Checks:** No BOOLEAN property should encode sizing/layout intent (fullWidth, wide, compact) - Figma booleans bind only to visibility. Intent is not API-encoded (heuristic).
- **Detect:** Heuristic on BOOLEAN property base names (Object.keys(componentPropertyDefinitions) with type BOOLEAN) matching sizing words; info-flag only.
- **Fix:** Re-express sizing as a VARIANT/size axis or bound layout token; keep booleans for show/hide semantics.

### `no-instance-restyle-override` — WARN
- **Checks:** No INSTANCE may override fills/strokes/fontName/textStyleId/effects (restyle drift breaks codegen fidelity).
- **Detect:** Iterate instance.overrides[].overriddenFields (flat NodeChangeProperty list per overridden node); warn if it intersects {fills,strokes,fontName,textStyleId,effects}. Scan instances after loadAllPagesAsync.
- **Fix:** Move the desired styling into the source component (new variant/token) and reset the instance override.

### `detached-component-frame-signal` — INFO
- **Checks:** A FRAME duplicating a COMPONENT's name/structure without being an INSTANCE is a detached-component signal. Heuristic only - Plugin API 1.130 exposes no 'was-detached' flag.
- **Detect:** findAllWithCriteria FRAME whose name matches a known COMPONENT name; structural similarity heuristic. Info-flag only (no authoritative detach flag exists).
- **Fix:** Replace the duplicated frame with an instance of the component, or confirm it is intentionally bespoke.

### `default-variant-is-base-tuple` — WARN
- **Checks:** The set's defaultVariant must resolve to the neutral base value on each axis. 'Which value is base' is not API-derivable - requires a caller-supplied base-value map.
- **Detect:** ComponentSetNode.defaultVariant.variantProperties compared against a caller-supplied base-value convention map; warn on mismatch (convention input required).
- **Fix:** Reorder/assign the default variant so each axis sits at its documented base value.

## naming

### `name-kebab-segments` — ERROR
- **Checks:** Each slash-delimited segment of Variable.name must match ^[a-z0-9]+(-[a-z0-9]+)*$ - no camelCase, spaces, underscores, caps, or leading-digit oddities (NAME-01).
- **Detect:** Split Variable.name on '/' and test each segment against the regex; error on any non-conforming segment.
- **Fix:** Rename to lowercase kebab segments (e.g. bg/surface-raised), then regenerate codeSyntax.WEB.

### `name-slash-structure-depth` — WARN
- **Checks:** Variable paths should have 2-4 segments following <category>/<role-or-ramp>/<item> (NAME-02).
- **Detect:** Variable.name.split('/').length between 2 and 4; warn otherwise.
- **Fix:** Restructure the name into the standard depth (e.g. color/brand/500, bg/surface/raised).

### `top-segment-in-tier-vocabulary` — ERROR
- **Checks:** Primitive top segment in {color,space,radius,font,size,line-height}; Semantic top segment in {bg,fg,border,brand}.
- **Detect:** Group getLocalVariablesAsync() by tier (via variableCollectionId); assert Variable.name.split('/')[0] is in the tier's allowed vocabulary; error otherwise.
- **Fix:** Rename so the leading segment matches the tier's controlled vocabulary, or move the token to the tier its name implies.

### `numeric-scale-zero-padded` — WARN
- **Checks:** Ramp steps must be 050, 100, 500 (not 50, 5) (NAME-03).
- **Detect:** Regex-match trailing numeric segments of Variable.name; warn on non-3-digit numeric steps.
- **Fix:** Zero-pad scale steps to three digits for stable sort order and codegen.

### `hue-ramp-words-primitives-only` — WARN
- **Checks:** Raw hue/ramp words (blue, amber, neutral steps) may appear only in the Primitives collection (NAME-04).
- **Detect:** Detect hue/ramp tokens in Variable.name segments; warn if the variable's variableCollectionId is not the Primitives collection.
- **Fix:** Use role-based names (bg/*, fg/*) in semantic tiers; keep hue words in primitives only.

### `semantic-role-allowlist` — WARN
- **Checks:** Semantic color segments limited to {surface,content,border,icon} + intents {brand,neutral,info,success,warning,danger} + on-* prefix; out-of-vocabulary segments are ad-hoc (NAME-05).
- **Detect:** For semantic-collection variables, test each name segment against the closed allowlist; warn on any segment outside it.
- **Fix:** Rename to an approved role/intent, or extend the allowlist deliberately rather than ad hoc.

### `surface-on-pair-completeness` — WARN
- **Checks:** For every color/surface/<x> there must exist color/content/on-<x>, and vice-versa (PAIR-01).
- **Detect:** Build the set of surface names and the set of on-* content names from Variable.name; warn on any set-difference (unpaired surface or orphan on-* token).
- **Fix:** Create the missing paired token so every surface has a legible foreground and every on-* has its surface.

## scopes

### `no-all-scopes-on-typed-token` — ERROR
- **Checks:** No non-primitive typed variable may have scopes containing ALL_SCOPES (BOOLEAN is the only type for which ALL_SCOPES is legal). Primitives exempt only when hidden and alias-free.
- **Detect:** Variable.scopes read via getLocalVariablesAsync(); error if scopes includes 'ALL_SCOPES' for any Semantic/Component variable, or for any COLOR/FLOAT/STRING variable regardless of tier.
- **Fix:** Replace ALL_SCOPES with the specific scope family for the token's role (e.g. bg -> FRAME_FILL, radius -> CORNER_RADIUS).

### `scope-legal-for-resolved-type` — ERROR
- **Checks:** COLOR->fill/stroke/effect-color scopes; STRING->FONT_FAMILY/FONT_STYLE/TEXT_CONTENT; FLOAT->the 12 numeric scopes; BOOLEAN->ALL_SCOPES only. Also scopes.length>=1 for non-primitives.
- **Detect:** Cross-check Variable.resolvedType against each entry of Variable.scopes using the fixed legal-scope table per type; error on any illegal (type,scope) pair or empty scopes on a non-primitive.
- **Fix:** Remove scopes that don't apply to the variable's resolvedType and add the correct one; a COLOR token cannot carry CORNER_RADIUS, etc.

### `non-redundant-scope-set` — WARN
- **Checks:** ALL_SCOPES must be the sole entry if present; ALL_FILLS must not coexist with FRAME_FILL/SHAPE_FILL/TEXT_FILL.
- **Detect:** Inspect Variable.scopes: warn if 'ALL_SCOPES' appears alongside other scopes, or if 'ALL_FILLS' appears alongside any of FRAME_FILL/SHAPE_FILL/TEXT_FILL.
- **Fix:** Collapse to the narrowest correct set - either the umbrella scope alone or the specific scopes, not both.

### `color-role-scope-match` — ERROR
- **Checks:** bg/surface->[FRAME_FILL] (or SHAPE_FILL); fg/text/label/icon->subset of {TEXT_FILL,SHAPE_FILL}; border/divider->[STROKE_COLOR]; shadow/overlay->[EFFECT_COLOR]. No cross-family scopes.
- **Detect:** Derive role from the leading Variable.name segment; assert Variable.scopes is a subset of the allowed set for that role and contains no scope from another color family.
- **Fix:** Set scopes to the family the name implies (a fg/* token gets TEXT_FILL, a border/* token gets STROKE_COLOR).

### `dimension-role-scope-match` — ERROR
- **Checks:** radius/*->[CORNER_RADIUS]; space|gap|padding/*->[GAP]; size|*/width|*/height->[WIDTH_HEIGHT]; border/width/*->[STROKE_FLOAT]; opacity/*->[OPACITY].
- **Detect:** For FLOAT variables (Variable.resolvedType==='FLOAT'), derive role from Variable.name and assert Variable.scopes equals the mapped numeric scope.
- **Fix:** Align scopes to the dimension role the name encodes; a space/* token binds GAP, not WIDTH_HEIGHT.

### `type-role-scope-match` — ERROR
- **Checks:** font/size->[FONT_SIZE]; lineHeight->[LINE_HEIGHT]; letterSpacing->[LETTER_SPACING]; font/weight (FLOAT)->[FONT_WEIGHT]; font/family (STRING)->[FONT_FAMILY]; font/style (STRING)->[FONT_STYLE].
- **Detect:** Combine Variable.name role with Variable.resolvedType and assert Variable.scopes matches the mapped typography scope.
- **Fix:** Set the single correct typography scope for the token; a font/family STRING gets FONT_FAMILY, a font/weight FLOAT gets FONT_WEIGHT.

### `no-text-content-scope-on-token` — ERROR
- **Checks:** No primitive, semantic, or component design token may include TEXT_CONTENT in scopes (that scope is for content strings only).
- **Detect:** Variable.scopes; error if any design-token variable contains 'TEXT_CONTENT'.
- **Fix:** Remove TEXT_CONTENT and use the correct font/family/style scope; reserve TEXT_CONTENT for content-string variables outside the token system.

### `binding-on-scope-for-property` — ERROR
- **Checks:** Every boundVariables entry (incl. paints[].boundVariables) must resolve to a variable whose scopes permit that property given node.type: fill-on-frame->FRAME_FILL, fill-on-text->TEXT_FILL, fill-on-shape->SHAPE_FILL, stroke->STROKE_COLOR, cornerRadius->CORNER_RADIUS, itemSpacing/padding->GAP, strokeWeight->STROKE_FLOAT, width/height->WIDTH_HEIGHT, fontSize->FONT_SIZE.
- **Detect:** Run after loadAllPagesAsync for whole-file coverage. Enumerate both node.boundVariables keys and paints[].boundVariables.color; map (node.type, propertyKey)→required scope and assert presence.
- **Fix:** Bind the property to a variable that carries the matching scope, or widen the token's scopes to legitimately include this usage.

## theming

### `primitive-component-single-mode` — ERROR
- **Checks:** Primitive-layer and Component-layer collections must have exactly one mode; theme modes (Light/Dark/etc.) may exist only on the Semantic collection - one switching axis per collection.
- **Detect:** getLocalVariableCollectionsAsync(); assert Primitives.modes.length===1 and Component.modes.length===1; theme modes are permitted only on the Semantic collection.
- **Fix:** Remove extra modes from the primitive/component collections; express theming as modes on the semantic collection only.

### `every-mode-populated` — ERROR
- **Checks:** For each variable, valuesByMode must cover all of its collection's modes - no mode-shaped hole.
- **Detect:** Keep the keys-vs-modes comparison, but note it primarily guards against a corrupted/partial import; expect it to pass on any file authored in-app.
- **Fix:** Define a value (or alias) for the missing mode so theme switching never falls back to an undefined slot.

### `mode-count-ceiling` — WARN
- **Checks:** No collection may exceed maxModesPerCollection (e.g. Starter 1 / Professional 4 / Enterprise 40). Plan tier is NOT Plugin-API-detectable - the ceiling comes from linter config; only the mode count itself is detectable.
- **Detect:** VariableCollection.modes.length compared against a linter-config ceiling (config, not file). Warn if exceeded.
- **Fix:** Collapse redundant modes or split axes; confirm the ceiling matches the file's actual Figma plan.

### `semantic-default-mode-is-base` — WARN
- **Checks:** A theme collection's defaultModeId must resolve to the base mode (e.g. 'Light'), the fallback un-moded frames inherit.
- **Detect:** VariableCollection.defaultModeId; find its name in .modes and warn if it is not the base-named mode ('Light').
- **Fix:** Set defaultModeId to the Light/base mode so new frames inherit the intended default theme.

### `consistent-mode-names-across-axis` — WARN
- **Checks:** All collections in the same theme axis must use identical mode names (exactly 'Light'/'Dark'); mismatched, duplicate, or empty mode names within a collection are flagged.
- **Detect:** Collect VariableCollection.modes[].name across collections sharing an axis; warn on name mismatches, empty names, or duplicates.
- **Fix:** Rename modes to a single canonical vocabulary (Light/Dark) shared by every collection on the axis.

### `one-theme-axis-per-collection` — INFO
- **Checks:** Flag a collection whose mode names encode two axes (e.g. 'Acme / Dark', 'Brand A-Light'). Heuristic/name-based only.
- **Detect:** Parse VariableCollection.modes[].name for a separator plus a brand-ish token and a theme-ish token; info-flag suspected two-axis encodings (not a hard structural signal).
- **Fix:** Split the two concerns into separate collections (one brand axis, one theme axis) so each collection switches on a single dimension.

### `multi-brand-alias-discipline` — WARN
- **Checks:** Brand-collection tokens must alias primitives, and semantic accent/action tokens must alias brand/* tokens; a semantic token aliasing a brand-specific primitive directly (skipping the Brand layer) is flagged.
- **Detect:** Resolve each alias target's collection via getVariableByIdAsync(...).variableCollectionId; warn when a semantic accent token's target is a primitive rather than a brand-layer variable.
- **Fix:** Route accent/action semantics through a brand/* token so re-branding is a single-layer swap.

## tokens

### `three-tier-collections-exist` — ERROR
- **Checks:** A Primitives, a Semantic, and (optionally) a Component collection must exist and be identifiable; every local variable belongs to exactly one tier.
- **Detect:** figma.variables.getLocalVariableCollectionsAsync() -> classify each collection by name/convention into Primitive|Semantic|Component; getLocalVariablesAsync() then group by variableCollectionId and assert each variable maps to exactly one classified tier. Error if <2 tiers resolvable or any variable's collection is unclassifiable.
- **Fix:** Create the missing collection(s) via write_variables and move stray variables into the correct tier; ensure collection names follow the Primitives/Semantic/Component convention the classifier keys on.

### `no-node-binds-primitive` — ERROR
- **Checks:** No node property or paint binds a variable whose collection is the Primitives tier - nodes bind Semantic/Component only.
- **Detect:** Prepend `await figma.loadAllPagesAsync()` (manifest is documentAccess:dynamic-page) before findAllWithCriteria, otherwise only the current page is scanned. Then read node.boundVariables (all keys) + each paint's boundVariables.color, resolve each alias id via getVariableByIdAsync, map variableCollectionId→tier, error if Primitive.
- **Fix:** Introduce a semantic token that aliases the primitive, then rebind the node to the semantic (or component) token instead of the raw primitive.

### `alias-one-tier-down` — ERROR
- **Checks:** Component->Semantic and Semantic->Primitive only. Flag skip-tier (Component->Primitive), sideways/self (same collection), and upward (Semantic->Component) aliases.
- **Detect:** For each variable, for each mode in valuesByMode: if value.type==='VARIABLE_ALIAS', getVariableByIdAsync(value.id).variableCollectionId -> targetTier; assert targetTier === sourceTier - 1. Same-collection target = sideways/self; higher tier = upward; two-down = skip-tier.
- **Fix:** Re-point the alias to the adjacent lower tier; if a component needs a primitive value, first create the intervening semantic token and alias through it.

### `primitive-raw-values-only` — ERROR
- **Checks:** No valuesByMode entry of a primitive-tier variable may be a VARIABLE_ALIAS (TOK-01).
- **Detect:** getLocalVariablesAsync() filtered to the Primitives collection id; for each, assert every valuesByMode entry .type !== 'VARIABLE_ALIAS' (must be {r,g,b,a} | number | string literal).
- **Fix:** Replace the alias with a literal value in the primitive, or move the token to the semantic tier where aliasing is correct.

### `semantic-alias-in-every-mode` — ERROR
- **Checks:** Every valuesByMode entry of a semantic-collection variable must be a VARIABLE_ALIAS - a raw hex/number/string literal in any semantic mode is the raw-per-mode anti-pattern (TOK-02).
- **Detect:** getLocalVariablesAsync() filtered to the Semantic collection id; for each variable assert Object.values(valuesByMode).every(v => v.type === 'VARIABLE_ALIAS').
- **Fix:** Replace the literal with an alias to the primitive that encodes that value in that mode, so theme switching flows through the alias.

### `component-token-must-alias-semantic` — ERROR
- **Checks:** Every component-collection variable must be a VARIABLE_ALIAS resolving into the Semantic collection - not a raw per-mode literal (duplicated theme logic) and not a direct primitive alias (TOK-03).
- **Detect:** For each variable in the Component collection: assert every valuesByMode entry .type==='VARIABLE_ALIAS' AND getVariableByIdAsync(entry.id).variableCollectionId === Semantic collection id.
- **Fix:** Alias the component token to the matching semantic token; if the needed semantic token is missing, create it first, then alias.

### `alias-target-resolves` — ERROR
- **Checks:** Every VARIABLE_ALIAS id must resolve to an existing variable (ORPH-01).
- **Detect:** For each valuesByMode VARIABLE_ALIAS, await figma.variables.getVariableByIdAsync(value.id); error if it returns null/undefined (deleted or cross-file-unresolvable target).
- **Fix:** Re-point the alias to a live variable or recreate the deleted target; never leave a broken alias id.

### `alias-graph-acyclic-max-depth-2` — ERROR
- **Checks:** Following aliases from any variable must terminate at a raw primitive value within <=2 hops (Component->Semantic->raw) and must contain no cycles.
- **Detect:** When following an alias into the target variable, evaluate the target's value in the target collection's own mode (single-mode primitive → its defaultModeId), not the source modeId, so cross-collection chains resolve correctly.
- **Fix:** Flatten the extra indirection so the chain is at most Component->Semantic->Primitive; break any cycle by re-pointing one alias to a literal-backed primitive.

### `primitive-hidden-from-publishing` — ERROR
- **Checks:** Every Primitive variable hiddenFromPublishing===true; every Semantic and Component variable hiddenFromPublishing===false.
- **Detect:** getLocalVariablesAsync() grouped by variableCollectionId; assert Variable.hiddenFromPublishing === true for Primitives and === false for Semantic/Component.
- **Fix:** Set hiddenFromPublishing true on primitives (implementation detail) and false on semantic/component tokens (the published API surface) via write_variables.

### `single-use-component-passthrough` — WARN
- **Checks:** A component token whose alias merely equals its semantic and that is referenced by <=1 node is likely over-engineering; component tokens should be reused >=2x in their subtree.
- **Detect:** Call loadAllPagesAsync (or scope to the component's own subtree via node.findAllWithCriteria) before counting references; without it a whole-file reference count misses off-page usage and over-warns.
- **Fix:** Inline the semantic token directly at the node and delete the pass-through component token, or justify it by reusing it across the subtree.

### `duplicate-primitive-value` — WARN
- **Checks:** Two primitives holding an identical resolved value in the same mode should be consolidated (ORPH-03).
- **Detect:** Within the Primitives collection, compare valuesByMode literals per mode across variables (normalize {r,g,b,a} / numbers / strings); warn on exact matches.
- **Fix:** Delete the duplicate and re-point its consumers to the surviving primitive.

### `unused-variable-orphan` — INFO
- **Checks:** A variable absent from every node binding AND from every alias target set is unused locally (ORPH-02). Advisory only - cross-file usage is not locally detectable; never auto-delete.
- **Detect:** Prepend loadAllPagesAsync so the node-binding half of the usage set covers every page; otherwise on-page-only scanning falsely flags tokens used on other pages.
- **Fix:** Confirm the token is not consumed by another library file before removing; if truly dead, delete it.

