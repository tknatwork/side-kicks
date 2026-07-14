// Scope-discipline detectors: every variable's scopes must be legal for its
// resolvedType, non-redundant, and (for semantic/component tokens) match the
// role its name declares. The scope IS the code-gen property hint, so a wrong
// scope makes the generator emit the wrong CSS property. Reuses shared tier
// classification. Role-matching is conservative — only clear roles fire.

import type { Detector } from "../runner.js";
import { analyze, roleSegment, type PartialFinding } from "./shared.js";

const LEGAL_SCOPES: Record<string, Set<string>> = {
  COLOR: new Set([
    "ALL_SCOPES", "ALL_FILLS", "FRAME_FILL", "SHAPE_FILL", "TEXT_FILL",
    "STROKE_COLOR", "EFFECT_COLOR",
  ]),
  FLOAT: new Set([
    "ALL_SCOPES", "CORNER_RADIUS", "WIDTH_HEIGHT", "GAP", "STROKE_FLOAT",
    "EFFECT_FLOAT", "OPACITY", "FONT_WEIGHT", "FONT_SIZE", "LINE_HEIGHT",
    "LETTER_SPACING", "PARAGRAPH_SPACING", "PARAGRAPH_INDENT",
  ]),
  STRING: new Set(["ALL_SCOPES", "TEXT_CONTENT", "FONT_FAMILY", "FONT_STYLE"]),
  BOOLEAN: new Set(["ALL_SCOPES"]),
};

// Clear color roles -> acceptable scope(s). Ambiguous roles (brand/accent/...)
// are intentionally omitted so we never false-positive.
const COLOR_ROLES: Array<{ re: RegExp; scopes: string[]; label: string }> = [
  { re: /^(bg|background|surface|fill|elevation)$/, scopes: ["FRAME_FILL", "SHAPE_FILL", "ALL_FILLS"], label: "a fill scope (FRAME_FILL/SHAPE_FILL)" },
  { re: /^(fg|foreground|text|content|ink|icon|label)$/, scopes: ["TEXT_FILL"], label: "TEXT_FILL" },
  { re: /^(border|stroke|outline|divider|separator|ring)$/, scopes: ["STROKE_COLOR"], label: "STROKE_COLOR" },
];

const DIM_ROLES: Array<{ re: RegExp; scopes: string[]; label: string }> = [
  { re: /^(radius|corner|rounding)$/, scopes: ["CORNER_RADIUS"], label: "CORNER_RADIUS" },
  { re: /^(space|spacing|gap|padding|margin|inset)$/, scopes: ["GAP"], label: "GAP" },
  { re: /^(size|width|height|sizing|dimension)$/, scopes: ["WIDTH_HEIGHT"], label: "WIDTH_HEIGHT" },
  { re: /^(opacity|alpha)$/, scopes: ["OPACITY"], label: "OPACITY" },
];

// Typography roles matched against the full name (naming varies: font/size,
// typography/font-size, text-size, ...).
const TYPE_ROLES: Array<{ re: RegExp; scopes: string[]; type: string; label: string }> = [
  { re: /font-?famil|typeface/, scopes: ["FONT_FAMILY"], type: "STRING", label: "FONT_FAMILY" },
  { re: /font-?style/, scopes: ["FONT_STYLE"], type: "STRING", label: "FONT_STYLE" },
  { re: /font-?weight|(^|\/)weight(\/|$)/, scopes: ["FONT_WEIGHT"], type: "FLOAT", label: "FONT_WEIGHT" },
  { re: /font-?size|(^|\/)fontsize/, scopes: ["FONT_SIZE"], type: "FLOAT", label: "FONT_SIZE" },
  { re: /line-?height|leading/, scopes: ["LINE_HEIGHT"], type: "FLOAT", label: "LINE_HEIGHT" },
  { re: /letter-?spacing|tracking/, scopes: ["LETTER_SPACING"], type: "FLOAT", label: "LETTER_SPACING" },
];

const isTyped = (tier: string): boolean => tier === "semantic" || tier === "component";
const has = (scopes: string[], any: string[]): boolean => any.some((s) => scopes.includes(s));

const noAllScopesOnTypedToken: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    if (isTyped(v.tier) && v.scopes.includes("ALL_SCOPES")) {
      out.push({
        rule_id: "no-all-scopes-on-typed-token",
        variableId: v.id,
        message: `${v.tier} token '${v.name}' uses ALL_SCOPES; scope it to its real property so code-gen emits the right CSS (ALL_SCOPES on a bound token pollutes the binding menu and blurs intent).`,
      });
    }
  }
  return out;
};

