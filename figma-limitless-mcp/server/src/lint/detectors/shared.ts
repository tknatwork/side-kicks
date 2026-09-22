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
  /** Unknown-tier collections that alias another local collection: semantic
   *  or component (not primitive), which one unproven. See isTyped. */
  typedUnknownCollections: Set<string>;
  /** Referenced non-local ids the plugin resolved (imported library variables). */
  externalIds: Set<string>;
  /** Referenced non-local ids the plugin checked that resolved to nothing. */
  unresolvedIds: Set<string>;
  /** The plugin's library lookup hit its cap: a non-local id in neither list
   *  was never checked. */
  externalScanTruncated: boolean;
}

/**
 * What a referenced variable id resolves to: a local variable; an imported
 * team-library variable (the plugin resolved it); an id the plugin's capped
 * lookup never reached ("unproven" — it may be a library variable); or
 * nothing ("dangling": the plugin checked it and got null, or checked every
 * non-local id and this one isn't a library variable). An old plugin build
 * ships no lists, so every non-local id is dangling, as before.
 */
export type RefStatus = "local" | "library" | "unproven" | "dangling";

type RefLists = Pick<Analysis, "externalIds" | "unresolvedIds" | "externalScanTruncated">;

function nonLocalStatus(r: RefLists, id: string): Exclude<RefStatus, "local"> {
  if (r.externalIds.has(id)) return "library";
  if (r.unresolvedIds.has(id)) return "dangling";
  return r.externalScanTruncated ? "unproven" : "dangling";
}

export function refStatus(a: Analysis, id: string): RefStatus {
  return a.byId.has(id) ? "local" : nonLocalStatus(a, id);
}

/** A non-local reference that may be a library variable. Its name, tier and
 *  value live outside this file, so a rule can prove nothing about it. */
export function isExternalRef(a: Analysis, id: string): boolean {
  const s = refStatus(a, id);
  return s === "library" || s === "unproven";
}

/**
 * Semantic or component, the tiers the typed-token rules check. An
 * unknown-tier collection that aliases another local collection counts too:
 * the classifier puts every such collection in one of the two, and only which
 * one hangs on a variable it can't see.
 */
export function isTyped(a: Analysis, v: AnalyzedVariable): boolean {
  return v.tier === "semantic" || v.tier === "component" || a.typedUnknownCollections.has(v.collectionId);
}

/** If `val` is a serialized alias ({ alias: variableId }), return the target id. */
export function aliasTarget(val: unknown): string | null {
  if (val && typeof val === "object" && "alias" in (val as object)) {
    const id = (val as { alias?: unknown }).alias;
    return typeof id === "string" ? id : null;
  }
  return null;
}

/** The target id of an alias nested in a composed colour: the snapshot's
 *  { alias: id }, or Figma's raw { type: 'VARIABLE_ALIAS', id } (what an older
 *  plugin build passes through verbatim). */
export function nestedAliasId(x: unknown): string | null {
  const t = aliasTarget(x);
  if (t !== null) return t;
  if (x && typeof x === "object") {
    const o = x as { type?: unknown; id?: unknown };
    if (o.type === "VARIABLE_ALIAS" && typeof o.id === "string") return o.id;
  }
  return null;
}

/** A composed colour value (Figma Update 139): a colour ({r,g,b,a?} or an
 *  alias) plus an opacity (a 0-100 percentage or an alias). */
export interface ComposedColor {
  color: unknown;
  opacity: unknown;
}

export function composedColor(val: unknown): ComposedColor | null {
  if (!val || typeof val !== "object" || Array.isArray(val)) return null;
  const o = val as Record<string, unknown>;
  if (!("color" in o) || !("opacity" in o) || "alias" in o || "r" in o) return null;
  return { color: o.color, opacity: o.opacity };
}

/**
 * Every variable a mode value references: the alias target, or the aliased
 * sides of a composed colour (which count as alias edges). Detectors that
 * reason about the alias GRAPH use this; aliasTarget() answers only "is this
 * value a plain alias".
 */
export function referenceTargets(val: unknown): string[] {
  const t = aliasTarget(val);
  if (t !== null) return [t];
  const c = composedColor(val);
  if (!c) return [];
  const out: string[] = [];
  const colorRef = nestedAliasId(c.color);
  if (colorRef !== null) out.push(colorRef);
  const opacityRef = nestedAliasId(c.opacity);
  if (opacityRef !== null) out.push(opacityRef);
  return out;
}

/**
 * The references that say which tier a value's collection sits in: a plain
 * alias target, or the colour side of a composed colour. The opacity side is
 * left out — a COLOR drawing its opacity from a FLOAT collection (a type edge
 * no plain alias can form) says nothing about the colour collection's tier.
 */
