/**
 * Replication Planner — converts deep-extracted source data into an
 * ordered sequence of GovernorCommands that recreate the full design
 * system in a destination Figma file.
 *
 * Execution order (dependency-safe):
 *   1. Pages
 *   2. Variable collections (with modes)
 *   3. Variables (batch per collection)
 *   4. Variable literal values (per mode)
 *   5. Variable aliases (bottom-up: primitives → semantic → mapped)
 *   6. Styles (color, text, effect, grid)
 *   7. Frames/nodes (top-level → nested, depth-first)
 *   8. Node properties (fills, strokes, text, layout)
 *
 * @module pipeline/replication-planner
 */

import type { GovernorCommand } from './types';

// ============================================================================
// SECTION 1: SOURCE DATA TYPES (from deep_extract response)
// ============================================================================

/** Shape returned by the deep_extract plugin command. */
export interface DeepExtractData {
  readonly fileName: string;
  readonly collections: readonly SourceCollection[];
  readonly variables: readonly SourceVariable[];
  readonly paintStyles: readonly SourcePaintStyle[];
  readonly textStyles: readonly SourceTextStyle[];
  readonly effectStyles: readonly SourceEffectStyle[];
  readonly gridStyles: readonly SourceGridStyle[];
  readonly pages: readonly SourcePage[];
}

export interface SourceCollection {
  readonly id: string;
  readonly name: string;
  readonly modes: readonly { readonly modeId: string; readonly name: string }[];
  readonly variableIds: readonly string[];
}

export interface SourceVariable {
  readonly id: string;
  readonly name: string;
  readonly resolvedType: string;
  readonly collectionId: string;
  readonly scopes: readonly string[];
  readonly description: string;
  readonly valuesByMode: Readonly<Record<string, unknown>>;
}

export interface SourcePaintStyle {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly paints: readonly unknown[];
}

export interface SourceTextStyle {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly fontName: { readonly family: string; readonly style: string };
  readonly fontSize: number;
  readonly lineHeight: unknown;
  readonly letterSpacing: unknown;
  readonly textDecoration: string;
  readonly textCase: string;
}

export interface SourceEffectStyle {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly effects: readonly unknown[];
}

export interface SourceGridStyle {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly grids: readonly unknown[];
}

export interface SourcePage {
  readonly name: string;
  readonly id: string;
  readonly children: readonly SourceNode[];
}

export interface SourceNode {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly visible: boolean;
  readonly children?: readonly SourceNode[];
  readonly [key: string]: unknown;
}

// ============================================================================
// SECTION 2: ID MAP (source IDs → destination IDs)
// ============================================================================

/**
 * Tracks the mapping from source entity IDs to destination entity IDs.
 * Populated as each creation command returns its result.
 */
export class ReplicationIdMap {
  private collections = new Map<string, string>();
  private variables = new Map<string, string>();
  private pages = new Map<string, string>();
  private nodes = new Map<string, string>();
  private modes = new Map<string, string>();

  setCollection(sourceId: string, destId: string): void { this.collections.set(sourceId, destId); }
  setVariable(sourceId: string, destId: string): void { this.variables.set(sourceId, destId); }
  setPage(sourceId: string, destId: string): void { this.pages.set(sourceId, destId); }
  setNode(sourceId: string, destId: string): void { this.nodes.set(sourceId, destId); }
  setMode(sourceModeId: string, destModeId: string): void { this.modes.set(sourceModeId, destModeId); }

  getCollection(sourceId: string): string | undefined { return this.collections.get(sourceId); }
  getVariable(sourceId: string): string | undefined { return this.variables.get(sourceId); }
  getPage(sourceId: string): string | undefined { return this.pages.get(sourceId); }
  getNode(sourceId: string): string | undefined { return this.nodes.get(sourceId); }
  getMode(sourceModeId: string): string | undefined { return this.modes.get(sourceModeId); }

  getSummary(): { collections: number; variables: number; pages: number; nodes: number; modes: number } {
    return {
      collections: this.collections.size,
      variables: this.variables.size,
      pages: this.pages.size,
      nodes: this.nodes.size,
      modes: this.modes.size,
    };
  }
}

