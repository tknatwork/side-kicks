// Design->code contract detectors (variable-level). codeSyntax/description
// rules are CONDITIONAL: a team that hasn't adopted them at all isn't wrong —
// that's a choice — so we only flag INCONSISTENCY once the practice is
// partially adopted. Uniqueness is unconditional (a collision is a real code
// clash). All advisory. Node-level code-output rules (no-raw-value-on-
// component-node, text-layer-uses-style-or-bound-type, component-set-has-code-
// mapping) need richer node/mapping data and land later.

import type { Detector } from "../runner.js";
import type { PartialFinding } from "./shared.js";
import { analyze } from "./shared.js";

const webOf = (v: { codeSyntax: Record<string, string> }): string | undefined => {
  const w = v.codeSyntax["WEB"];
  return typeof w === "string" && w.length > 0 ? w : undefined;
};

const publishedVariableHasCodesyntaxWeb: Detector = (snap) => {
  const a = analyze(snap);
  const published = a.variables.filter((v) => v.hiddenFromPublishing === false);
  if (!published.some((v) => webOf(v) !== undefined)) return []; // not adopted
  const out: PartialFinding[] = [];
  for (const v of published) {
    if (webOf(v) === undefined) {
      out.push({
        rule_id: "published-variable-has-codesyntax-web",
        variableId: v.id,
        message: `Published token '${v.name}' has no WEB codeSyntax, but other tokens do; set it so code-gen emits a stable, predictable name.`,
      });
    }
  }
  return out;
};

const codesyntaxWebUnique: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  const seen = new Map<string, string>();
  for (const v of a.variables) {
    const web = webOf(v);
    if (web === undefined) continue;
    const first = seen.get(web);
    if (first) {
      out.push({
        rule_id: "codesyntax-web-unique",
        variableId: v.id,
        message: `'${v.name}' shares WEB codeSyntax '${web}' with '${first}'; duplicate code names collide in generated code.`,
      });
    } else {
      seen.set(web, v.name);
    }
  }
  return out;
};

const publishedVariableHasDescription: Detector = (snap) => {
  const a = analyze(snap);
  const published = a.variables.filter((v) => v.hiddenFromPublishing === false);
  if (!published.some((v) => v.description.trim().length > 0)) return []; // not adopted
  const out: PartialFinding[] = [];
  for (const v of published) {
    if (v.description.trim().length === 0) {
      out.push({
        rule_id: "published-variable-has-description",
        variableId: v.id,
        message: `Published token '${v.name}' has no description, but others do; document its intent for library consumers.`,
      });
    }
  }
  return out;
};

// Opt-in (defaultOn:false): code names legitimately differ from design names, so
// this only runs when a team asks for it. Fuzzy drift check — flags a WEB
// codeSyntax that shares fewer than `minSharedSegments` alphanumeric tokens with
// the variable name (a strong signal the codeSyntax was copy-pasted / left stale).
const segTokens = (s: string): Set<string> => {
  const set = new Set<string>();
  // Split camelCase/PascalCase too, else a faithfully-derived JS identifier like
  // 'buttonBackground' or 'theme.spacingMd' collapses to one blob and looks
  // "unrelated" to a slash-grouped name — a false positive on a mainstream
  // codeSyntax convention.
  const boundaried = s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // lower/digit -> Upper
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2"); // ACRONYMWord -> ACRONYM Word
  for (const t of boundaried.toLowerCase().split(/[^a-z0-9]+/)) if (t) set.add(t);
  return set;
};

interface WebMatchConfig {
  minSharedSegments: number;
}
const codesyntaxWebMatchesName: Detector = (snap, config) => {
  const min = (config as WebMatchConfig | undefined)?.minSharedSegments ?? 1;
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    const web = webOf(v);
    if (web === undefined) continue;
    const nameTokens = segTokens(v.name);
    const webTokens = segTokens(web);
    if (nameTokens.size === 0 || webTokens.size === 0) continue;
    let shared = 0;
    for (const t of webTokens) if (nameTokens.has(t)) shared++;
    if (shared < min) {
      out.push({
        rule_id: "codesyntax-web-matches-name",
        variableId: v.id,
        message: `'${v.name}' has WEB codeSyntax '${web}' sharing ${shared} name segment(s) (< ${min} required); likely stale or mis-set — codegen would emit a name unrelated to the token.`,
      });
    }
  }
  return out;
};

// Node-level rules driven by the component-walk enrichment. Both degrade to
// silent when the component wasn't fully walked (enriched !== true) so partial
// data never produces a false positive.
const noRawValueOnComponentNode: Detector = (snap) => {
  const out: PartialFinding[] = [];
  for (const c of snap.components ?? []) {
    if (c.enriched !== true || !c.hasRawPaintLayer) continue;
    out.push({
      rule_id: "no-raw-value-on-component-node",
      nodeId: c.id,
      message: `Component '${c.name}' has a hardcoded paint/scalar on layer '${c.rawPaintSample ?? "(a descendant)"}'; bind it to a semantic/component token or apply a style so code-gen emits a token, not a literal.`,
    });
  }
  return out;
};

const textLayerUsesStyleOrBoundType: Detector = (snap) => {
  const out: PartialFinding[] = [];
  for (const c of snap.components ?? []) {
    if (c.enriched !== true || !c.textLayersMissingType || c.textLayersMissingType <= 0) continue;
    out.push({
      rule_id: "text-layer-uses-style-or-bound-type",
      nodeId: c.id,
      message: `Component '${c.name}' has ${c.textLayersMissingType} TEXT layer(s) (e.g. '${c.textLayerSample ?? "?"}') with no text style and no bound type tokens; apply a text style or bind fontSize/lineHeight so type is tokenized.`,
    });
  }
  return out;
};

export const codegenDetectors: Record<string, Detector> = {
  "published-variable-has-codesyntax-web": publishedVariableHasCodesyntaxWeb,
  "codesyntax-web-unique": codesyntaxWebUnique,
  "published-variable-has-description": publishedVariableHasDescription,
  "codesyntax-web-matches-name": codesyntaxWebMatchesName,
  "no-raw-value-on-component-node": noRawValueOnComponentNode,
  "text-layer-uses-style-or-bound-type": textLayerUsesStyleOrBoundType,
};
