/**
 * Image Handlers — export node image, take screenshot.
 * ES2017-compatible (QuickJS sandbox).
 * @module builder-plugin/handlers/image-handlers
 */

import type { CommandResult, PollCommand } from '../polling';

export async function handleExportNodeImage(cmd: PollCommand): Promise<CommandResult> {
  var nodeId = cmd.payload.nodeId as string;
  var format = (cmd.payload.format as string || 'PNG').toUpperCase();
  var scale = (cmd.payload.scale as number) || 2;
  var node = figma.getNodeById(nodeId) as SceneNode | null;
  if (!node) {
    return { commandId: cmd.id, success: false, error: 'Node not found: ' + nodeId };
  }
  if (!('exportAsync' in node)) {
    return { commandId: cmd.id, success: false, error: 'Node does not support export: ' + nodeId };
  }
  var settings: ExportSettings;
  if (format === 'SVG') {
    settings = { format: 'SVG' };
  } else if (format === 'PDF') {
    settings = { format: 'PDF' };
  } else {
    settings = { format: 'PNG', constraint: { type: 'SCALE', value: scale } };
  }
  var bytes = await node.exportAsync(settings);
  var base64 = figma.base64Encode(bytes);
  return {
    commandId: cmd.id,
    success: true,
    data: { base64: base64, format: format, byteLength: bytes.byteLength },
  };
}

export async function handleTakeScreenshot(cmd: PollCommand): Promise<CommandResult> {
  var nodeId = cmd.payload.nodeId as string | undefined;
  var scale = (cmd.payload.scale as number) || 1;
  var target: SceneNode;
  if (nodeId) {
    var node = figma.getNodeById(nodeId) as SceneNode | null;
    if (!node) {
      return { commandId: cmd.id, success: false, error: 'Node not found: ' + nodeId };
    }
    target = node;
  } else {
    // Screenshot the current page's first frame or the page itself
    var page = figma.currentPage;
    if (page.children.length > 0) {
      target = page.children[0]!;
    } else {
      return { commandId: cmd.id, success: false, error: 'Current page has no children to screenshot' };
    }
  }
  var bytes = await target.exportAsync({
    format: 'PNG',
    constraint: { type: 'SCALE', value: scale },
  });
  var base64 = figma.base64Encode(bytes);
  return {
    commandId: cmd.id,
    success: true,
    data: { base64: base64, format: 'PNG', byteLength: bytes.byteLength, nodeId: target.id },
  };
}
