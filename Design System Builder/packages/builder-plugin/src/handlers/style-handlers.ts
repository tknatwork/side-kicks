/**
 * Style Handlers — Command handlers for Figma style operations.
 *
 * ES2017-compatible.
 *
 * @module builder-plugin/handlers/style-handlers
 */

import type { CommandResult, PollCommand } from '../polling';
import * as api from '@dsb/figma-api';

export async function handleCreateColorStyle(
  cmd: PollCommand
): Promise<CommandResult> {
  var name = cmd.payload.name as string;
  var color = cmd.payload.color as RGBA;

  var result = api.createColorStyle(name, color);
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  return {
    commandId: cmd.id,
    success: true,
    data: { styleId: result.value.id, name: result.value.name },
  };
}

export async function handleCreateTextStyle(
  cmd: PollCommand
): Promise<CommandResult> {
  var config = cmd.payload as unknown as api.TextStyleConfig;

  var result = await api.createTextStyle(config);
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  return {
    commandId: cmd.id,
    success: true,
    data: { styleId: result.value.id, name: result.value.name },
  };
}

export async function handleCreateEffectStyle(
  cmd: PollCommand
): Promise<CommandResult> {
  var config = cmd.payload as unknown as api.ShadowConfig;

  var result = api.createEffectStyle(config);
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  return {
    commandId: cmd.id,
    success: true,
    data: { styleId: result.value.id, name: result.value.name },
  };
}

export async function handleCreateGridStyle(
  cmd: PollCommand
): Promise<CommandResult> {
  var config = cmd.payload as unknown as api.GridConfig;

  var result = api.createGridStyle(config);
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  return {
    commandId: cmd.id,
    success: true,
    data: { styleId: result.value.id, name: result.value.name },
  };
}

export async function handleGetStyles(
  cmd: PollCommand
): Promise<CommandResult> {
  var colorResult = await api.getColorStyles();
  var textResult = await api.getTextStyles();
  var effectResult = await api.getEffectStyles();

  if (!colorResult.ok) return { commandId: cmd.id, success: false, error: colorResult.error };
  if (!textResult.ok) return { commandId: cmd.id, success: false, error: textResult.error };
  if (!effectResult.ok) return { commandId: cmd.id, success: false, error: effectResult.error };

  return {
    commandId: cmd.id,
    success: true,
    data: {
      colorStyles: colorResult.value.map(function(s) { return { id: s.id, name: s.name }; }),
      textStyles: textResult.value.map(function(s) { return { id: s.id, name: s.name }; }),
      effectStyles: effectResult.value.map(function(s) { return { id: s.id, name: s.name }; }),
    },
  };
}