// ============================================================================
// SECTION 3: REPLICATION PLAN GENERATION
// ============================================================================

export interface ReplicationPlan {
  readonly sourceFileName: string;
  readonly phases: readonly ReplicationPhase[];
  readonly totalCommands: number;
  readonly summary: string;
}

export interface ReplicationPhase {
  readonly name: string;
  readonly commands: readonly GovernorCommand[];
}

/**
 * Generate a full replication plan from deep-extracted source data.
 *
 * Returns an ordered list of phases, each containing commands that can
 * be sent to the write governor. Phases must execute sequentially.
 * Commands within a phase can be batched.
 */
export function planReplication(source: DeepExtractData): ReplicationPlan {
  const phases: ReplicationPhase[] = [];

  // Phase 1: Pages
  const pageCommands = planPages(source.pages);
  if (pageCommands.length > 0) {
    phases.push({ name: 'Create pages', commands: pageCommands });
  }

  // Phase 2: Variable collections
  const collectionCommands = planCollections(source.collections);
  if (collectionCommands.length > 0) {
    phases.push({ name: 'Create variable collections', commands: collectionCommands });
  }

  // Phase 3: Variables (create, no values yet)
  const variableCommands = planVariables(source.variables, source.collections);
  if (variableCommands.length > 0) {
    phases.push({ name: 'Create variables', commands: variableCommands });
  }

  // Phase 4: Variable values (literals only — aliases need all vars to exist first)
  const valueCommands = planVariableValues(source.variables, source.collections);
  if (valueCommands.length > 0) {
    phases.push({ name: 'Set variable values', commands: valueCommands });
  }

  // Phase 5: Variable aliases (after all variables exist)
  const aliasCommands = planVariableAliases(source.variables, source.collections);
  if (aliasCommands.length > 0) {
    phases.push({ name: 'Set variable aliases', commands: aliasCommands });
  }

  // Phase 6: Styles
  const styleCommands = planStyles(source.paintStyles, source.textStyles, source.effectStyles, source.gridStyles);
  if (styleCommands.length > 0) {
    phases.push({ name: 'Create styles', commands: styleCommands });
  }

  // Phase 7: Nodes (frames, components, text, etc.)
  const nodeCommands = planNodes(source.pages);
  if (nodeCommands.length > 0) {
    phases.push({ name: 'Create nodes', commands: nodeCommands });
  }

  const totalCommands = phases.reduce((sum, p) => sum + p.commands.length, 0);

  return {
    sourceFileName: source.fileName,
    phases,
    totalCommands,
    summary: buildSummary(source, phases, totalCommands),
  };
}

// ============================================================================
// SECTION 4: PHASE PLANNERS
// ============================================================================

function planPages(pages: readonly SourcePage[]): GovernorCommand[] {
  return pages.map(page => ({
    type: 'create_page',
    payload: { name: page.name },
    group: 'node-additions' as const,
  }));
}

function planCollections(collections: readonly SourceCollection[]): GovernorCommand[] {
  return collections.map(c => ({
    type: 'create_collection',
    payload: {
      name: c.name,
      modes: c.modes.map(m => m.name),
    },
    group: 'variable-additions' as const,
  }));
}

function planVariables(
  variables: readonly SourceVariable[],
  collections: readonly SourceCollection[],
): GovernorCommand[] {
  // Group variables by collection for batch creation
  const byCollection = new Map<string, SourceVariable[]>();
  for (const v of variables) {
    const existing = byCollection.get(v.collectionId) || [];
    existing.push(v);
    byCollection.set(v.collectionId, existing);
  }

  const commands: GovernorCommand[] = [];
  for (const [collectionId, vars] of byCollection) {
    const collection = collections.find(c => c.id === collectionId);
    if (!collection) continue;

    commands.push({
      type: 'batch_create_variables',
      payload: {
        collectionName: collection.name,
        variables: vars.map(v => ({
          name: v.name,
          type: resolvedTypeToCreateType(v.resolvedType),
        })),
      },
      group: 'variable-additions',
    });
  }

  return commands;
}

