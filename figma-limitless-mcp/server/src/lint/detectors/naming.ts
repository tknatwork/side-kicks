// Naming detectors — deliberately tolerant. A team's case convention (kebab
// vs camel) and category vocabulary are THEIR choice, so we flag only
// objectively-messy names and the one naming rule that affects theming
// (hue words belong to primitives, not semantics). All advisory (warn).

import type { Detector } from "../runner.js";
import type { PartialFinding } from "./shared.js";
import { analyze } from "./shared.js";

// True chromatic hues only — neutral/gray/slate/etc. are commonly used as
// legitimate semantic role names, so they're excluded to avoid false positives.
const HUE_WORD =
  /^(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)$/;

const nameKebabSegments: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    const segs = v.name.split("/");
    const messy =
      v.name.startsWith("/") ||
      v.name.endsWith("/") ||
      v.name.includes("//") ||
      segs.some((s) => s.length === 0 || /\s/.test(s));
    if (messy) {
      out.push({
        rule_id: "name-kebab-segments",
        variableId: v.id,
        message: `'${v.name}' has a malformed segment (space, empty, or stray slash); use clean slash-separated segments.`,
      });
    }
  }
  return out;
};

const nameSlashStructureDepth: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    const depth = v.name.split("/").length;
    if (depth < 2) {
      out.push({
        rule_id: "name-slash-structure-depth",
        variableId: v.id,
        message: `'${v.name}' is flat (no group); use slash grouping like 'category/role' so it nests in the Variables panel and code output.`,
      });
    } else if (depth > 5) {
      out.push({
        rule_id: "name-slash-structure-depth",
        variableId: v.id,
        message: `'${v.name}' is ${depth} levels deep; very deep names are hard to consume — flatten toward category/role/variant.`,
      });
    }
  }
  return out;
};

const hueRampWordsPrimitivesOnly: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    if (v.tier === "primitive") continue; // hue ramps belong in primitives
    const hue = v.name
      .toLowerCase()
      .split("/")
      .find((s) => HUE_WORD.test(s));
    if (hue) {
      out.push({
        rule_id: "hue-ramp-words-primitives-only",
        variableId: v.id,
        message: `${v.tier} token '${v.name}' names a hue ('${hue}'); semantic/component tokens should be role-named (bg/fg/brand), not colour-named — role names are what let a theme repaint them.`,
      });
    }
  }
  return out;
};

export const namingDetectors: Record<string, Detector> = {
  "name-kebab-segments": nameKebabSegments,
  "name-slash-structure-depth": nameSlashStructureDepth,
  "hue-ramp-words-primitives-only": hueRampWordsPrimitivesOnly,
};
