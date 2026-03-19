/**
 * Variables API — Wrappers for Figma Variable and VariableCollection operations.
 *
 * All functions are async-safe and return Result types.
 * Must be ES2017-compatible (runs inside Figma's QuickJS sandbox).
 *
 * @module figma-api/variables
 */

import type { Result } from '@dsb/guardrails';
import { Result as R } from '@dsb/guardrails';

// ============================================================================
// SECTION 1: COLLECTION OPERATIONS
// ============================================================================

/**
 * Create a new variable collection.
 *
 * @param name - Collection name (e.g., "Primitives", "Semantic").
 */
export function createCollection(name: string): Result<VariableCollection, string> {
  try {
    var collection = figma.variables.createVariableCollection(name);
    return R.ok(collection);
  } catch (e) {
    return R.err('Failed to create collection "' + name + '": ' + String(e));
  }
}

/**
 * Get all local variable collections.
 */
export async function getCollections(): Promise<Result<VariableCollection[], string>> {
  try {
    var collections = await figma.variables.getLocalVariableCollectionsAsync();
    return R.ok(collections);
  } catch (e) {
    return R.err('Failed to get collections: ' + String(e));
  }
}

/**
 * Get a variable collection by its ID.
 */
export async function getCollectionById(
  collectionId: string
): Promise<Result<VariableCollection, string>> {
  try {
    var collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    if (!collection) {
      return R.err('Collection not found: ' + collectionId);
    }
    return R.ok(collection);
  } catch (e) {
    return R.err('Failed to get collection "' + collectionId + '": ' + String(e));
  }
}

/**
 * Find a collection by name. Returns the first match.
 */
export async function findCollectionByName(
  name: string
): Promise<Result<VariableCollection | null, string>> {
  var collectionsResult = await getCollections();
  if (!collectionsResult.ok) return collectionsResult;

  var match = collectionsResult.value.find(function(c) { return c.name === name; });
  return R.ok(match || null);
}

/**
 * Delete a variable collection by removing all its variables first, then the collection.
 */
export async function deleteCollection(
  collectionId: string
): Promise<Result<void, string>> {
  try {
    var variables = await figma.variables.getLocalVariablesAsync();
    var collectionVars = variables.filter(function(v) {
      return v.variableCollectionId === collectionId;
    });

    for (var i = 0; i < collectionVars.length; i++) {
      collectionVars[i]!.remove();
    }

    var collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    if (collection) {
      collection.remove();
    }
    return R.ok(undefined);
  } catch (e) {
    return R.err('Failed to delete collection: ' + String(e));
  }
}

// ============================================================================
// SECTION 2: MODE OPERATIONS
// ============================================================================

/**
 * Add a mode to a collection.
 *
 * @param collection - The target collection.
 * @param name - Mode name (e.g., "Light", "Dark", "Desktop").
 * @returns The new mode ID.
 */
export function addMode(
  collection: VariableCollection,
  name: string
): Result<string, string> {
  try {
    var modeId = collection.addMode(name);
    return R.ok(modeId);
  } catch (e) {
    return R.err(
      'Failed to add mode "' + name + '" to collection "' + collection.name + '": ' + String(e)
    );
  }
}

/**
 * Rename the first (default) mode of a collection.
 *
 * Figma collections always start with one default mode.
 * This renames it to a meaningful name (e.g., "Value" for Primitives).
 */
export function renameDefaultMode(
  collection: VariableCollection,
  name: string
): Result<void, string> {
  try {
    if (collection.modes.length === 0) {
      return R.err('Collection "' + collection.name + '" has no modes.');
    }
    collection.renameMode(collection.modes[0]!.modeId, name);
    return R.ok(undefined);
  } catch (e) {
    return R.err('Failed to rename default mode: ' + String(e));
  }
}

/**
 * Get mode ID by name from a collection.
 */
export function getModeId(
  collection: VariableCollection,
  modeName: string
): Result<string, string> {
  for (var i = 0; i < collection.modes.length; i++) {
    if (collection.modes[i]!.name === modeName) {
      return R.ok(collection.modes[i]!.modeId);
    }
  }
  return R.err(
    'Mode "' + modeName + '" not found in collection "' + collection.name + '". ' +
    'Available modes: ' + collection.modes.map(function(m) { return m.name; }).join(', ')
  );
}

// ============================================================================
// SECTION 3: VARIABLE OPERATIONS
// ============================================================================

/** Map DSB variable types to Figma resolved types. */
var TYPE_MAP: Record<string, VariableResolvedDataType> = {
  color: 'COLOR',
  float: 'FLOAT',
  string: 'STRING',
  boolean: 'BOOLEAN',
};

/**
 * Create a new variable in a collection.
 *
 * @param name - Variable name (e.g., "color/primary-500").
 * @param collection - The target collection.
 * @param type - DSB variable type ("color", "float", "string", "boolean").
 */
export function createVariable(
  name: string,
  collection: VariableCollection,
  type: string
): Result<Variable, string> {
  var resolvedType = TYPE_MAP[type];
  if (!resolvedType) {
    return R.err(
      'Unknown variable type "' + type + '". Expected: color, float, string, boolean.'
    );
  }

  try {
    var variable = figma.variables.createVariable(name, collection, resolvedType);
    return R.ok(variable);
  } catch (e) {
    return R.err('Failed to create variable "' + name + '": ' + String(e));
  }
}

/**
 * Get a variable by its ID.
 */
export async function getVariableById(
  variableId: string
): Promise<Result<Variable, string>> {
  try {
    var variable = await figma.variables.getVariableByIdAsync(variableId);
    if (!variable) {
      return R.err('Variable not found: ' + variableId);
    }
    return R.ok(variable);
  } catch (e) {
    return R.err('Failed to get variable: ' + String(e));
  }
}

