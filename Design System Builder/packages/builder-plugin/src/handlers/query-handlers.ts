/**
 * Query Handlers — Command handlers for read-only Figma file queries.
 *
 * ES2017-compatible.
 *
 * @module builder-plugin/handlers/query-handlers
 */

import type { CommandResult, PollCommand } from '../polling';
import * as api from '@dsb/figma-api';

export async function handleGetFileInfo(
  cmd: PollCommand
): Promise<CommandResult> {
  var result = await api.getFileInfo();
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  return {
    commandId: cmd.id,
    success: true,
    data: result.value,
  };
}

export async function handleGetCollectionDetails(
  cmd: PollCommand
): Promise<CommandResult> {
  var result = await api.getCollectionDetails();
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  return {
    commandId: cmd.id,
    success: true,
    data: { collections: result.value },
  };
}

export async function handleGetSelectionInfo(
  cmd: PollCommand
): Promise<CommandResult> {
  var result = api.getSelectionInfo();
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  return {
    commandId: cmd.id,
    success: true,
    data: result.value,
  };
}

export async function handleCheckFonts(
  cmd: PollCommand
): Promise<CommandResult> {
  var fonts = cmd.payload.fonts as Array<{ family: string; style: string }>;

  var results = await api.checkFontsAvailability(fonts);
  var missing = await api.getMissingFonts(fonts);

  return {
    commandId: cmd.id,
    success: true,
    data: {
      results: results,
      missing: missing,
      allAvailable: missing.length === 0,
    },
  };
}

export async function handleLoadFont(
  cmd: PollCommand
): Promise<CommandResult> {
  var family = cmd.payload.family as string;
  var style = (cmd.payload.style as string) || 'Regular';

  var result = await api.loadFont(family, style);
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  return { commandId: cmd.id, success: true };
}

export async function handleLoadFonts(
  cmd: PollCommand
): Promise<CommandResult> {
  var fonts = cmd.payload.fonts as Array<{ family: string; style: string }>;

  var result = await api.loadFonts(fonts);
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  return { commandId: cmd.id, success: true };
}