export function tierReferenceTargets(val: unknown): string[] {
  const t = aliasTarget(val);
  if (t !== null) return [t];
  const c = composedColor(val);
  const colorRef = c ? nestedAliasId(c.color) : null;
  return colorRef !== null ? [colorRef] : [];
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
 * classifies both ends as component (the acyclic rule flags the cycle). A
 * composed colour whose colour side is an alias counts as an alias; its
 * opacity side does not (see tierReferenceTargets). A reference to a library
 * variable (isExternalRef) aliases into a collection whose tier this file
 * can't see, so no tier is inferred from it: a collection whose only
 * cross-collection references are library ones has an unknown tier (the tier
 * rules skip it; it may be a palette with one library-sourced entry). The
 * same goes for a target collection of unknown tier, which may be primitive.
 * A collection that aliases another local collection is still semantic or
 * component (isTyped): component when a target is proven non-primitive, else
 * semantic when every target is primitive and none is a library variable,
 * else unknown.
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

  const refLists: RefLists = {
    externalIds: new Set(snap.externalVariableIds ?? []),
    unresolvedIds: new Set(snap.externalUnresolvedIds ?? []),
    externalScanTruncated: snap.externalRefScanTruncated === true,
  };

  // Cross-collection alias targets per collection (a composed colour's colour
  // side included, its opacity side not), and the collections that reference
  // a library variable.
  const outColls = new Map<string, Set<string>>();
  const libraryRefColls = new Set<string>();
  for (const v of snap.variables) {
    for (const val of Object.values(v.valuesByMode)) {
      for (const t of tierReferenceTargets(val)) {
        const target = varById.get(t);
        if (target && target.collectionId !== v.collectionId) {
          (outColls.get(v.collectionId) ?? outColls.set(v.collectionId, new Set()).get(v.collectionId)!).add(
            target.collectionId
          );
        } else if (!target && nonLocalStatus(refLists, t) !== "dangling") {
          libraryRefColls.add(v.collectionId);
        }
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
  // are primitive — unless they reference a library variable (unknown).
  for (const c of snap.collections) {
    if (tier.has(c.id)) continue;
    const outs = outColls.get(c.id);
    if (!outs || outs.size === 0) tier.set(c.id, libraryRefColls.has(c.id) ? "unknown" : "primitive");
  }
  // Pass 3 (fallback): the rest alias another local collection, so each is
  // semantic or component. A target proven non-primitive (semantic, component,
  // or another pass-3 collection) makes it component. Otherwise its targets
  // are primitive or unknown-tier (which may be primitive): semantic if all are
  // primitive and it references no library variable, else unknown — but typed.
  // Pass-3 targets count by membership, not by their result, so the order of
  // the collections doesn't matter.
  const rest = new Set(snap.collections.filter((c) => !tier.has(c.id)).map((c) => c.id));
  const typedUnknownCollections = new Set<string>();
  for (const id of rest) {
    const outs = [...outColls.get(id)!];
    const nonPrimitive = outs.some((o) => rest.has(o) || tier.get(o) === "semantic" || tier.get(o) === "component");
    if (nonPrimitive) {
      tier.set(id, "component");
    } else if (outs.every((o) => tier.get(o) === "primitive") && !libraryRefColls.has(id)) {
      tier.set(id, "semantic");
    } else {
      tier.set(id, "unknown");
      typedUnknownCollections.add(id);
    }
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
    typedUnknownCollections,
    ...refLists,
  };
}

/**
 * Resolve an alias chain from a variable's mode value. Returns the hop count to
 * a raw value, or a cycle/dangling marker. A composed colour branches into its
 * aliased sides (a bounded DFS; hops is the deepest branch); a plain alias
 * chain resolves exactly as a linear walk would. A primitive's composed colour
 * (the allowed derived alpha variant) adds no hops: the walk goes on through it
 * only to find cycles and dangling references; so does one in an unknown-tier
 * collection, which may be a primitive's. Bounded by MAX to survive cycles,
 * and stops at the first cycle or non-local reference: `dangling` is set for
 * any target outside the local set, a library variable included (the walk
 * can't follow it out of the file, so the depth rule skips that chain).
 */
export function resolveChain(
  a: Analysis,
  startValue: unknown,
  modeId: string
): { hops: number; cyclic: boolean; dangling: boolean } {
  let hops = 0;
  let cyclic = false;
  let dangling = false;
  const path = new Set<string>();
  const walk = (val: unknown, depth: number, counting: boolean): void => {
    for (const target of referenceTargets(val)) {
      if (cyclic || dangling) return;
      if (path.has(target) || depth + 1 > 16) {
        cyclic = true;
        return;
      }
      if (counting) hops = Math.max(hops, depth + 1);
      const v = a.byId.get(target);
      if (!v) {
        dangling = true;
        return;
      }
      // Follow this variable's value in the SAME mode if present, else its default.
      const next =
        modeId in v.valuesByMode
          ? v.valuesByMode[modeId]
          : Object.values(v.valuesByMode)[0];
      const alphaVariant =
        (v.tier === "primitive" || v.tier === "unknown") && composedColor(next) !== null;
      path.add(target);
      walk(next, depth + 1, counting && !alphaVariant);
      path.delete(target);
    }
  };
  walk(startValue, 0, true);
  return { hops, cyclic, dangling };
}
