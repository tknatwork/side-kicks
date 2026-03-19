/**
 * Nodes API — Wrappers for creating Figma layout nodes.
 *
 * Creates frames, sections, text nodes, and rectangles for
 * building foundation pages (color swatches, typography showcases).
 *
 * ES2017-compatible (Figma QuickJS sandbox).
 *
 * @module figma-api/nodes
 */

import type { Result } from '@dsb/guardrails';
import { Result as R } from '@dsb/guardrails';

// ============================================================================
// SECTION 1: FRAME CREATION
// ============================================================================

export interface FrameConfig {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly x?: number;
  readonly y?: number;
  readonly fills?: ReadonlyArray<Paint>;
  readonly layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
  readonly itemSpacing?: number;
  readonly paddingLeft?: number;
  readonly paddingRight?: number;
  readonly paddingTop?: number;
  readonly paddingBottom?: number;
}

/**
 * Create a frame node with optional auto-layout configuration.
 */
export function createFrame(
  config: FrameConfig,
  parent?: BaseNode & ChildrenMixin
): Result<FrameNode, string> {
  try {
    var frame = figma.createFrame();
    frame.name = config.name;
    frame.resize(config.width, config.height);

    if (config.x !== undefined) frame.x = config.x;
    if (config.y !== undefined) frame.y = config.y;

    if (config.fills) {
      frame.fills = config.fills as Paint[];
    }

    if (config.layoutMode && config.layoutMode !== 'NONE') {
      frame.layoutMode = config.layoutMode;
      if (config.itemSpacing !== undefined) frame.itemSpacing = config.itemSpacing;
      if (config.paddingLeft !== undefined) frame.paddingLeft = config.paddingLeft;
      if (config.paddingRight !== undefined) frame.paddingRight = config.paddingRight;
      if (config.paddingTop !== undefined) frame.paddingTop = config.paddingTop;
      if (config.paddingBottom !== undefined) frame.paddingBottom = config.paddingBottom;
    }

    if (parent) {
      parent.appendChild(frame);
    }

    return R.ok(frame);
  } catch (e) {
    return R.err('Failed to create frame "' + config.name + '": ' + String(e));
  }
}

// ============================================================================
// SECTION 2: SECTION CREATION
// ============================================================================

/**
 * Create a section node (Figma's grouping container for pages).
 */
export function createSection(
  name: string,
  width: number,
  height: number,
  parent?: BaseNode & ChildrenMixin
): Result<SectionNode, string> {
  try {
    var section = figma.createSection();
    section.name = name;
    section.resizeWithoutConstraints(width, height);

    if (parent) {
      parent.appendChild(section);
    }

    return R.ok(section);
  } catch (e) {
    return R.err('Failed to create section "' + name + '": ' + String(e));
  }
}

// ============================================================================
// SECTION 3: TEXT NODE CREATION
// ============================================================================

export interface TextConfig {
  readonly content: string;
  readonly fontFamily?: string;
  readonly fontStyle?: string;
  readonly fontSize?: number;
  readonly fills?: ReadonlyArray<Paint>;
  readonly x?: number;
  readonly y?: number;
}

/**
 * Create a text node. Loads the font first.
 */
export async function createText(
  config: TextConfig,
  parent?: BaseNode & ChildrenMixin
): Promise<Result<TextNode, string>> {
  try {
    var fontName: FontName = {
      family: config.fontFamily || 'Inter',
      style: config.fontStyle || 'Regular',
    };

    await figma.loadFontAsync(fontName);

    var text = figma.createText();
    text.fontName = fontName;
    text.characters = config.content;

    if (config.fontSize) text.fontSize = config.fontSize;
    if (config.fills) text.fills = config.fills as Paint[];
    if (config.x !== undefined) text.x = config.x;
    if (config.y !== undefined) text.y = config.y;

    if (parent) {
      parent.appendChild(text);
    }

    return R.ok(text);
  } catch (e) {
    return R.err('Failed to create text node: ' + String(e));
  }
}

// ============================================================================
// SECTION 4: RECTANGLE CREATION
// ============================================================================

/**
 * Create a rectangle (useful for color swatches).
 */
export function createRectangle(
  name: string,
  width: number,
  height: number,
  fills: ReadonlyArray<Paint>,
  parent?: BaseNode & ChildrenMixin
): Result<RectangleNode, string> {
  try {
    var rect = figma.createRectangle();
    rect.name = name;
    rect.resize(width, height);
    rect.fills = fills as Paint[];

    if (parent) {
      parent.appendChild(rect);
    }

    return R.ok(rect);
  } catch (e) {
    return R.err('Failed to create rectangle "' + name + '": ' + String(e));
  }
}

// ============================================================================
// SECTION 5: UTILITY
// ============================================================================

/**
 * Append a child node to a parent.
 */
export function appendChild(
  parent: BaseNode & ChildrenMixin,
  child: SceneNode
): Result<void, string> {
  try {
    parent.appendChild(child);
    return R.ok(undefined);
  } catch (e) {
    return R.err('Failed to append child: ' + String(e));
  }
}

/**
 * Remove a node.
 */
export function removeNode(node: SceneNode): Result<void, string> {
  try {
    node.remove();
    return R.ok(undefined);
  } catch (e) {
    return R.err('Failed to remove node: ' + String(e));
  }
}
