/**
 * Cascading impact analyzer — traces proposed changes through
 * the 3-tier token chain and component hierarchy to predict
 * the full downstream blast radius before any write.
 *
 * @module pipeline/impact-analyzer
 */

import type {
  SourceAnalysis,
  PropertyChange,
  ImpactReport,
  ImpactTokens,
  ImpactNodes,
  ImpactInstances,
  PrototypeWarning,
  VariableEntry,
} from './types';

/** Build a lookup map: variable ID → VariableEntry. */
function buildVarIndex(source: SourceAnalysis): Map<string, VariableEntry> {
  const index = new Map<string, VariableEntry>();
  for (const col of source.variables.collections) {
    for (const v of col.variables) {
      index.set(v.id, v);
    }
  }
  return index;
}

/** Build reverse alias map: variable ID → IDs that reference it. */
function buildReverseAliasMap(source: SourceAnalysis): Map<string, string[]> {
  const reverse = new Map<string, string[]>();
  for (const col of source.variables.collections) {
    for (const v of col.variables) {
      if (v.aliasOf) {
        const refs = reverse.get(v.aliasOf) ?? [];
        refs.push(v.id);
        reverse.set(v.aliasOf, refs);
      }
    }
  }
  return reverse;
}

/** Walk the alias chain downward to find all downstream tokens. */
function traceDownstream(
  varId: string,
  reverseMap: Map<string, string[]>,
  visited: Set<string>,
): void {
  if (visited.has(varId)) return;
  visited.add(varId);
  const dependents = reverseMap.get(varId);
  if (dependents) {
    for (const dep of dependents) {
      traceDownstream(dep, reverseMap, visited);
    }
  }
}

/** Analyze token-level cascading impact. */
function analyzeTokenImpact(
  changes: readonly PropertyChange[],
  _source: SourceAnalysis,
  varIndex: Map<string, VariableEntry>,
  reverseMap: Map<string, string[]>,
): ImpactTokens {
  const affected = new Set<string>();
  for (const change of changes) {
    traceDownstream(change.nodeId, reverseMap, affected);
  }

  let tier1 = 0, tier2 = 0, tier3 = 0;
  for (const id of affected) {
    const v = varIndex.get(id);
    if (!v) continue;
    if (v.tier === 'primitives') tier1++;
    else if (v.tier === 'semantic') tier2++;
    else tier3++;
  }

  return {
    tier1Affected: tier1,
    tier2Affected: tier2,
    tier3Affected: tier3,
    affectedIds: [...affected],
  };
}

/** Analyze component instance cascading impact. */
function analyzeInstanceImpact(
  changes: readonly PropertyChange[],
  source: SourceAnalysis,
): ImpactInstances {
  const changedNodeIds = new Set(changes.map(c => c.nodeId));
  const affectedMasters: string[] = [];
  let totalInstances = 0;

  for (const master of source.components.masters) {
    if (changedNodeIds.has(master.id)) {
      affectedMasters.push(master.id);
      totalInstances += master.instanceCount;
    }
  }

  return {
    mastersAffected: affectedMasters.length,
    instancesAffected: totalInstances,
    affectedMasterIds: affectedMasters,
  };
}

/** Check if changes touch nodes involved in prototype connections. */
function analyzePrototypeWarnings(
  changes: readonly PropertyChange[],
  source: SourceAnalysis,
): PrototypeWarning[] {
  const changedIds = new Set(changes.map(c => c.nodeId));
  const warnings: PrototypeWarning[] = [];

  for (let i = 0; i < source.reactions.length; i++) {
    const r = source.reactions[i]!;
    if (changedIds.has(r.sourceNodeId) || changedIds.has(r.destinationNodeId)) {
      warnings.push({
        reactionIndex: i,
        sourceNodeId: r.sourceNodeId,
        destinationNodeId: r.destinationNodeId,
        reason: `Prototype connection touches a modified node`,
      });
    }
  }
  return warnings;
}

/** Analyze the full cascading impact of proposed changes. */
export function analyzeImpact(
  changes: readonly PropertyChange[],
  source: SourceAnalysis,
): ImpactReport {
  const varIndex = buildVarIndex(source);
  const reverseMap = buildReverseAliasMap(source);

  const tokens = analyzeTokenImpact(changes, source, varIndex, reverseMap);
  const instances = analyzeInstanceImpact(changes, source);
  const prototypeWarnings = analyzePrototypeWarnings(changes, source);

  const nodes: ImpactNodes = {
    directlyAffected: changes.length,
    inheritedAffected: tokens.affectedIds.length,
    affectedIds: changes.map(c => c.nodeId),
  };

  const parts: string[] = [];
  if (tokens.tier1Affected > 0) parts.push(`${tokens.tier1Affected} seed tokens`);
  if (tokens.tier2Affected > 0) parts.push(`${tokens.tier2Affected} semantic tokens`);
  if (tokens.tier3Affected > 0) parts.push(`${tokens.tier3Affected} mapped tokens`);
  if (instances.instancesAffected > 0) {
    parts.push(`${instances.instancesAffected} component instances`);
  }
  if (prototypeWarnings.length > 0) {
    parts.push(`${prototypeWarnings.length} prototype connections`);
  }
  const summary = parts.length > 0
    ? `Affects ${parts.join(', ')}`
    : 'No cascading impact detected';

  return { tokens, nodes, instances, prototypeWarnings, summary };
}
