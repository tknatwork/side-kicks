/**
 * Page Handlers — Command handlers for Figma page and node operations.
 *
 * ES2017-compatible.
 *
 * @module builder-plugin/handlers/page-handlers
 */

import type { CommandResult, PollCommand } from '../polling';
import * as api from '@dsb/figma-api';

// ============================================================================
// SECTION 1: PAGE OPERATIONS
// ============================================================================

export async function handleCreatePage(
  cmd: PollCommand
): Promise<CommandResult> {
  var name = cmd.payload.name as string;

  var result = api.createPage(name);
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  return {
    commandId: cmd.id,
    success: true,
    data: { pageId: result.value.id, name: result.value.name },
  };
}

export async function handleCreatePages(
  cmd: PollCommand
): Promise<CommandResult> {
  var names = cmd.payload.names as string[];

  var result = api.createPages(names);
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  var pages = result.value.map(function(p) {
    return { pageId: p.id, name: p.name };
  });

  return {
    commandId: cmd.id,
    success: true,
    data: { pages: pages },
  };
}

export async function handleGetPages(
  cmd: PollCommand
): Promise<CommandResult> {
  var result = api.getPages();
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  var pages = result.value.map(function(p) {
    return { pageId: p.id, name: p.name };
  });

  return {
    commandId: cmd.id,
    success: true,
    data: { pages: pages },
  };
}

export async function handleSetCurrentPage(
  cmd: PollCommand
): Promise<CommandResult> {
  var pageId = cmd.payload.pageId as string;

  var page = figma.getNodeById(pageId) as PageNode | null;
  if (!page) {
    return { commandId: cmd.id, success: false, error: 'Page not found: ' + pageId };
  }

  var result = api.setCurrentPage(page);
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  return { commandId: cmd.id, success: true };
}

export async function handleDeletePage(
  cmd: PollCommand
): Promise<CommandResult> {
  var pageId = cmd.payload.pageId as string;

  var page = figma.getNodeById(pageId) as PageNode | null;
  if (!page) {
    return { commandId: cmd.id, success: false, error: 'Page not found: ' + pageId };
  }

  var result = api.deletePage(page);
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  return { commandId: cmd.id, success: true };
}

export async function handleFindPageByName(
  cmd: PollCommand
): Promise<CommandResult> {
  var name = cmd.payload.name as string;

  var result = api.findPageByName(name);
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  if (!result.value) {
    return { commandId: cmd.id, success: true, data: { found: false } };
  }

  return {
    commandId: cmd.id,
    success: true,
    data: { found: true, pageId: result.value.id, name: result.value.name },
  };
}

// ============================================================================
// SECTION 2: NODE OPERATIONS
// ============================================================================

export async function handleCreateFrame(
  cmd: PollCommand
): Promise<CommandResult> {
  var config = cmd.payload as unknown as api.FrameConfig;

  var result = api.createFrame(config);
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  return {
    commandId: cmd.id,
    success: true,
    data: { nodeId: result.value.id, name: result.value.name },
  };
}

export async function handleCreateSection(
  cmd: PollCommand
): Promise<CommandResult> {
  var name = cmd.payload.name as string;
  var x = (cmd.payload.x as number) || 0;
  var y = (cmd.payload.y as number) || 0;

  var result = api.createSection(name, x, y);
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  return {
    commandId: cmd.id,
    success: true,
    data: { nodeId: result.value.id, name: result.value.name },
  };
}

export async function handleCreateText(
  cmd: PollCommand
): Promise<CommandResult> {
  var config = cmd.payload as unknown as api.TextConfig;

  var result = await api.createText(config);
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  return {
    commandId: cmd.id,
    success: true,
    data: { nodeId: result.value.id, name: result.value.name },
  };
}

export async function handleCreateRectangle(
  cmd: PollCommand
): Promise<CommandResult> {
  var name = cmd.payload.name as string;
  var width = cmd.payload.width as number;
  var height = cmd.payload.height as number;
  var color = cmd.payload.color as RGBA | undefined;
  var fills: readonly Paint[] = color
    ? [{ type: 'SOLID', color: { r: color.r, g: color.g, b: color.b }, opacity: color.a } as SolidPaint]
    : [];

  var result = api.createRectangle(name, width, height, fills);
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  return {
    commandId: cmd.id,
    success: true,
    data: { nodeId: result.value.id, name: result.value.name },
  };
}

export async function handleAppendChild(
  cmd: PollCommand
): Promise<CommandResult> {
  var parentId = cmd.payload.parentId as string;
  var childId = cmd.payload.childId as string;

  var parent = figma.getNodeById(parentId);
  var child = figma.getNodeById(childId) as SceneNode | null;

  if (!parent) {
    return { commandId: cmd.id, success: false, error: 'Parent not found: ' + parentId };
  }
  if (!child) {
    return { commandId: cmd.id, success: false, error: 'Child not found: ' + childId };
  }
  if (!('appendChild' in parent)) {
    return { commandId: cmd.id, success: false, error: 'Parent cannot have children: ' + parentId };
  }

  var result = api.appendChild(parent as FrameNode, child);
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  return { commandId: cmd.id, success: true };
}

export async function handleRemoveNode(
  cmd: PollCommand
): Promise<CommandResult> {
  var nodeId = cmd.payload.nodeId as string;

  var node = figma.getNodeById(nodeId) as SceneNode | null;
  if (!node) {
    return { commandId: cmd.id, success: false, error: 'Node not found: ' + nodeId };
  }

  var result = api.removeNode(node);
  if (!result.ok) {
    return { commandId: cmd.id, success: false, error: result.error };
  }

  return { commandId: cmd.id, success: true };
}
