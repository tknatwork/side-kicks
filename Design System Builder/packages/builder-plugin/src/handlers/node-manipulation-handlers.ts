/**
 * Node Manipulation Handlers — resize, move, clone, fills, strokes, text, properties.
 * ES2017-compatible (QuickJS sandbox).
 * @module builder-plugin/handlers/node-manipulation-handlers
 */

import type { CommandResult, PollCommand } from '../polling';

export async function handleResizeNode(cmd: PollCommand): Promise<CommandResult> {
  var nodeId = cmd.payload.nodeId as string;
  var width = cmd.payload.width as number;
  var height = cmd.payload.height as number;
  var node = figma.getNodeById(nodeId) as SceneNode | null;
  if (!node) {
    return { commandId: cmd.id, success: false, error: 'Node not found: ' + nodeId };
  }
  if (!('resize' in node)) {
    return { commandId: cmd.id, success: false, error: 'Node does not support resize: ' + nodeId };
  }
  (node as FrameNode).resize(width, height);
  return { commandId: cmd.id, success: true, data: { nodeId: nodeId, width: width, height: height } };
}

export async function handleMoveNode(cmd: PollCommand): Promise<CommandResult> {
  var nodeId = cmd.payload.nodeId as string;
  var x = cmd.payload.x as number;
  var y = cmd.payload.y as number;
  var node = figma.getNodeById(nodeId) as SceneNode | null;
  if (!node) {
    return { commandId: cmd.id, success: false, error: 'Node not found: ' + nodeId };
  }
  node.x = x;
  node.y = y;
  return { commandId: cmd.id, success: true, data: { nodeId: nodeId, x: x, y: y } };
}

export async function handleCloneNode(cmd: PollCommand): Promise<CommandResult> {
  var nodeId = cmd.payload.nodeId as string;
  var parentId = cmd.payload.parentId as string | undefined;
  var node = figma.getNodeById(nodeId) as SceneNode | null;
  if (!node) {
    return { commandId: cmd.id, success: false, error: 'Node not found: ' + nodeId };
  }
  var clone = node.clone();
  if (parentId) {
    var parent = figma.getNodeById(parentId);
    if (parent && 'appendChild' in parent) {
      (parent as FrameNode).appendChild(clone);
    }
  }
  return { commandId: cmd.id, success: true, data: { cloneId: clone.id, name: clone.name } };
}

export async function handleSetFills(cmd: PollCommand): Promise<CommandResult> {
  var nodeId = cmd.payload.nodeId as string;
  var fills = cmd.payload.fills as Paint[];
  var node = figma.getNodeById(nodeId) as SceneNode | null;
  if (!node) {
    return { commandId: cmd.id, success: false, error: 'Node not found: ' + nodeId };
  }
  if (!('fills' in node)) {
    return { commandId: cmd.id, success: false, error: 'Node does not support fills: ' + nodeId };
  }
  (node as GeometryMixin & SceneNode).fills = fills;
  return { commandId: cmd.id, success: true };
}

export async function handleSetStrokes(cmd: PollCommand): Promise<CommandResult> {
  var nodeId = cmd.payload.nodeId as string;
  var strokes = cmd.payload.strokes as Paint[];
  var weight = cmd.payload.weight as number | undefined;
  var node = figma.getNodeById(nodeId) as SceneNode | null;
  if (!node) {
    return { commandId: cmd.id, success: false, error: 'Node not found: ' + nodeId };
  }
  if (!('strokes' in node)) {
    return { commandId: cmd.id, success: false, error: 'Node does not support strokes: ' + nodeId };
  }
  var strokable = node as GeometryMixin & SceneNode;
  strokable.strokes = strokes;
  if (weight !== undefined && 'strokeWeight' in strokable) {
    (strokable as any).strokeWeight = weight;
  }
  return { commandId: cmd.id, success: true };
}

export async function handleSetTextContent(cmd: PollCommand): Promise<CommandResult> {
  var nodeId = cmd.payload.nodeId as string;
  var text = cmd.payload.text as string;
  var node = figma.getNodeById(nodeId) as TextNode | null;
  if (!node || node.type !== 'TEXT') {
    return { commandId: cmd.id, success: false, error: 'Text node not found: ' + nodeId };
  }
  var fonts = node.getRangeAllFontNames(0, node.characters.length);
  for (var i = 0; i < fonts.length; i++) {
    var f = fonts[i]; if (f) { await figma.loadFontAsync(f); }
  }
  node.characters = text;
  return { commandId: cmd.id, success: true, data: { nodeId: nodeId, text: text } };
}

export async function handleSetNodeProperties(cmd: PollCommand): Promise<CommandResult> {
  var nodeId = cmd.payload.nodeId as string;
  var properties = cmd.payload.properties as Record<string, unknown>;
  var node = figma.getNodeById(nodeId) as SceneNode | null;
  if (!node) {
    return { commandId: cmd.id, success: false, error: 'Node not found: ' + nodeId };
  }
  var keys = Object.keys(properties);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]!;
    (key as string);if (key in node) {
      (node as any)[key] = (properties as any)[key];
    }
  }
  return { commandId: cmd.id, success: true, data: { nodeId: nodeId, updated: keys } };
}

export async function handleGetNodeById(cmd: PollCommand): Promise<CommandResult> {
  var nodeId = cmd.payload.nodeId as string;
  var node = figma.getNodeById(nodeId);
  if (!node) {
    return { commandId: cmd.id, success: false, error: 'Node not found: ' + nodeId };
  }
  var data: Record<string, unknown> = {
    id: node.id,
    name: node.name,
    type: node.type,
  };
  if ('width' in node) { data.width = (node as any).width; }
  if ('height' in node) { data.height = (node as any).height; }
  if ('x' in node) { data.x = (node as any).x; }
  if ('y' in node) { data.y = (node as any).y; }
  if ('opacity' in node) { data.opacity = (node as any).opacity; }
  if ('visible' in node) { data.visible = (node as any).visible; }
  if ('fills' in node) { data.fills = (node as any).fills; }
  if ('strokes' in node) { data.strokes = (node as any).strokes; }
  if ('children' in node) { data.childCount = (node as any).children.length; }
  return { commandId: cmd.id, success: true, data: data };
}

export async function handleFindNodesByName(cmd: PollCommand): Promise<CommandResult> {
  var pattern = cmd.payload.pattern as string;
  var pageOnly = cmd.payload.pageOnly as boolean | undefined;
  var root: BaseNode = pageOnly ? figma.currentPage : figma.root;
  var matches: Array<{ id: string; name: string; type: string }> = [];
  var regex = new RegExp(pattern, 'i');
  function walk(node: BaseNode) {
    if (regex.test(node.name)) {
      matches.push({ id: node.id, name: node.name, type: node.type });
    }
    if ('children' in node) {
      var children = (node as any).children as BaseNode[];
      for (var i = 0; i < children.length; i++) {
        var ch = children[i]; if (ch) { walk(ch); }
      }
    }
  }
  walk(root);
  return { commandId: cmd.id, success: true, data: { matches: matches, count: matches.length } };
}