const scopeLegalForResolvedType: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    const legal = LEGAL_SCOPES[v.resolvedType];
    if (!legal) continue;
    const illegal = v.scopes.filter((s) => !legal.has(s));
    if (illegal.length > 0) {
      out.push({
        rule_id: "scope-legal-for-resolved-type",
        variableId: v.id,
        message: `${v.resolvedType} variable '${v.name}' has scope(s) illegal for its type: ${illegal.join(", ")}.`,
      });
    }
  }
  return out;
};

const nonRedundantScopeSet: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    if (v.scopes.includes("ALL_SCOPES") && v.scopes.length > 1) {
      out.push({
        rule_id: "non-redundant-scope-set",
        variableId: v.id,
        message: `'${v.name}' lists ALL_SCOPES alongside specific scopes (${v.scopes.filter((s) => s !== "ALL_SCOPES").join(", ")}); ALL_SCOPES already includes everything — drop it or drop the rest.`,
      });
    }
  }
  return out;
};

// Generic role-match: only fires when the role is clearly recognized AND the
// token has specific scopes that include NONE of the acceptable ones (so pure
// ALL_SCOPES cases are left to no-all-scopes-on-typed-token).
function roleMatch(
  snap: Parameters<Detector>[0],
  ruleId: string,
  wantType: string | null,
  roles: Array<{ re: RegExp; scopes: string[]; label: string }>,
  matchAgainst: "segment" | "name"
): PartialFinding[] {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    if (!isTyped(v.tier)) continue;
    if (wantType && v.resolvedType !== wantType) continue;
    const specific = v.scopes.filter((s) => s !== "ALL_SCOPES");
    if (specific.length === 0) continue; // ALL_SCOPES-only handled elsewhere
    const key = matchAgainst === "segment" ? roleSegment(v.name) : v.name.toLowerCase();
    const role = roles.find((r) => r.re.test(key));
    if (!role) continue;
    if (!has(v.scopes, role.scopes)) {
      out.push({
        rule_id: ruleId,
        variableId: v.id,
        message: `'${v.name}' reads as a ${role.label.replace(/^a /, "")} token but is scoped ${specific.join(", ")} — expected ${role.label}.`,
      });
    }
  }
  return out;
}

const colorRoleScopeMatch: Detector = (snap) =>
  roleMatch(snap, "color-role-scope-match", "COLOR", COLOR_ROLES, "segment");

const dimensionRoleScopeMatch: Detector = (snap) =>
  roleMatch(snap, "dimension-role-scope-match", "FLOAT", DIM_ROLES, "segment");

const typeRoleScopeMatch: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    if (!isTyped(v.tier)) continue;
    const specific = v.scopes.filter((s) => s !== "ALL_SCOPES");
    if (specific.length === 0) continue;
    const name = v.name.toLowerCase();
    const role = TYPE_ROLES.find((r) => r.re.test(name) && r.type === v.resolvedType);
    if (!role) continue;
    if (!has(v.scopes, role.scopes)) {
      out.push({
        rule_id: "type-role-scope-match",
        variableId: v.id,
        message: `Typography token '${v.name}' should be scoped ${role.label} but is scoped ${specific.join(", ")}.`,
      });
    }
  }
  return out;
};

const noTextContentScopeOnToken: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    if (!v.scopes.includes("TEXT_CONTENT")) continue;
    // A pure content STRING ([TEXT_CONTENT] only) is legitimate; flag anything else.
    const pureContentString =
      v.resolvedType === "STRING" &&
      v.scopes.length === 1 &&
      v.scopes[0] === "TEXT_CONTENT";
    if (!pureContentString) {
      out.push({
        rule_id: "no-text-content-scope-on-token",
        variableId: v.id,
        message: `'${v.name}' carries the TEXT_CONTENT scope; that's for content variables, not design tokens — remove it.`,
      });
    }
  }
  return out;
};

export const scopeDetectors: Record<string, Detector> = {
  "no-all-scopes-on-typed-token": noAllScopesOnTypedToken,
  "scope-legal-for-resolved-type": scopeLegalForResolvedType,
  "non-redundant-scope-set": nonRedundantScopeSet,
  "color-role-scope-match": colorRoleScopeMatch,
  "dimension-role-scope-match": dimensionRoleScopeMatch,
  "type-role-scope-match": typeRoleScopeMatch,
  "no-text-content-scope-on-token": noTextContentScopeOnToken,
};