function planVariableValues(
  variables: readonly SourceVariable[],
  collections: readonly SourceCollection[],
): GovernorCommand[] {
  const commands: GovernorCommand[] = [];

  for (const v of variables) {
    const collection = collections.find(c => c.id === v.collectionId);
    if (!collection) continue;

    for (const mode of collection.modes) {
      const value = v.valuesByMode[mode.modeId];
      if (value === undefined || value === null) continue;

      // Skip aliases — handled in phase 5
      if (isAlias(value)) continue;

      commands.push({
        type: 'batch_set_values',
        payload: {
          collectionName: collection.name,
          mode: mode.name,
          values: [{ name: v.name, value }],
        },
        group: 'variable-additions',
      });
    }
  }

  // Merge batch_set_values per collection+mode for efficiency
  return mergeBatchSetValues(commands);
}

function planVariableAliases(
  variables: readonly SourceVariable[],
  collections: readonly SourceCollection[],
): GovernorCommand[] {
  const commands: GovernorCommand[] = [];

  for (const v of variables) {
    const collection = collections.find(c => c.id === v.collectionId);
    if (!collection) continue;

    for (const mode of collection.modes) {
      const value = v.valuesByMode[mode.modeId];
      if (!isAlias(value)) continue;

      const targetVarId = (value as { _alias: boolean; variableId: string }).variableId;
      // Find the target variable's name for name-based resolution
      const targetVar = variables.find(tv => tv.id === targetVarId);
      if (!targetVar) continue;

      const targetCollection = collections.find(c => c.id === targetVar.collectionId);
      if (!targetCollection) continue;

      commands.push({
        type: 'batch_set_aliases',
        payload: {
          collectionName: collection.name,
          mode: mode.name,
          aliases: [{
            name: v.name,
            targetName: targetVar.name,
            targetCollection: targetCollection.name,
          }],
        },
        group: 'variable-additions',
      });
    }
  }

  // Merge batch_set_aliases per collection+mode
  return mergeBatchSetAliases(commands);
}

function planStyles(
  paintStyles: readonly SourcePaintStyle[],
  textStyles: readonly SourceTextStyle[],
  effectStyles: readonly SourceEffectStyle[],
  _gridStyles: readonly SourceGridStyle[],
): GovernorCommand[] {
  const commands: GovernorCommand[] = [];

  for (const s of paintStyles) {
    // Extract the first solid paint color for create_color_style
    const firstPaint = s.paints[0] as Record<string, unknown> | undefined;
    if (firstPaint && firstPaint.type === 'SOLID') {
      const color = firstPaint.color as { r: number; g: number; b: number };
      const opacity = (firstPaint.opacity as number) ?? 1;
      commands.push({
        type: 'create_color_style',
        payload: {
          name: s.name,
          color: { r: color.r, g: color.g, b: color.b, a: opacity },
        },
        group: 'variable-additions',
      });
    }
  }

  for (const s of textStyles) {
    commands.push({
      type: 'create_text_style',
      payload: {
        name: s.name,
        fontFamily: s.fontName.family,
        fontStyle: s.fontName.style,
        fontSize: s.fontSize,
        lineHeight: s.lineHeight,
        letterSpacing: s.letterSpacing,
      },
      group: 'variable-additions',
    });
  }

  // Effect and grid styles: use create_effect_style / create_grid_style
  for (const s of effectStyles) {
    commands.push({
      type: 'create_effect_style',
      payload: { name: s.name, effects: s.effects },
      group: 'variable-additions',
    });
  }

  return commands;
}

function planNodes(pages: readonly SourcePage[]): GovernorCommand[] {
  const commands: GovernorCommand[] = [];

  for (const page of pages) {
    for (const node of page.children) {
      flattenNodeCommands(node, commands);
    }
  }

  return commands;
}

