// Shared analysis for the design-system linter: tier classification + alias
// resolution over the variable graph. Pure functions on a LintSnapshot — no
// Figma API. The token and scope detectors build on this.

import type { LintSnapshot, SnapVariable } from "../runner.js";

export type PartialFinding = {
  rule_id: string;
  message: string;
  variableId?: string;
  nodeId?: string;
};

export type Tier = "primitive" | "semantic" | "component" | "unknown";

export const TIER_RANK: Record<Tier, number> = {
  primitive: 0,
  semantic: 1,
  component: 2,
  unknown: -1,
};

export interface AnalyzedVariable extends SnapVariable {
  tier: Tier;
  collectionName: string;
}

export interface Analysis {
  byId: Map<string, AnalyzedVariable>;
  variables: AnalyzedVariable[];
  collectionTier: Map<string, Tier>;
  varsByCollection: Map<string, AnalyzedVariable[]>;
  modesByCollection: Map<string, string[]>;
  hasVariables: boolean;
}

/** If `val` is a serialized alias ({ alias: variableId }), return the target id. */
export function aliasTarget(val: unknown): string | null {
  if (val && typeof val === "object" && "alias" in (val as object)) {
    const id = (val as { alias?: unknown }).alias;
    return typeof id === "string" ? id : null;
  }
  return null;
}

/** First path segment of a slash-structured name, lowercased (e.g. "bg/default" -> "bg"). */
export function roleSegment(name: string): string {
  return name.split("/")[0]?.toLowerCase().trim() ?? "";
}

function nameHint(name: string): Tier {
  // Deliberately narrow: only unambiguous tier words. "token"/"role"/"theme"
  // were dropped — they match collections like "Motion Tokens" that hold a
  // granular scale, not the semantic tier.
  const n = name.toLowerCase();
  if (/\bcomponent/.test(n)) return "component";
  if (/\bsemantic/.test(n)) return "semantic";
  if (/(\bprimitive|\bcore\b|\bbase\b|\bglobal\b|\bpalette|\bramp\b)/.test(n)) {
    return "primitive";
  }
  return "unknown";
}

/**
 * Classify each collection into a tier from the alias DAG:
 *   - aliases into nothing (cross-collection)        -> primitive
 *   - aliases only into primitive collections        -> semantic
 *   - aliases into a non-primitive collection        -> component
 * Empty/ambiguous collections fall back to a name hint. A cyclic graph
 * classifies both ends as component (the acyclic rule flags the cycle).
 */
// analyze() is called independently by ~30 detectors; recomputing the alias-DAG
// classification per detector over a 1,121-variable / 48-page file is wasteful.
// Memoize on the snapshot identity (WeakMap = no leak, GC-friendly) so the whole
// suite pays the cost once — transparently, with zero detector changes.
const analysisCache = new WeakMap<LintSnapshot, Analysis>();

export function analyze(snap: LintSnapshot): Analysis {
  const cached = analysisCache.get(snap);
  if (cached) return cached;
  const result = computeAnalysis(snap);
  analysisCache.set(snap, result);
  return result;
}

function computeAnalysis(snap: LintSnapshot): Analysis {
  const varById = new Map(snap.variables.map((v) => [v.id, v]));
  const collName = new Map(snap.collections.map((c) => [c.id, c.name]));
  const collModes = new Map(
    snap.collections.map((c) => [c.id, c.modes.map((m) => m.modeId)])
  );

  // Cross-collection alias targets per collection.
  const outColls = new Map<string, Set<string>>();
  for (const v of snap.variables) {
    for (const val of Object.values(v.valuesByMode)) {
      const t = aliasTarget(val);
      if (!t) continue;
      const target = varById.get(t);
      if (target && target.collectionId !== v.collectionId) {
        (outColls.get(v.collectionId) ?? outColls.set(v.collectionId, new Set()).get(v.collectionId)!).add(
          target.collectionId
        );
      }
    }
  }

  const tier = new Map<string, Tier>();
  // Pass 1 (primary): name hints. The canonical collections are named
  // Primitives / Semantic / Component; a mis-built but correctly-NAMED
  // collection must be classified by intent so its defects surface (a
  // "Semantic" collection full of raw values should fail, not be re-labelled
  // primitive and pass).
  for (const c of snap.collections) {
    const hint = nameHint(c.name);
    if (hint !== "unknown") tier.set(c.id, hint);
  }
  // Pass 2 (fallback): unnamed collections with no cross-collection out-aliases
  // are primitive.
  for (const c of snap.collections) {
    if (tier.has(c.id)) continue;
    const outs = outColls.get(c.id);
    if (!outs || outs.size === 0) tier.set(c.id, "primitive");
  }
  // Pass 3 (fallback): the rest are semantic (all targets primitive) or component.
  for (const c of snap.collections) {
    if (tier.has(c.id)) continue;
    const outs = outColls.get(c.id)!;
    const allPrimitive = [...outs].every((o) => tier.get(o) === "primitive");
    tier.set(c.id, allPrimitive ? "semantic" : "component");
  }

  const analyzed: AnalyzedVariable[] = snap.variables.map((v) => ({
    ...v,
    tier: tier.get(v.collectionId) ?? "unknown",
    collectionName: collName.get(v.collectionId) ?? "",
  }));

  const varsByCollection = new Map<string, AnalyzedVariable[]>();
  for (const v of analyzed) {
    (varsByCollection.get(v.collectionId) ??
      varsByCollection.set(v.collectionId, []).get(v.collectionId)!).push(v);
  }

  return {
    byId: new Map(analyzed.map((v) => [v.id, v])),
    variables: analyzed,
    collectionTier: tier,
    varsByCollection,
    modesByCollection: collModes,
    hasVariables: snap.variables.length > 0,
  };
}

/**
 * Resolve an alias chain from a variable's mode value. Returns the hop count to
 * a raw value, or a cycle/dangling marker. Bounded by MAX to survive cycles.
 */
export function resolveChain(
  a: Analysis,
  startValue: unknown,
  modeId: string
): { hops: number; cyclic: boolean; dangling: boolean } {
  let hops = 0;
  let target = aliasTarget(startValue);
  const seen = new Set<string>();
  while (target !== null) {
    if (seen.has(target)) return { hops, cyclic: true, dangling: false };
    seen.add(target);
    hops++;
    if (hops > 16) return { hops, cyclic: true, dangling: false };
    const v = a.byId.get(target);
    if (!v) return { hops, cyclic: false, dangling: true };
    // Follow this variable's value in the SAME mode if present, else its default.
    const next =
      modeId in v.valuesByMode
        ? v.valuesByMode[modeId]
        : Object.values(v.valuesByMode)[0];
    target = aliasTarget(next);
  }
  return { hops, cyclic: false, dangling: false };
}
