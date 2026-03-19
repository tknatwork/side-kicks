/**
 * File role toggle handler for the plugin sandbox.
 * ES2017 compatible (Figma QuickJS).
 *
 * @module handlers/role-handler
 */

import type { PollCommand, CommandResult } from '../polling';

type FileRole = 'source' | 'destination' | 'source+destination';

var currentRole: FileRole = 'source+destination';

export async function handleSetFileRole(cmd: PollCommand): Promise<CommandResult> {
  var role = (cmd.payload.role as FileRole) || 'source+destination';
  currentRole = role;
  return { commandId: cmd.id, success: true, data: { role: currentRole } };
}

export async function handleGetFileRole(cmd: PollCommand): Promise<CommandResult> {
  return { commandId: cmd.id, success: true, data: { role: currentRole } };
}

export function getCurrentRole(): FileRole {
  return currentRole;
}