function flattenNodeCommands(node: SourceNode, commands: GovernorCommand[]): void {
  if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'SECTION' || node.type === 'GROUP') {
    const payload: Record<string, unknown> = {
      name: node.name,
      width: node.width,
      height: node.height,
      x: node.x,
      y: node.y,
    };

    // Auto-layout properties
    if (node.layoutMode && node.layoutMode !== 'NONE') {
      payload.layoutMode = node.layoutMode;
      payload.itemSpacing = node.itemSpacing;
      payload.paddingLeft = node.paddingLeft;
      payload.paddingRight = node.paddingRight;
      payload.paddingTop = node.paddingTop;
      payload.paddingBottom = node.paddingBottom;
    }

    // Fills
    if (node.fills && Array.isArray(node.fills) && node.fills.length > 0) {
      payload.fills = node.fills;
    }

    const cmdType = node.type === 'SECTION' ? 'create_section' : 'create_frame';

    commands.push({
      type: cmdType,
      payload,
      group: 'node-additions',
    });
  }

  if (node.type === 'TEXT') {
    commands.push({
      type: 'create_text',
      payload: {
        name: node.name,
        characters: node.characters || '',
        x: node.x,
        y: node.y,
        width: node.width,
        fontFamily: node.fontName ? (node.fontName as { family: string }).family : 'Inter',
        fontStyle: node.fontName ? (node.fontName as { style: string }).style : 'Regular',
        fontSize: node.fontSize || 14,
      },
      group: 'node-additions',
    });
  }

  if (node.type === 'RECTANGLE') {
    commands.push({
      type: 'create_rectangle',
      payload: {
        name: node.name,
        width: node.width,
        height: node.height,
        x: node.x,
        y: node.y,
        fills: node.fills || [],
        cornerRadius: node.cornerRadius,
      },
      group: 'node-additions',
    });
  }

  // Recurse children
  if (node.children) {
    for (const child of node.children) {
      flattenNodeCommands(child, commands);
    }
  }
}

// ============================================================================
// SECTION 5: HELPERS
// ============================================================================

function isAlias(value: unknown): boolean {
  return typeof value === 'object' && value !== null && (value as Record<string, unknown>)._alias === true;
}

function resolvedTypeToCreateType(resolvedType: string): string {
  const map: Record<string, string> = {
    'COLOR': 'color',
    'FLOAT': 'float',
    'STRING': 'string',
    'BOOLEAN': 'boolean',
  };
  return map[resolvedType] || 'string';
}

/** Merge batch_set_values commands with the same collection+mode into one. */
function mergeBatchSetValues(commands: GovernorCommand[]): GovernorCommand[] {
  const merged = new Map<string, GovernorCommand>();
  for (const cmd of commands) {
    const key = cmd.payload.collectionName + '::' + cmd.payload.mode;
    const existing = merged.get(key);
    if (existing) {
      const existingValues = existing.payload.values as unknown[];
      const newValues = cmd.payload.values as unknown[];
      merged.set(key, {
        ...existing,
        payload: { ...existing.payload, values: [...existingValues, ...newValues] },
      });
    } else {
      merged.set(key, cmd);
    }
  }
  return Array.from(merged.values());
}

/** Merge batch_set_aliases commands with the same collection+mode into one. */
function mergeBatchSetAliases(commands: GovernorCommand[]): GovernorCommand[] {
  const merged = new Map<string, GovernorCommand>();
  for (const cmd of commands) {
    const key = cmd.payload.collectionName + '::' + cmd.payload.mode;
    const existing = merged.get(key);
    if (existing) {
      const existingAliases = existing.payload.aliases as unknown[];
      const newAliases = cmd.payload.aliases as unknown[];
      merged.set(key, {
        ...existing,
        payload: { ...existing.payload, aliases: [...existingAliases, ...newAliases] },
      });
    } else {
      merged.set(key, cmd);
    }
  }
  return Array.from(merged.values());
}

function buildSummary(
  source: DeepExtractData,
  phases: readonly ReplicationPhase[],
  totalCommands: number,
): string {
  const lines = [
    'Replication plan for "' + source.fileName + '"',
    '',
    'Source stats:',
    '  Collections: ' + source.collections.length,
    '  Variables: ' + source.variables.length,
    '  Paint styles: ' + source.paintStyles.length,
    '  Text styles: ' + source.textStyles.length,
    '  Effect styles: ' + source.effectStyles.length,
    '  Pages: ' + source.pages.length,
    '',
    'Plan: ' + phases.length + ' phases, ' + totalCommands + ' total commands',
    '',
  ];

  for (const phase of phases) {
    lines.push('  ' + phase.name + ': ' + phase.commands.length + ' commands');
  }

  return lines.join('\n');
}