/**
 * Get all local variables, optionally filtered by collection.
 */
export async function getVariables(
  collectionId?: string
): Promise<Result<Variable[], string>> {
  try {
    var variables = await figma.variables.getLocalVariablesAsync();
    if (collectionId) {
      variables = variables.filter(function(v) {
        return v.variableCollectionId === collectionId;
      });
    }
    return R.ok(variables);
  } catch (e) {
    return R.err('Failed to get variables: ' + String(e));
  }
}

/**
 * Find a variable by name within a collection.
 */
export async function findVariableByName(
  name: string,
  collectionId: string
): Promise<Result<Variable | null, string>> {
  var varsResult = await getVariables(collectionId);
  if (!varsResult.ok) return varsResult;

  var match = varsResult.value.find(function(v) { return v.name === name; });
  return R.ok(match || null);
}

/**
 * Delete a variable.
 */
export function deleteVariable(variable: Variable): Result<void, string> {
  try {
    variable.remove();
    return R.ok(undefined);
  } catch (e) {
    return R.err('Failed to delete variable "' + variable.name + '": ' + String(e));
  }
}

// ============================================================================
// SECTION 4: VALUE OPERATIONS
// ============================================================================

/**
 * Set a raw value for a variable in a specific mode.
 *
 * @param variable - The target variable.
 * @param modeId - The mode ID to set the value for.
 * @param value - The value (color RGBA 0-1, number, string, or boolean).
 */
export function setVariableValue(
  variable: Variable,
  modeId: string,
  value: RGBA | string | number | boolean
): Result<void, string> {
  try {
    variable.setValueForMode(modeId, value);
    return R.ok(undefined);
  } catch (e) {
    return R.err(
      'Failed to set value for "' + variable.name + '" in mode "' + modeId + '": ' + String(e)
    );
  }
}

/**
 * Set a variable alias (reference to another variable) for a specific mode.
 *
 * @param variable - The variable to set the alias on.
 * @param modeId - The mode ID.
 * @param targetVariable - The variable to alias to.
 */
export function setVariableAlias(
  variable: Variable,
  modeId: string,
  targetVariable: Variable
): Result<void, string> {
  try {
    var alias = figma.variables.createVariableAlias(targetVariable);
    variable.setValueForMode(modeId, alias);
    return R.ok(undefined);
  } catch (e) {
    return R.err(
      'Failed to set alias on "' + variable.name + '" → "' + targetVariable.name + '": ' + String(e)
    );
  }
}

// ============================================================================
// SECTION 5: SCOPE & METADATA
// ============================================================================

/**
 * Set scopes on a variable.
 *
 * @param variable - The target variable.
 * @param scopes - Array of scope strings (e.g., ["ALL_FILLS", "STROKE_COLOR"]).
 */
export function setScopes(
  variable: Variable,
  scopes: string[]
): Result<void, string> {
  try {
    variable.scopes = scopes as VariableScope[];
    return R.ok(undefined);
  } catch (e) {
    return R.err('Failed to set scopes on "' + variable.name + '": ' + String(e));
  }
}

/**
 * Set description on a variable.
 */
export function setDescription(
  variable: Variable,
  description: string
): Result<void, string> {
  try {
    variable.description = description;
    return R.ok(undefined);
  } catch (e) {
    return R.err('Failed to set description on "' + variable.name + '": ' + String(e));
  }
}

/**
 * Set hideFromPublishing on a variable.
 */
export function setHideFromPublishing(
  variable: Variable,
  hide: boolean
): Result<void, string> {
  try {
    variable.hiddenFromPublishing = hide;
    return R.ok(undefined);
  } catch (e) {
    return R.err('Failed to set hideFromPublishing on "' + variable.name + '": ' + String(e));
  }
}

// ============================================================================
// SECTION 6: BATCH OPERATIONS
// ============================================================================

/**
 * Batch create variables in a collection.
 *
 * Processes in chunks of 50 with yielding between chunks to avoid
 * blocking the Figma event loop.
 */
export async function batchCreateVariables(
  specs: ReadonlyArray<{ name: string; type: string }>,
  collection: VariableCollection
): Promise<Result<Variable[], string>> {
  var CHUNK_SIZE = 50;
  var created: Variable[] = [];

  for (var i = 0; i < specs.length; i += CHUNK_SIZE) {
    var chunk = specs.slice(i, i + CHUNK_SIZE);
    for (var j = 0; j < chunk.length; j++) {
      var spec = chunk[j]!;
      var result = createVariable(spec.name, collection, spec.type);
      if (!result.ok) return result;
      created.push(result.value);
    }
    // Yield to Figma's event loop between chunks
    await new Promise(function(resolve) { setTimeout(resolve, 0); });
  }

  return R.ok(created);
}

/**
 * Batch set aliases on variables.
 *
 * @param aliases - Array of { variable, modeId, targetVariable } to set.
 */
export async function batchSetAliases(
  aliases: ReadonlyArray<{
    variable: Variable;
    modeId: string;
    targetVariable: Variable;
  }>
): Promise<Result<void, string>> {
  var CHUNK_SIZE = 50;

  for (var i = 0; i < aliases.length; i += CHUNK_SIZE) {
    var chunk = aliases.slice(i, i + CHUNK_SIZE);
    for (var j = 0; j < chunk.length; j++) {
      var alias = chunk[j]!;
      var result = setVariableAlias(alias.variable, alias.modeId, alias.targetVariable);
      if (!result.ok) return result;
    }
    await new Promise(function(resolve) { setTimeout(resolve, 0); });
  }

  return R.ok(undefined);
}
