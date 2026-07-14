// Token-tier detectors (variable-graph only — no node bindings). Enforce the
// canonical Primitive -> Semantic -> Component structure. Each returns
// PartialFinding[] and stops at the first offence per variable to keep reports
// scannable.

import type { Detector } from "../runner.js";
import {
  analyze,
  aliasTarget,
  resolveChain,
  TIER_RANK,
  type PartialFinding,
} from "./shared.js";

const threeTierCollectionsExist: Detector = (snap) => {
  const a = analyze(snap);
  if (!a.hasVariables) return [];
  const tiers = new Set(a.collectionTier.values());
  const missing: string[] = [];
  if (!tiers.has("primitive")) missing.push("primitive");
  if (!tiers.has("semantic")) missing.push("semantic");
  if (missing.length === 0) return [];
  return [
    {
      rule_id: "three-tier-collections-exist",
      message: `Missing the ${missing.join(" and ")} tier${missing.length > 1 ? "s" : ""}. Expected one collection per tier (Primitive raw, Semantic aliased/themed, Component optional).`,
    },
  ];
};

const primitiveRawValuesOnly: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    if (v.tier !== "primitive") continue;
    for (const [mode, val] of Object.entries(v.valuesByMode)) {
      if (aliasTarget(val)) {
        out.push({
          rule_id: "primitive-raw-values-only",
          variableId: v.id,
          message: `Primitive '${v.name}' aliases another variable (mode ${mode}); primitives must hold raw values only.`,
        });
        break;
      }
    }
  }
  return out;
};

const semanticAliasInEveryMode: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    if (v.tier !== "semantic") continue;
    const modes = a.modesByCollection.get(v.collectionId) ?? Object.keys(v.valuesByMode);
    let aliasModes = 0;
    let rawModes = 0;
    for (const mode of modes) {
      const val = v.valuesByMode[mode];
      if (val === undefined) continue;
      if (aliasTarget(val)) aliasModes++;
      else rawModes++;
    }
    // Only flag INCONSISTENCY — aliases in some modes, raw in others (a theme
    // switch wouldn't flip it uniformly). A token that's raw in every mode may
    // be a legitimate granular value, so we leave it alone.
    if (aliasModes > 0 && rawModes > 0) {
      out.push({
        rule_id: "semantic-alias-in-every-mode",
        variableId: v.id,
        message: `Semantic token '${v.name}' aliases in ${aliasModes} mode(s) but is a raw value in ${rawModes}; alias it in every mode so a theme switch flips it uniformly.`,
      });
    }
  }
  return out;
};

const componentTokenMustAliasSemantic: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    if (v.tier !== "component") continue;
    for (const [mode, val] of Object.entries(v.valuesByMode)) {
      const t = aliasTarget(val);
      if (!t) {
        out.push({
          rule_id: "component-token-must-alias-semantic",
          variableId: v.id,
          message: `Component token '${v.name}' has a raw value in mode ${mode}; component tokens must alias a semantic token.`,
        });
        break;
      }
      const target = a.byId.get(t);
      if (target && target.tier !== "semantic") {
        out.push({
          rule_id: "component-token-must-alias-semantic",
          variableId: v.id,
          message: `Component token '${v.name}' aliases a ${target.tier}-tier variable ('${target.name}'); it must alias a SEMANTIC token, not skip tiers.`,
        });
        break;
      }
    }
  }
  return out;
};

const aliasOneTierDown: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    if (TIER_RANK[v.tier] < 0) continue;
    for (const [mode, val] of Object.entries(v.valuesByMode)) {
      const t = aliasTarget(val);
      if (!t) continue;
      const target = a.byId.get(t);
      if (!target || TIER_RANK[target.tier] < 0) continue;
      // Intra-collection aliases are a team's granular in-tier controls, not a
      // tier violation — only check aliases that cross tier collections.
      if (target.collectionId === v.collectionId) continue;
      if (TIER_RANK[v.tier] - TIER_RANK[target.tier] !== 1) {
        out.push({
          rule_id: "alias-one-tier-down",
          variableId: v.id,
          message: `'${v.name}' (${v.tier}) aliases '${target.name}' (${target.tier}) across collections in mode ${mode}; cross-tier aliases must point EXACTLY one tier down (component->semantic->primitive).`,
        });
        break;
      }
    }
  }
  return out;
};

const aliasTargetResolves: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    for (const [mode, val] of Object.entries(v.valuesByMode)) {
      const t = aliasTarget(val);
      if (t && !a.byId.has(t)) {
        out.push({
          rule_id: "alias-target-resolves",
          variableId: v.id,
          message: `'${v.name}' has a dangling alias in mode ${mode} (target ${t} not found).`,
        });
        break;
      }
    }
  }
  return out;
};

const aliasGraphAcyclic: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    for (const [mode, val] of Object.entries(v.valuesByMode)) {
      if (!aliasTarget(val)) continue;
      const { hops, cyclic, dangling } = resolveChain(a, val, mode);
      if (dangling) continue; // reported by alias-target-resolves
      if (cyclic) {
        out.push({
          rule_id: "alias-graph-acyclic-max-depth-2",
          variableId: v.id,
          message: `'${v.name}' has a cyclic alias chain (mode ${mode}).`,
        });
        break;
      }
      if (hops > 2) {
        out.push({
          rule_id: "alias-graph-acyclic-max-depth-2",
          variableId: v.id,
          message: `'${v.name}' alias chain is ${hops} hops deep (mode ${mode}); the tiered graph must resolve in <=2 (component->semantic->primitive).`,
        });
        break;
      }
    }
  }
  return out;
};

const primitiveHiddenFromPublishing: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    if (v.tier === "primitive" && v.hiddenFromPublishing === false) {
      out.push({
        rule_id: "primitive-hidden-from-publishing",
        variableId: v.id,
        message: `Primitive '${v.name}' is published; primitives should be hiddenFromPublishing so consumers theme against semantics, not raw values.`,
      });
    }
  }
  return out;
};

const duplicatePrimitiveValue: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  const seen = new Map<string, string>();
  for (const v of a.variables) {
    if (v.tier !== "primitive") continue;
    const val = Object.values(v.valuesByMode)[0];
    if (val === undefined || aliasTarget(val)) continue;
    const key = v.resolvedType + ":" + JSON.stringify(val);
    const first = seen.get(key);
    if (first) {
      out.push({
        rule_id: "duplicate-primitive-value",
        variableId: v.id,
        message: `Primitive '${v.name}' has the same value as '${first}'; collapse duplicate primitives to one source of truth.`,
      });
    } else {
      seen.set(key, v.name);
    }
  }
  return out;
};

export const tokenDetectors: Record<string, Detector> = {
  "three-tier-collections-exist": threeTierCollectionsExist,
  "primitive-raw-values-only": primitiveRawValuesOnly,
  "semantic-alias-in-every-mode": semanticAliasInEveryMode,
  "component-token-must-alias-semantic": componentTokenMustAliasSemantic,
  "alias-one-tier-down": aliasOneTierDown,
  "alias-target-resolves": aliasTargetResolves,
  "alias-graph-acyclic-max-depth-2": aliasGraphAcyclic,
  "primitive-hidden-from-publishing": primitiveHiddenFromPublishing,
  "duplicate-primitive-value": duplicatePrimitiveValue,
};
