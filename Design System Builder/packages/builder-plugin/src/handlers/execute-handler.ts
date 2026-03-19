/**
 * Execute Handler — run arbitrary Figma Plugin API code.
 * ES2017-compatible (QuickJS sandbox).
 * @module builder-plugin/handlers/execute-handler
 */

import type { CommandResult, PollCommand } from '../polling';

export async function handleExecuteCode(cmd: PollCommand): Promise<CommandResult> {
  var code = cmd.payload.code as string;
  if (!code || code.trim().length === 0) {
    return { commandId: cmd.id, success: false, error: 'No code provided' };
  }
  try {
    // Use Function constructor to evaluate code with access to figma global
    var fn = new Function('figma', code);
    var result = fn(figma);
    // Handle async results
    if (result && typeof result === 'object' && typeof result.then === 'function') {
      result = await result;
    }
    return {
      commandId: cmd.id,
      success: true,
      data: { result: result !== undefined ? JSON.parse(JSON.stringify(result)) : null },
    };
  } catch (e) {
    return { commandId: cmd.id, success: false, error: 'Execution error: ' + String(e) };
  }
}
