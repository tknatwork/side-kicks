/**
 * Batch Handlers — Command handlers for batch value/alias operations.
 *
 * These handlers resolve variables by name (not ID) so the build
 * orchestrator can reference variables without needing to track IDs
 * across commands.
 *
 * ES2017-compatible (QuickJS sandbox).
 *
 * @module builder-plugin/handlers/batch-handlers
 */

import type { CommandResult, PollCommand } from '../polling';
import * as api from '@dsb/figma-api';

// ============================================================================
// SECTION 1: BATCH SET VALUES
// ============================================================================

/**
 * Batch set primitive values on variables in a collection by name.
 *
 * Payload:
 *   collectionName: string — name of the target collection
 *   mode: string — mode name to set values for
 *   values: Array<{ name: string; value: unknown }> — variable name + raw value
 */
export async function handleBatchSetValues(
  cmd: PollCommand
): Promise<CommandResult> {
  var collectionName = cmd.payload.collectionName as string;
  var modeName = cmd.payload.mode as string;
  var values = cmd.payload.values as Array<{ name: string; value: unknown }>;

  var collResult = await api.findCollectionByName(collectionName);
  if (!collResult.ok) {
    return { commandId: cmd.id, success: false, error: collResult.error };
  }
  if (!collResult.value) {
    return { commandId: cmd.id, success: false, error: 'Collection not found: ' + collectionName };
  }
  var collection = collResult.value;

  var modeResult = api.getModeId(collection, modeName);
  if (!modeResult.ok) {
    return { commandId: cmd.id, success: false, error: modeResult.error };
  }
  var modeId = modeResult.value;

  var setCount = 0;
  var errors: string[] = [];
  for (var i = 0; i < values.length; i++) {
    var entry = values[i]!;
    var varResult = await api.findVariableByName(entry.name, collection.id);
    if (!varResult.ok || !varResult.value) {
      errors.push(entry.name + ': ' + (varResult.ok ? 'not found' : varResult.error));
      continue;
    }
    var setResult = api.setVariableValue(
      varResult.value,
      modeId,
      entry.value as RGBA | string | number | boolean
    );
    if (!setResult.ok) {
      errors.push(entry.name + ': ' + setResult.error);
      continue;
    }
    setCount++;
  }

  if (errors.length > 0 && setCount === 0) {
    return { commandId: cmd.id, success: false, error: 'All values failed: ' + errors.join('; ') };
  }

  return {
    commandId: cmd.id,
    success: true,
    data: { set: setCount, failed: errors.length, errors: errors.length > 0 ? errors : undefined },
  };
}

// ============================================================================
// SECTION 2: BATCH SET ALIASES
// ============================================================================

/**
 * Batch set alias references on variables in a collection by name.
 *
 * Payload:
 *   collectionName: string — name of the source collection
 *   mode: string — mode name
 *   aliases: Array<{ name: string; targetName: string; targetCollection: string }>
 */
export async function handleBatchSetAliases(
  cmd: PollCommand
): Promise<CommandResult> {
  var collectionName = cmd.payload.collectionName as string;
  var modeName = cmd.payload.mode as string;
  var aliases = cmd.payload.aliases as Array<{
    name: string;
    targetName: string;
    targetCollection: string;
  }>;

  var collResult = await api.findCollectionByName(collectionName);
  if (!collResult.ok) {
    return { commandId: cmd.id, success: false, error: collResult.error };
  }
  if (!collResult.value) {
    return { commandId: cmd.id, success: false, error: 'Collection not found: ' + collectionName };
  }
  var collection = collResult.value;

  var modeResult = api.getModeId(collection, modeName);
  if (!modeResult.ok) {
    return { commandId: cmd.id, success: false, error: modeResult.error };
  }
  var modeId = modeResult.value;

  var setCount = 0;
  var errors: string[] = [];
  for (var i = 0; i < aliases.length; i++) {
    var entry = aliases[i]!;

    var varResult = await api.findVariableByName(entry.name, collection.id);
    if (!varResult.ok || !varResult.value) {
      errors.push(entry.name + ': ' + (varResult.ok ? 'not found' : varResult.error));
      continue;
    }

    var targetCollResult = await api.findCollectionByName(entry.targetCollection);
    if (!targetCollResult.ok || !targetCollResult.value) {
      errors.push(entry.name + ' -> ' + entry.targetCollection + ': ' + (targetCollResult.ok ? 'not found' : targetCollResult.error));
      continue;
    }
    var targetVarResult = await api.findVariableByName(entry.targetName, targetCollResult.value.id);
    if (!targetVarResult.ok || !targetVarResult.value) {
      errors.push(entry.name + ' -> ' + entry.targetName + ': ' + (targetVarResult.ok ? 'not found' : targetVarResult.error));
      continue;
    }

    var setResult = api.setVariableAlias(varResult.value, modeId, targetVarResult.value);
    if (!setResult.ok) {
      errors.push(entry.name + ': ' + setResult.error);
      continue;
    }
    setCount++;
  }

  if (errors.length > 0 && setCount === 0) {
    return { commandId: cmd.id, success: false, error: 'All aliases failed: ' + errors.join('; ') };
  }

  return {
    commandId: cmd.id,
    success: true,
    data: { set: setCount, failed: errors.length, errors: errors.length > 0 ? errors : undefined },
  };
}
