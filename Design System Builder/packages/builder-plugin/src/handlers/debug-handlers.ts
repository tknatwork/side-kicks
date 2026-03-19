/**
 * Debug Handlers — console buffer, clear, reload.
 * ES2017-compatible (QuickJS sandbox).
 * @module builder-plugin/handlers/debug-handlers
 */

import type { CommandResult, PollCommand } from '../polling';

export async function handleGetConsoleBuffer(cmd: PollCommand): Promise<CommandResult> {
  // Delegate to UI iframe which owns the console buffer
  return new Promise(function(resolve) {
    var commandId = cmd.id;
    var filter = (cmd.payload.filter as string) || '';
    var limit = (cmd.payload.limit as number) || 200;
    figma.ui.postMessage({ type: 'get-console-buffer', commandId: commandId, filter: filter, limit: limit });
    // The UI will respond with a command-result message — handled by the existing onmessage flow
    // For now return a placeholder; the actual buffer data flows through the UI relay
    resolve({ commandId: commandId, success: true, data: { note: 'Console buffer request sent to UI' } });
  });
}

export async function handleClearConsole(cmd: PollCommand): Promise<CommandResult> {
  figma.ui.postMessage({ type: 'clear-console-buffer', commandId: cmd.id });
  return { commandId: cmd.id, success: true };
}

export async function handleReloadPage(cmd: PollCommand): Promise<CommandResult> {
  var currentPage = figma.currentPage;
  var pageId = currentPage.id;
  var pageName = currentPage.name;
  // Force a re-render by briefly switching pages if possible
  var pages = figma.root.children;
  if (pages.length > 1) {
    var otherPage = pages[0]!.id === pageId ? pages[1]! : pages[0]!;
    figma.currentPage = otherPage;
    figma.currentPage = currentPage;
  }
  return { commandId: cmd.id, success: true, data: { pageId: pageId, pageName: pageName } };
}
