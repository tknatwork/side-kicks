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

export const codegenDetectors: Record<string, Detector> = {
  "published-variable-has-codesyntax-web": publishedVariableHasCodesyntaxWeb,
  "codesyntax-web-unique": codesyntaxWebUnique,
  "published-variable-has-description": publishedVariableHasDescription,
};
