// Theming / mode-structure detectors. Theme lives as modes on the Semantic
// tier; Primitives and Component are single-mode. All advisory (warn/info) —
// these are structural preferences, not breakage.

import type { Detector } from "../runner.js";
import type { PartialFinding } from "./shared.js";
import { analyze } from "./shared.js";

const primitiveComponentSingleMode: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const c of snap.collections) {
    const tier = a.collectionTier.get(c.id);
    if ((tier === "primitive" || tier === "component") && c.modes.length > 1) {
      out.push({
        rule_id: "primitive-component-single-mode",
        message: `${tier === "primitive" ? "Primitive" : "Component"} collection '${c.name}' has ${c.modes.length} modes; only the Semantic tier should be multi-mode (theme). Keep this single-mode and move theming to Semantic.`,
      });
    }
  }
  return out;
};

const everyModePopulated: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    const modes = a.modesByCollection.get(v.collectionId) ?? [];
    const missing = modes.filter((m) => !(m in v.valuesByMode));
    if (missing.length > 0) {
      out.push({
        rule_id: "every-mode-populated",
        variableId: v.id,
        message: `'${v.name}' has no value in ${missing.length} of its collection's mode(s).`,
      });
    }
  }
  return out;
};

const MODE_CEILING = 8;
const modeCountCeiling: Detector = (snap) => {
  const out: PartialFinding[] = [];
  for (const c of snap.collections) {
    if (c.modes.length > MODE_CEILING) {
      out.push({
        rule_id: "mode-count-ceiling",
        message: `Collection '${c.name}' has ${c.modes.length} modes (> ${MODE_CEILING}); a very high count usually means several axes (theme + density + platform) are folded into one collection — split them so each collection has one axis.`,
      });
    }
  }
  return out;
};

const semanticDefaultModeIsBase: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const c of snap.collections) {
    if (a.collectionTier.get(c.id) !== "semantic" || c.modes.length < 2) continue;
    const def = c.modes.find((m) => m.modeId === c.defaultModeId);
    if (def && /dark|night|inverse/i.test(def.name)) {
      out.push({
        rule_id: "semantic-default-mode-is-base",
        message: `Semantic collection '${c.name}' defaults to mode '${def.name}'; the default should be the base/light theme so consumers that don't set a mode get the base look.`,
      });
    }
  }
  return out;
};

export const themingDetectors: Record<string, Detector> = {
  "primitive-component-single-mode": primitiveComponentSingleMode,
  "every-mode-populated": everyModePopulated,
  "mode-count-ceiling": modeCountCeiling,
  "semantic-default-mode-is-base": semanticDefaultModeIsBase,
};
