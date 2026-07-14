// Node-binding detectors — need the lint_run node-binding scan (nodeBindings).
// The flagship rule: a node bound directly to a primitive-tier variable has no
// semantic layer, so it can't be themed.

import type { Detector } from "../runner.js";
import { analyze, type PartialFinding } from "./shared.js";

const noNodeBindsPrimitive: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  const seen = new Set<string>(); // one finding per primitive (example node), not per bound node
  for (const b of snap.nodeBindings ?? []) {
    const v = a.byId.get(b.variableId);
    if (!v || v.tier !== "primitive") continue;
    if (seen.has(b.variableId)) continue;
    seen.add(b.variableId);
    out.push({
      rule_id: "no-node-binds-primitive",
      nodeId: b.nodeId,
      variableId: b.variableId,
      message: `Node '${b.nodeName}' binds primitive '${v.name}' directly (field ${b.field}); bind a SEMANTIC token instead so theming flows — the missing-semantic-layer defect (other nodes likely bind the same primitive).`,
    });
  }
  return out;
};

export const bindingDetectors: Record<string, Detector> = {
  "no-node-binds-primitive": noNodeBindsPrimitive,
};
