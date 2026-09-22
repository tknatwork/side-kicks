// Token-tier detectors (variable-graph only — no node bindings). Enforce the
// canonical Primitive -> Semantic -> Component structure. Each returns
// PartialFinding[] and stops at the first offence per variable to keep reports
// scannable.

import type { Detector } from "../runner.js";
import {
  analyze,
  aliasTarget,
  composedColor,
  isExternalRef,
  referenceTargets,
  refStatus,
  resolveChain,
  TIER_RANK,
  type PartialFinding,
} from "./shared.js";

const threeTierCollectionsExist: Detector = (snap) => {
  const a = analyze(snap);
  if (!a.hasVariables) return [];
  // A file that references library variables may take a tier from the
  // library, so a tier missing locally can't be proven missing.
  const usesLibrary = a.variables.some((v) =>
    Object.values(v.valuesByMode).some((val) => referenceTargets(val).some((t) => isExternalRef(a, t)))
  );
  if (usesLibrary) return [];
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
      // Plain aliases only (aliasTarget, not referenceTargets): a composed
      // colour inside the primitive collection is Figma's documented derived
      // alpha variant, and one that reaches across collections is
      // alias-one-tier-down's concern.
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
      // A composed colour references a variable and themes like an alias.
      if (referenceTargets(val).length > 0) aliasModes++;
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
      const refs = referenceTargets(val);
      if (refs.length === 0) {
        out.push({
          rule_id: "component-token-must-alias-semantic",
          variableId: v.id,
          message: `Component token '${v.name}' has a raw value in mode ${mode}; component tokens must alias a semantic token.`,
        });
        break;
      }
      // A library target isn't in byId, and an unknown-tier one may be
      // semantic: neither proves a skipped tier.
      const target = refs
        .map((t) => a.byId.get(t))
        .find((t) => t && t.tier !== "semantic" && t.tier !== "unknown");
      if (target) {
        const verb = composedColor(val) ? "composes" : "aliases";
        out.push({
          rule_id: "component-token-must-alias-semantic",
          variableId: v.id,
          message: `Component token '${v.name}' ${verb} a ${target.tier}-tier variable ('${target.name}'); it must alias a SEMANTIC token, not skip tiers.`,
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
    modes: for (const [mode, val] of Object.entries(v.valuesByMode)) {
      for (const t of referenceTargets(val)) {
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
          break modes;
        }
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
      // Composed-colour references resolve like plain aliases. A library
      // variable the plugin resolved is a live target; one its capped lookup
      // never reached can't be proven dangling (see refStatus).
      const t = referenceTargets(val).find((id) => refStatus(a, id) === "dangling");
      if (t !== undefined) {
        const kind = composedColor(val) ? "composed-color reference" : "alias";
        out.push({
          rule_id: "alias-target-resolves",
          variableId: v.id,
          message: `'${v.name}' has a dangling ${kind} in mode ${mode} (target ${t} not found).`,
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
      if (referenceTargets(val).length === 0) continue;
      const { hops, cyclic, dangling } = resolveChain(a, val, mode);
      // A dangling target is alias-target-resolves' finding; a library one
      // leads out of the file, where the walk stops, so the chain isn't judged.
      if (dangling) continue;
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
    // Plain aliases are skipped; identical composed colours key identically
    // and are reported like any duplicated raw value.
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

const unusedVariableOrphan: Detector = (snap) => {
  // Only conclude "unused" if bindings were scanned in full. If the plugin
  // didn't gather bindings, or truncated the scan, we can't prove a variable is
  // unbound — stay silent rather than false-flag a token that IS used.
  if (!Array.isArray(snap.nodeBindings) || snap.bindingsTruncated) return [];
  const a = analyze(snap);
  const bound = new Set(snap.nodeBindings.map((b) => b.variableId));
  const aliased = new Set<string>();
  for (const v of a.variables) {
    for (const val of Object.values(v.valuesByMode)) {
      for (const t of referenceTargets(val)) aliased.add(t);
    }
  }
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    // Published tokens are the public API — unused INTERNALLY is expected, so
    // only hidden (internal) variables can be genuine orphans.
    if (v.hiddenFromPublishing !== true) continue;
    if (aliased.has(v.id) || bound.has(v.id)) continue;
    out.push({
      rule_id: "unused-variable-orphan",
      variableId: v.id,
      message: `Hidden token '${v.name}' is never aliased by another variable and never bound to a node — dead weight; delete it or wire it up.`,
    });
  }
  return out;
};

// A component token that aliases the SAME semantic in every mode (no per-mode
// override) and is bound to <=1 node is a pure pass-through that adds a tier for
// nothing. Needs the full binding scan (skip if truncated/absent — can't prove
// usage count). warn.
const singleUseComponentPassthrough: Detector = (snap) => {
  if (!Array.isArray(snap.nodeBindings) || snap.bindingsTruncated) return [];
  const a = analyze(snap);
  const bindCount = new Map<string, number>();
  for (const b of snap.nodeBindings) bindCount.set(b.variableId, (bindCount.get(b.variableId) ?? 0) + 1);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    if (v.tier !== "component") continue;
    const targets = new Set<string>();
    let allAlias = true;
    for (const val of Object.values(v.valuesByMode)) {
      const t = aliasTarget(val);
      if (!t) {
        allAlias = false;
        break;
      }
      targets.add(t);
    }
    if (!allAlias || targets.size !== 1) continue; // per-mode variation or raw => not a pure pass-through
    const uses = bindCount.get(v.id) ?? 0;
    if (uses <= 1) {
      out.push({
        rule_id: "single-use-component-passthrough",
        variableId: v.id,
        message: `Component token '${v.name}' is a pure pass-through (aliases one semantic in every mode, no override) used ${uses === 0 ? "nowhere" : "once"}; inline the semantic at the node and delete it, or justify it by reusing it across the subtree.`,
      });
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
  "unused-variable-orphan": unusedVariableOrphan,
  "single-use-component-passthrough": singleUseComponentPassthrough,
};
