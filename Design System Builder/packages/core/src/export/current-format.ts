/**
 * Current JSON Format — Backwards-compatible with Variables & Styles Extractor.
 *
 * Exports variable collections in the nested JSON format that the
 * Extractor uses. This means existing users can import DSB exports
 * directly into the Extractor's import flow.
 *
 * @module export/current-format
 */

import type {
  VariableDefinition,
  VariableValue,
  AliasReference,
  CollectionExport,
  NestedVariables,
  ExportVariableValue,
  TierArchitecture,
  ColorValue,
  TierLevel,
} from '../tokens/schema';
import type { Result } from '@dsb/guardrails';
import { Result as R } from '@dsb/guardrails';
import { isAlias } from '../tokens/three-tier-engine';

// ============================================================================
// SECTION 1: EXPORT
// ============================================================================

/**
 * Export variables to the current JSON format (Extractor-compatible).
 *
 * @param variables - All variable definitions to export.
 * @param tiers - The tier architecture (for collection names and modes).
 */
export function exportCurrentFormat(
  variables: ReadonlyArray<VariableDefinition>,
  tiers: TierArchitecture
): Result<CollectionExport, string> {
  const output: Record<string, { modes: Record<string, NestedVariables> }> = {};

  // Group variables by tier → collection
  const grouped = groupByTier(variables);

  // Build each collection
  const tierConfigs = [tiers.primitives, tiers.semantic, tiers.component];
  if (tiers.breakpoints) tierConfigs.push(tiers.breakpoints);

  for (const config of tierConfigs) {
    const tierVars = grouped[config.tier] || [];
    if (tierVars.length === 0) continue;

    const modes: Record<string, NestedVariables> = {};

    for (const modeName of config.modes) {
      const nested: Record<string, ExportVariableValue | NestedVariables> = {};

      for (const variable of tierVars) {
        const value = variable.values[modeName];
        if (value === undefined) continue;

        const exportValue = toExportValue(variable, value);
        setNestedPath(nested, variable.name, exportValue);
      }

      modes[modeName] = nested;
    }

    output[config.collectionName] = { modes };
  }

  return R.ok(output as CollectionExport);
}

/**
 * Convert a variable + value pair into the export format.
 */
function toExportValue(
  variable: VariableDefinition,
  value: VariableValue
): ExportVariableValue {
  if (isAlias(value)) {
    // Alias: $value is a string reference like "{collection/variable-name}"
    return {
      $scopes: variable.scopes as string[],
      $type: variable.type,
      $description: variable.description,
      $value: `{${value.collection}/${value.target}}`,
      $collectionName: value.collection,
    };
  }

  // Primitive value
  return {
    $scopes: variable.scopes as string[],
    $type: variable.type,
    $description: variable.description,
    $value: value as string | number | boolean | ColorValue,
  };
}

/**
 * Set a value at a nested path (e.g., "color/primary-500" → { color: { "primary-500": value } }).
 */
function setNestedPath(
  root: Record<string, ExportVariableValue | NestedVariables>,
  path: string,
  value: ExportVariableValue
): void {
  const segments = path.split('/');
  let current: Record<string, ExportVariableValue | NestedVariables> = root;

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i]!;
    if (!(segment in current) || isLeafValue(current[segment])) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, ExportVariableValue | NestedVariables>;
  }

  const lastSegment = segments[segments.length - 1]!;
  current[lastSegment] = value;
}

function isLeafValue(value: unknown): value is ExportVariableValue {
  return typeof value === 'object' && value !== null && '$type' in value;
}

function groupByTier(
  variables: ReadonlyArray<VariableDefinition>
): Record<TierLevel, VariableDefinition[]> {
  const grouped: Record<string, VariableDefinition[]> = {
    primitives: [],
    semantic: [],
    component: [],
    breakpoints: [],
  };
  for (const v of variables) {
    if (grouped[v.tier]) {
      grouped[v.tier]!.push(v);
    }
  }
  return grouped as Record<TierLevel, VariableDefinition[]>;
}

// ============================================================================
// SECTION 2: IMPORT
// ============================================================================

/**
 * Import variables from the current JSON format (Extractor-compatible).
 *
 * @param data - The CollectionExport JSON data.
 * @param tierMapping - Maps collection names to tier levels.
 */
export function importCurrentFormat(
  data: CollectionExport,
  tierMapping: Readonly<Record<string, TierLevel>>
): Result<VariableDefinition[], string> {
  const variables: VariableDefinition[] = [];
  const errors: string[] = [];

  for (const [collectionName, collection] of Object.entries(data)) {
    const tier = tierMapping[collectionName];
    if (!tier) {
      errors.push(
        `Collection "${collectionName}" is not in the tier mapping. ` +
        `Known collections: ${Object.keys(tierMapping).join(', ')}.`
      );
      continue;
    }

    const modeNames = Object.keys(collection.modes);
    if (modeNames.length === 0) {
      errors.push(`Collection "${collectionName}" has no modes.`);
      continue;
    }

    // Extract variable definitions from the first mode, then fill values from all modes
    const firstMode = modeNames[0]!;
    const paths = extractPaths(collection.modes[firstMode]!, '');

    for (const { path, value: firstModeValue } of paths) {
      const values: Record<string, VariableValue> = {};

      for (const modeName of modeNames) {
        const modeData = collection.modes[modeName]!;
        const modeExportValue = getNestedPath(modeData, path);
        if (!modeExportValue) continue;

        values[modeName] = fromExportValue(modeExportValue);
      }

      variables.push({
        name: path,
        type: firstModeValue.$type,
        description: firstModeValue.$description,
        scopes: firstModeValue.$scopes,
        values,
        tier,
      });
    }
  }

  if (errors.length > 0) {
    return R.err(errors.join('\n'));
  }
  return R.ok(variables);
}

interface PathEntry {
  path: string;
  value: ExportVariableValue;
}

function extractPaths(
  node: NestedVariables,
  prefix: string
): PathEntry[] {
  const results: PathEntry[] = [];

  for (const [key, value] of Object.entries(node)) {
    const fullPath = prefix ? `${prefix}/${key}` : key;

    if (isLeafValue(value)) {
      results.push({ path: fullPath, value: value as ExportVariableValue });
    } else {
      results.push(...extractPaths(value as NestedVariables, fullPath));
    }
  }

  return results;
}

function getNestedPath(
  node: NestedVariables,
  path: string
): ExportVariableValue | null {
  const segments = path.split('/');
  let current: NestedVariables | ExportVariableValue = node;

  for (const segment of segments) {
    if (typeof current !== 'object' || current === null) return null;
    if ('$type' in current) return null; // Hit a leaf too early
    const next: NestedVariables[string] | undefined = (current as NestedVariables)[segment];
    if (next === undefined) return null;
    current = next;
  }

  if (isLeafValue(current)) {
    return current as ExportVariableValue;
  }
  return null;
}

/**
 * Convert an export value back to a VariableValue.
 */
function fromExportValue(exportValue: ExportVariableValue): VariableValue {
  const rawValue = exportValue.$value;

  // Check if it's an alias reference: "{CollectionName/variable-name}"
  if (typeof rawValue === 'string' && rawValue.startsWith('{') && rawValue.endsWith('}')) {
    const ref = rawValue.slice(1, -1); // Remove braces
    const slashIndex = ref.indexOf('/');
    if (slashIndex > 0) {
      return {
        type: 'alias',
        collection: ref.slice(0, slashIndex),
        target: ref.slice(slashIndex + 1),
      };
    }
  }

  return rawValue;
}
