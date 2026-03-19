/**
 * Component Handlers — instantiate, search, metadata, arrange.
 * ES2017-compatible (QuickJS sandbox).
 * @module builder-plugin/handlers/component-handlers
 */

import type { CommandResult, PollCommand } from '../polling';

export async function handleInstantiateComponent(cmd: PollCommand): Promise<CommandResult> {
  var componentId = cmd.payload.componentId as string;
  var node = figma.getNodeById(componentId);
  if (!node || node.type !== 'COMPONENT') {
    return { commandId: cmd.id, success: false, error: 'Component not found: ' + componentId };
  }
  var instance = (node as ComponentNode).createInstance();
  if (cmd.payload.x !== undefined) { instance.x = cmd.payload.x as number; }
  if (cmd.payload.y !== undefined) { instance.y = cmd.payload.y as number; }
  return { commandId: cmd.id, success: true, data: { instanceId: instance.id, name: instance.name } };
}

export async function handleSearchComponents(cmd: PollCommand): Promise<CommandResult> {
  var pattern = cmd.payload.pattern as string;
  var regex = new RegExp(pattern, 'i');
  var results: Array<{ id: string; name: string; key: string; description: string }> = [];
  function walk(node: BaseNode) {
    if (node.type === 'COMPONENT' && regex.test(node.name)) {
      var comp = node as ComponentNode;
      results.push({ id: comp.id, name: comp.name, key: comp.key, description: comp.description });
    }
    if ('children' in node) {
      var children = (node as any).children as BaseNode[];
      for (var i = 0; i < children.length; i++) { var c = children[i]; if (c) { walk(c); } }
    }
  }
  walk(figma.root);
  return { commandId: cmd.id, success: true, data: { components: results, count: results.length } };
}

export async function handleGetComponentMetadata(cmd: PollCommand): Promise<CommandResult> {
  var componentId = cmd.payload.componentId as string;
  var node = figma.getNodeById(componentId);
  if (!node || (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET')) {
    return { commandId: cmd.id, success: false, error: 'Component not found: ' + componentId };
  }
  var data: Record<string, unknown> = {
    id: node.id,
    name: node.name,
    type: node.type,
    description: (node as ComponentNode).description,
    key: (node as ComponentNode).key,
  };
  if (node.type === 'COMPONENT_SET') {
    var set = node as ComponentSetNode;
    var variants: Array<Record<string, unknown>> = [];
    for (var i = 0; i < set.children.length; i++) {
      var child = set.children[i] as ComponentNode | undefined; if (!child) { continue; }
      variants.push({ id: child.id, name: child.name, key: child.key });
    }
    data.variants = variants;
    data.variantCount = variants.length;
  }
  return { commandId: cmd.id, success: true, data: data };
}

export async function handleArrangeComponentSet(cmd: PollCommand): Promise<CommandResult> {
  var setId = cmd.payload.setId as string;
  var columns = (cmd.payload.columns as number) || 4;
  var gap = (cmd.payload.gap as number) || 20;
  var node = figma.getNodeById(setId);
  if (!node || node.type !== 'COMPONENT_SET') {
    return { commandId: cmd.id, success: false, error: 'ComponentSet not found: ' + setId };
  }
  var set = node as ComponentSetNode;
  for (var i = 0; i < set.children.length; i++) {
    var child = set.children[i] as SceneNode | undefined; if (!child) { continue; }
    var col = i % columns;
    var row = Math.floor(i / columns);
    child.x = col * (child.width + gap);
    child.y = row * (child.height + gap);
  }
  return { commandId: cmd.id, success: true, data: { arranged: set.children.length, columns: columns } };
}
