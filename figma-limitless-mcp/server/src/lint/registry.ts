// AUTO-GENERATED from the verified 57-rule catalog (design-system skills workflow).
// Rule METADATA only — detector implementations live in ./detectors/* (added tier-by-tier).

export type RuleSeverity = "error" | "warn" | "info";

export interface RuleMeta {
  id: string;
  title: string;
  category: string;
  severity: RuleSeverity;
  skillUri: string;
  fixHint: string;
  /**
   * Whether the rule runs by default. Omitted => true. Set false for opinionated
   * or config-required rules (house-style vocabularies, allowlists) that would
   * be noise default-on — they run only when explicitly enabled (opts.enable /
   * opts.only). Keeps the default lint advisory-but-precise (advise, don't
   * dictate) while letting a team opt in to house-style enforcement.
   */
  defaultOn?: boolean;
}

export const RULES: RuleMeta[] = [
  {
    id: "three-tier-collections-exist",
    title: "Three distinguishable token tiers must exist",
    category: "tokens",
    severity: "error",
    skillUri: "skill://design-system/token-architecture",
    fixHint: "Create the missing collection(s) via write_variables and move stray variables into the correct tier; ensure collection names follow the Primitives/Semantic/Component convention the classifier keys on.",
  },
  {
    id: "no-node-binds-primitive",
    title: "Nodes must not bind primitive-tier variables (missing semantic layer)",
    category: "tokens",
    severity: "error",
    skillUri: "skill://design-system/token-architecture",
    fixHint: "Introduce a semantic token that aliases the primitive, then rebind the node to the semantic (or component) token instead of the raw primitive.",
  },
  {
    id: "alias-one-tier-down",
    title: "Aliases must point exactly one tier down",
    category: "tokens",
    severity: "error",
    skillUri: "skill://design-system/token-architecture",
    fixHint: "Re-point the alias to the adjacent lower tier; if a component needs a primitive value, first create the intervening semantic token and alias through it.",
  },
  {
    id: "primitive-raw-values-only",
    title: "Primitive variables must hold raw values, never aliases",
    category: "tokens",
    severity: "error",
    skillUri: "skill://design-system/token-architecture",
    fixHint: "Replace the alias with a literal value in the primitive, or move the token to the semantic tier where aliasing is correct.",
  },
  {
    id: "semantic-alias-in-every-mode",
    title: "Semantic tokens must be aliases in every mode",
    category: "tokens",
    severity: "error",
    skillUri: "skill://design-system/token-architecture",
    fixHint: "Replace the literal with an alias to the primitive that encodes that value in that mode, so theme switching flows through the alias.",
  },
  {
    id: "component-token-must-alias-semantic",
    title: "Component tokens must alias semantic (never raw, never skip)",
    category: "tokens",
    severity: "error",
    skillUri: "skill://design-system/token-architecture",
    fixHint: "Alias the component token to the matching semantic token; if the needed semantic token is missing, create it first, then alias.",
  },
  {
    id: "alias-target-resolves",
    title: "Alias targets must resolve (no dangling aliases)",
    category: "tokens",
    severity: "error",
    skillUri: "skill://design-system/token-architecture",
    fixHint: "Re-point the alias to a live variable or recreate the deleted target; never leave a broken alias id.",
  },
  {
    id: "alias-graph-acyclic-max-depth-2",
    title: "Alias chain must be acyclic and resolve in <=2 hops",
    category: "tokens",
    severity: "error",
    skillUri: "skill://design-system/token-architecture",
    fixHint: "Flatten the extra indirection so the chain is at most Component->Semantic->Primitive; break any cycle by re-pointing one alias to a literal-backed primitive.",
  },
  {
    id: "primitive-hidden-from-publishing",
    title: "Publishing visibility must match tier",
    category: "tokens",
    severity: "error",
    skillUri: "skill://design-system/token-architecture",
    fixHint: "Set hiddenFromPublishing true on primitives (implementation detail) and false on semantic/component tokens (the published API surface) via write_variables.",
  },
  {
    id: "single-use-component-passthrough",
    title: "Flag single-use component pass-through tokens",
    category: "tokens",
    severity: "warn",
    skillUri: "skill://design-system/token-architecture",
    fixHint: "Inline the semantic token directly at the node and delete the pass-through component token, or justify it by reusing it across the subtree.",
  },
  {
    id: "duplicate-primitive-value",
    title: "No two primitives share the same resolved value",
    category: "tokens",
    severity: "warn",
    skillUri: "skill://design-system/token-architecture",
    fixHint: "Delete the duplicate and re-point its consumers to the surviving primitive.",
  },
  {
    id: "unused-variable-orphan",
    title: "Flag variables with no local usage (advisory)",
    category: "tokens",
    severity: "info",
    skillUri: "skill://design-system/token-architecture",
    fixHint: "Confirm the token is not consumed by another library file before removing; if truly dead, delete it.",
  },
  {
    id: "no-all-scopes-on-typed-token",
    title: "Typed semantic/component tokens must not use ALL_SCOPES",
    category: "scopes",
    severity: "error",
    skillUri: "skill://design-system/variable-scopes-binding-tokens",
    fixHint: "Replace ALL_SCOPES with the specific scope family for the token's role (e.g. bg -> FRAME_FILL, radius -> CORNER_RADIUS).",
  },
  {
    id: "scope-legal-for-resolved-type",
    title: "Every scope must be legal for the variable's resolvedType",
    category: "scopes",
    severity: "error",
    skillUri: "skill://design-system/variable-scopes-binding-tokens",
    fixHint: "Remove scopes that don't apply to the variable's resolvedType and add the correct one; a COLOR token cannot carry CORNER_RADIUS, etc.",
  },
  {
    id: "non-redundant-scope-set",
    title: "Scope sets must be non-redundant",
    category: "scopes",
    severity: "warn",
    skillUri: "skill://design-system/variable-scopes-binding-tokens",
    fixHint: "Collapse to the narrowest correct set - either the umbrella scope alone or the specific scopes, not both.",
  },
  {
    id: "color-role-scope-match",
    title: "Color token name-role must map to the right scope family",
    category: "scopes",
    severity: "error",
    skillUri: "skill://design-system/variable-scopes-binding-tokens",
    fixHint: "Set scopes to the family the name implies (a fg/* token gets TEXT_FILL, a border/* token gets STROKE_COLOR).",
  },
  {
    id: "dimension-role-scope-match",
    title: "Dimension token name-role must map to the right numeric scope",
    category: "scopes",
    severity: "error",
    skillUri: "skill://design-system/variable-scopes-binding-tokens",
    fixHint: "Align scopes to the dimension role the name encodes; a space/* token binds GAP, not WIDTH_HEIGHT.",
  },
  {
    id: "type-role-scope-match",
    title: "Typography token name+type must map to the right scope",
    category: "scopes",
    severity: "error",
    skillUri: "skill://design-system/variable-scopes-binding-tokens",
    fixHint: "Set the single correct typography scope for the token; a font/family STRING gets FONT_FAMILY, a font/weight FLOAT gets FONT_WEIGHT.",
  },
  {
    id: "no-text-content-scope-on-token",
    title: "TEXT_CONTENT must never scope a design token",
    category: "scopes",
    severity: "error",
    skillUri: "skill://design-system/variable-scopes-binding-tokens",
    fixHint: "Remove TEXT_CONTENT and use the correct font/family/style scope; reserve TEXT_CONTENT for content-string variables outside the token system.",
  },
  {
    id: "binding-on-scope-for-property",
    title: "Live bindings must be on-scope for the property and node type",
    category: "scopes",
    severity: "error",
    skillUri: "skill://design-system/variable-scopes-binding-tokens",
    fixHint: "Bind the property to a variable that carries the matching scope, or widen the token's scopes to legitimately include this usage.",
  },
  {
    id: "no-raw-value-on-component-node",
    title: "No hardcoded values on component/variant layers",
    category: "code-output",
    severity: "error",
    skillUri: "skill://design-system/design-to-code-correctness",
    fixHint: "Bind each raw paint/scalar to the appropriate semantic/component token (or apply a paint/effect style); build the token first if it doesn't exist.",
  },
  {
    id: "text-layer-uses-style-or-bound-type",
    title: "Component TEXT layers must use a text style or bound type tokens",
    category: "code-output",
    severity: "error",
    skillUri: "skill://design-system/design-to-code-correctness",
    fixHint: "Apply a text style via apply_text_style, or bind fontSize/lineHeight to type tokens.",
  },
  {
    id: "published-variable-has-codesyntax-web",
    title: "Published variables must carry codeSyntax.WEB",
    category: "code-output",
    severity: "error",
    skillUri: "skill://design-system/design-to-code-correctness",
    fixHint: "Set codeSyntax.WEB (e.g. var(--<name>)) via write_variables for every published token so codegen emits a stable custom property.",
  },
  {
    id: "codesyntax-web-unique",
    title: "codeSyntax.WEB must be unique across all tokens",
    category: "code-output",
    severity: "error",
    skillUri: "skill://design-system/design-to-code-correctness",
    fixHint: "Rename one token (and regenerate its codeSyntax.WEB) so every emitted identifier is unique.",
  },
  {
    id: "codesyntax-web-matches-name",
    title: "codeSyntax.WEB must be derivable from the variable name",
    category: "code-output",
    severity: "warn",
    defaultOn: false, // code names legitimately differ from design names — opt-in
    skillUri: "skill://design-system/design-to-code-correctness",
    fixHint: "Regenerate codeSyntax.WEB from the canonical name so design and code stay in lockstep.",
  },
  {
    id: "published-variable-has-description",
    title: "Published variables should have a description",
    category: "code-output",
    severity: "info",
    skillUri: "skill://design-system/design-to-code-correctness",
    fixHint: "Add a short description explaining the token's role via write_variables.",
  },
  {
    id: "component-set-has-code-mapping",
    title: "Component sets should have a Code Connect mapping matching their props",
    category: "code-output",
    severity: "warn",
    skillUri: "skill://design-system/design-to-code-correctness",
    fixHint: "Create/update the Code Connect mapping via set_code_mapping so its props match componentPropertyDefinitions exactly.",
  },
  {
    id: "primitive-component-single-mode",
    title: "Primitive and Component collections must be single-mode",
    category: "theming",
    severity: "error",
    skillUri: "skill://design-system/theming-with-modes",
    fixHint: "Remove extra modes from the primitive/component collections; express theming as modes on the semantic collection only.",
  },
  {
    id: "every-mode-populated",
    title: "Every variable must resolve a value in every mode",
    category: "theming",
    severity: "error",
    skillUri: "skill://design-system/theming-with-modes",
    fixHint: "Define a value (or alias) for the missing mode so theme switching never falls back to an undefined slot.",
  },
  {
    id: "mode-count-ceiling",
    title: "Collection mode count must not exceed the configured ceiling",
    category: "theming",
    severity: "warn",
    skillUri: "skill://design-system/theming-with-modes",
    fixHint: "Collapse redundant modes or split axes; confirm the ceiling matches the file's actual Figma plan.",
  },
  {
    id: "semantic-default-mode-is-base",
    title: "Theme collection's default mode must be the base mode",
    category: "theming",
    severity: "warn",
    skillUri: "skill://design-system/theming-with-modes",
    fixHint: "Set defaultModeId to the Light/base mode so new frames inherit the intended default theme.",
  },
  {
    id: "consistent-mode-names-across-axis",
    title: "Mode names must be consistent across a theme axis",
    category: "theming",
    severity: "warn",
    skillUri: "skill://design-system/theming-with-modes",
    fixHint: "Rename modes to a single canonical vocabulary (Light/Dark) shared by every collection on the axis.",
  },
  {
    id: "one-theme-axis-per-collection",
    title: "A collection's modes must encode a single axis",
    category: "theming",
    severity: "info",
    skillUri: "skill://design-system/theming-with-modes",
    fixHint: "Split the two concerns into separate collections (one brand axis, one theme axis) so each collection switches on a single dimension.",
  },
  {
    id: "multi-brand-alias-discipline",
    title: "Multi-brand tokens must alias through the brand layer",
    category: "theming",
    severity: "warn",
    skillUri: "skill://design-system/theming-with-modes",
    fixHint: "Route accent/action semantics through a brand/* token so re-branding is a single-layer swap.",
  },
  {
    id: "name-kebab-segments",
    title: "Every name segment must be lowercase kebab-case",
    category: "naming",
    severity: "error",
    skillUri: "skill://design-system/accessibility-naming-conventions",
    fixHint: "Rename to lowercase kebab segments (e.g. bg/surface-raised), then regenerate codeSyntax.WEB.",
  },
  {
    id: "name-slash-structure-depth",
    title: "Names must be 2-4 slash segments in category/role/item shape",
    category: "naming",
    severity: "warn",
    skillUri: "skill://design-system/accessibility-naming-conventions",
    fixHint: "Restructure the name into the standard depth (e.g. color/brand/500, bg/surface/raised).",
  },
  {
    id: "top-segment-in-tier-vocabulary",
    title: "Top name segment must belong to the tier vocabulary",
    category: "naming",
    severity: "error",
    defaultOn: false, // needs a team-supplied per-tier vocabulary — opt-in
    skillUri: "skill://design-system/accessibility-naming-conventions",
    fixHint: "Rename so the leading segment matches the tier's controlled vocabulary, or move the token to the tier its name implies.",
  },
  {
    id: "numeric-scale-zero-padded",
    title: "Numeric scale steps must be zero-padded to 3 digits",
    category: "naming",
    severity: "warn",
    defaultOn: false, // zero-padding is a house style, not a universal rule — opt-in
    skillUri: "skill://design-system/accessibility-naming-conventions",
    fixHint: "Zero-pad scale steps to three digits for stable sort order and codegen.",
  },
  {
    id: "hue-ramp-words-primitives-only",
    title: "Raw hue/ramp words allowed only in primitives",
    category: "naming",
    severity: "warn",
    skillUri: "skill://design-system/accessibility-naming-conventions",
    fixHint: "Use role-based names (bg/*, fg/*) in semantic tiers; keep hue words in primitives only.",
  },
  {
    id: "semantic-role-allowlist",
    title: "Semantic color names must use the closed role allowlist",
    category: "naming",
    severity: "warn",
    defaultOn: false, // the role vocabulary is a team's own choice — opt-in
    skillUri: "skill://design-system/accessibility-naming-conventions",
    fixHint: "Rename to an approved role/intent, or extend the allowlist deliberately rather than ad hoc.",
  },
  {
    id: "surface-on-pair-completeness",
    title: "Every surface must have a matching on-* content token",
    category: "naming",
    severity: "warn",
    skillUri: "skill://design-system/accessibility-naming-conventions",
    fixHint: "Create the missing paired token so every surface has a legible foreground and every on-* has its surface.",
  },
  {
    id: "no-dead-component-property",
    title: "Every component property must be referenced by a descendant",
    category: "components",
    severity: "warn",
    skillUri: "skill://design-system/component-variant-structure-for-codegen",
    fixHint: "Wire the property to a layer via componentPropertyReferences, or delete the unused property.",
  },
  {
    id: "boolean-vocab-variant-should-be-boolean",
    title: "Boolean-vocabulary variant axes must be BOOLEAN properties",
    category: "components",
    severity: "error",
    skillUri: "skill://design-system/component-variant-structure-for-codegen",
    fixHint: "Convert the axis to a BOOLEAN property bound to layer visibility instead of a two-value variant.",
  },
  {
    id: "variant-matrix-complete",
    title: "Variant matrix must be complete",
    category: "components",
    severity: "error",
    skillUri: "skill://design-system/component-variant-structure-for-codegen",
    fixHint: "Add the missing variant combinations, or reduce an axis to BOOLEAN/INSTANCE_SWAP so the matrix is fully enumerated.",
  },
  {
    id: "variant-count-ceiling-60",
    title: "Variant count must not exceed 60",
    category: "components",
    severity: "warn",
    skillUri: "skill://design-system/component-variant-structure-for-codegen",
    fixHint: "Collapse a combinatorial axis into a BOOLEAN, INSTANCE_SWAP, or SLOT to shrink the matrix.",
  },
  {
    id: "no-asset-enumeration-variant",
    title: "Assets must not be enumerated as variant options",
    category: "components",
    severity: "warn",
    skillUri: "skill://design-system/component-variant-structure-for-codegen",
    fixHint: "Replace the asset variant axis with an INSTANCE_SWAP property whose preferredValues list the assets.",
  },
  {
    id: "property-name-convention-unique",
    title: "Property base names must be conventional and unique",
    category: "components",
    severity: "error",
    skillUri: "skill://design-system/component-variant-structure-for-codegen",
    fixHint: "Rename properties to a single camelCase base name and reuse one canonical name for the same axis across the file.",
  },
  {
    id: "shared-property-value-consistency",
    title: "Shared property values must be consistent file-wide",
    category: "components",
    severity: "warn",
    defaultOn: false, // a shared prop name isn't always the same axis — opt-in
    skillUri: "skill://design-system/component-variant-structure-for-codegen",
    fixHint: "Normalize option values (e.g. 'sm/md/lg' everywhere) so the same axis reads identically across components.",
  },
  {
    id: "instance-swap-preferred-values",
    title: "INSTANCE_SWAP properties must declare preferredValues",
    category: "components",
    severity: "error",
    skillUri: "skill://design-system/component-variant-structure-for-codegen",
    fixHint: "Add preferredValues listing the allowed swap targets so codegen emits a bounded union.",
  },
  {
    id: "boolean-prop-no-sizing-intent",
    title: "BOOLEAN properties must not imply sizing/layout",
    category: "components",
    severity: "info",
    skillUri: "skill://design-system/component-variant-structure-for-codegen",
    fixHint: "Re-express sizing as a VARIANT/size axis or bound layout token; keep booleans for show/hide semantics.",
  },
  {
    id: "no-instance-restyle-override",
    title: "Instances must not carry restyle overrides",
    category: "components",
    severity: "warn",
    skillUri: "skill://design-system/component-variant-structure-for-codegen",
    fixHint: "Move the desired styling into the source component (new variant/token) and reset the instance override.",
  },
  {
    id: "detached-component-frame-signal",
    title: "Flag frames that duplicate a component's structure",
    category: "components",
    severity: "info",
    skillUri: "skill://design-system/component-variant-structure-for-codegen",
    fixHint: "Replace the duplicated frame with an instance of the component, or confirm it is intentionally bespoke.",
  },
  {
    id: "default-variant-is-base-tuple",
    title: "Default variant must be the neutral base tuple",
    category: "components",
    severity: "warn",
    skillUri: "skill://design-system/component-variant-structure-for-codegen",
    fixHint: "Reorder/assign the default variant so each axis sits at its documented base value.",
  },
  {
    id: "fg-bg-pair-contrast",
    title: "Paired fg/bg semantic tokens must meet WCAG contrast",
    category: "a11y",
    severity: "error",
    skillUri: "skill://design-system/accessibility-naming-conventions",
    fixHint: "Re-point the fg or bg alias to a primitive that clears the ratio in every mode; verify Light and Dark independently.",
  },
  {
    id: "border-icon-graphical-contrast",
    title: "Border/icon tokens must meet 3:1 graphical contrast",
    category: "a11y",
    severity: "warn",
    skillUri: "skill://design-system/accessibility-naming-conventions",
    fixHint: "Choose a darker/lighter primitive for the border/icon token so it clears 3:1 against its surface in all modes.",
  },
  {
    id: "min-font-size",
    title: "Font sizes must not fall below the minimum",
    category: "a11y",
    severity: "warn",
    skillUri: "skill://design-system/accessibility-naming-conventions",
    fixHint: "Raise the offending font-size token/style to at least the minimum (12px hard floor, 16px for body).",
  },
  {
    id: "contrast-fallback-export-sampling",
    title: "Non-opaque/effected paints require pixel-sampled contrast",
    category: "a11y",
    severity: "info",
    skillUri: "skill://design-system/accessibility-naming-conventions",
    fixHint: "Run the contrast check via exportAsync sampling for these nodes; do not trust the alias-resolved RGB when alpha/effects are present.",
  },
];

// Severity calibration. A design system's exact structure is a CHOICE, so the
// linter advises rather than dictates: only objectively-broken defects (a
// reference that resolves nowhere, a scope Figma rejects for the type) stay
// errors. Every opinionated structural rule becomes a warning — real guidance
// toward the canonical code-gen-optimal shape, but not a failure if a team's
// 3-tier system uses granular in-tier controls. Run lint_design_system with
// severity:'error' for "is anything actually broken?", severity:'all' for the
// full structural review.
const OBJECTIVE_ERRORS = new Set<string>([
  "alias-target-resolves", // dangling alias — a broken reference
  "scope-legal-for-resolved-type", // a scope Figma rejects for the resolvedType
]);
for (const r of RULES) {
  if (r.severity === "error" && !OBJECTIVE_ERRORS.has(r.id)) r.severity = "warn";
}

export const RULE_BY_ID: Map<string, RuleMeta> = new Map(RULES.map((r) => [r.id, r]));
export const CATEGORIES = [...new Set(RULES.map((r) => r.category))];
