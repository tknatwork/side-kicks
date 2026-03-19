/**
 * Token Handlers — Command handlers for variable/collection operations.
 *
 * Each handler takes a command payload and delegates to @dsb/figma-api.
 * ES2017-compatible.
 *
 * @module builder-plugin/handlers/token-handlers
 */

import type { CommandResult, PollCommand } from '../polling';
import * as api from '@dsb/figma-api';

// ============================================================================
// SECTION 1: COLLECTION HANDLERS
// ============================================================================

export async function handleCreateCollection(
  cmd: PollCommand
): Promise<CommandResult> {
  var name = cmd.payload.name as string;
  var modes = cmd.payload.modes as string[];

  var result = api.createCollection(name);
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  var collection = result.value;

  // Rename default mode
  if (modes && modes.length > 0) {
    var renameResult = api.renameDefaultMode(collection, modes[0]!);
    if (!renameResult.ok) {
      return { commandId: cmd.id, success: false, error: renameResult.error };
    }

    // Add additional modes
    for (var i = 1; i < modes.length; i++) {
      var addResult = api.addMode(collection, modes[i]!);
      if (!addResult.ok) {
        return { commandId: cmd.id, success: false, error: addResult.error };
      }
    }
  }

  return {
    commandId: cmd.id,
    success: true,
    data: { collectionId: collection.id, name: collection.name },
  };
}

export async function handleGetCollections(
  cmd: PollCommand
): Promise<CommandResult> {
  var result = await api.getCollections();
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  var data = result.value.map(function(c) {
    return {
      id: c.id,
      name: c.name,
      modes: c.modes.map(function(m) { return { modeId: m.modeId, name: m.name }; }),
    };
  });

  return { commandId: cmd.id, success: true, data: data };
}

export async function handleDeleteCollection(
  cmd: PollCommand
): Promise<CommandResult> {
  var collectionId = cmd.payload.collectionId as string;
  var result = await api.deleteCollection(collectionId);
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }
  return { commandId: cmd.id, success: true };
}

// ============================================================================
// SECTION 2: VARIABLE HANDLERS
// ============================================================================

export async function handleBatchCreateVariables(
  cmd: PollCommand
): Promise<CommandResult> {
  var collectionId = cmd.payload.collectionId as string;
  var variables = cmd.payload.variables as Array<{ name: string; type: string }>;

  var collResult = await api.getCollectionById(collectionId);
  if (!collResult.ok) {
    return { commandId: cmd.id, success: false, error: collResult.error };
  }

  var result = await api.batchCreateVariables(variables, collResult.value);
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  var data = result.value.map(function(v) {
    return { id: v.id, name: v.name };
  });

  return { commandId: cmd.id, success: true, data: data };
}

export async function handleSetVariableValue(
  cmd: PollCommand
): Promise<CommandResult> {
  var variableId = cmd.payload.variableId as string;
  var modeId = cmd.payload.modeId as string;
  var value = cmd.payload.value;

  var varResult = await api.getVariableById(variableId);
  if (!varResult.ok) {
    return { commandId: cmd.id, success: false, error: varResult.error };
  }

  var result = api.setVariableValue(
    varResult.value,
    modeId,
    value as RGBA | string | number | boolean
  );
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  return { commandId: cmd.id, success: true };
}

export async function handleSetVariableAlias(
  cmd: PollCommand
): Promise<CommandResult> {
  var variableId = cmd.payload.variableId as string;
  var modeId = cmd.payload.modeId as string;
  var targetVariableId = cmd.payload.targetVariableId as string;

  var varResult = await api.getVariableById(variableId);
  if (!varResult.ok) {
    return { commandId: cmd.id, success: false, error: varResult.error };
  }

  var targetResult = await api.getVariableById(targetVariableId);
  if (!targetResult.ok) {
    return { commandId: cmd.id, success: false, error: targetResult.error };
  }

  var result = api.setVariableAlias(varResult.value, modeId, targetResult.value);
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  return { commandId: cmd.id, success: true };
}

export async function handleSetScopes(
  cmd: PollCommand
): Promise<CommandResult> {
  var variableId = cmd.payload.variableId as string;
  var scopes = cmd.payload.scopes as string[];

  var varResult = await api.getVariableById(variableId);
  if (!varResult.ok) {
    return { commandId: cmd.id, success: false, error: varResult.error };
  }

  var result = api.setScopes(varResult.value, scopes);
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  return { commandId: cmd.id, success: true };
}

export async function handleGetVariables(
  cmd: PollCommand
): Promise<CommandResult> {
  var collectionId = cmd.payload.collectionId as string | undefined;
  var result = await api.getVariables(collectionId);
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  var data = result.value.map(function(v) {
    return {
      id: v.id,
      name: v.name,
      type: v.resolvedType,
      collectionId: v.variableCollectionId,
    };
  });

  return { commandId: cmd.id, success: true, data: data };
}
