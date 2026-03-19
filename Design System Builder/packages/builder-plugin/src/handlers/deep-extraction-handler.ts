/**
 * Deep Extraction Handler — extracts variable values, aliases, and full
 * node tree for cross-file replication.
 *
 * Unlike `extract_design_system` (which returns metadata only), this handler
 * serializes the complete variable valuesByMode (including alias chains)
 * and the page/node hierarchy with properties needed to replicate in a
 * destination file.
 *
 * ES2017-compatible (QuickJS sandbox).
 * @module builder-plugin/handlers/deep-extraction-handler
 */

import type { CommandResult, PollCommand } from '../polling';

// ============================================================================
// SECTION 1: VARIABLE VALUE SERIALIZATION
// ============================================================================

/**
 * Serialize a variable value for transport.
 * Figma stores aliases as { type: 'VARIABLE_ALIAS', id: 'VariableID:xxx' }.
 * Literal values are RGBA objects, numbers, strings, or booleans.
 */
function serializeValue(val: unknown): unknown {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object' && val !== null && (val as any).type === 'VARIABLE_ALIAS') {
    return { _alias: true, variableId: (val as any).id };
  }
  // RGBA color
  if (typeof val === 'object' && val !== null && 'r' in val && 'g' in val && 'b' in val) {
    var c = val as { r: number; g: number; b: number; a?: number };
    return { r: c.r, g: c.g, b: c.b, a: c.a !== undefined ? c.a : 1 };
  }
  return val;
}

// ============================================================================
// SECTION 1b: SIMPLE CHECKSUM FOR SECTION TAGGING
// ============================================================================

/**
 * Lightweight checksum for tagged sections — lets the destination
 * verify "has this section already been replicated?" without diffing.
 * ES2017: no fancy crypto, just a stable string hash.
 */
function simpleChecksum(data: unknown): string {
  var str = JSON.stringify(data);
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    var ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash = hash & hash;
  }
  return (hash >>> 0).toString(16);
}

// ============================================================================
// SECTION 2: DEEP EXTRACTION HANDLER
// ============================================================================

export async function handleDeepExtract(cmd: PollCommand): Promise<CommandResult> {
  // ── Collections with modes ──
  var collections = figma.variables.getLocalVariableCollections();
  var collectionData = collections.map(function(c) {
    return {
      id: c.id,
      name: c.name,
      modes: c.modes.map(function(m) { return { modeId: m.modeId, name: m.name }; }),
      variableIds: c.variableIds,
    };
  });

  // ── Variables with full values per mode + alias detection ──
  var variables = figma.variables.getLocalVariables();
  var variableData = variables.map(function(v) {
    var values: Record<string, unknown> = {};
    var modeKeys = Object.keys(v.valuesByMode);
    for (var i = 0; i < modeKeys.length; i++) {
      var modeId = modeKeys[i];
      if (modeId) {
        values[modeId] = serializeValue(v.valuesByMode[modeId]);
      }
    }
    return {
      id: v.id,
      name: v.name,
      resolvedType: v.resolvedType,
      collectionId: v.variableCollectionId,
      scopes: v.scopes,
      description: v.description || '',
      valuesByMode: values,
    };
  });

  // ── Styles (paint with full paints, text with full font info) ──
  var paintStyles = figma.getLocalPaintStyles().map(function(s) {
    return { id: s.id, name: s.name, description: s.description, paints: s.paints };
  });
  var textStyles = figma.getLocalTextStyles().map(function(s) {
    return {
      id: s.id, name: s.name, description: s.description,
      fontName: s.fontName, fontSize: s.fontSize,
      lineHeight: s.lineHeight, letterSpacing: s.letterSpacing,
      textDecoration: s.textDecoration, textCase: s.textCase,
    };
  });
  var effectStyles = figma.getLocalEffectStyles().map(function(s) {
    return { id: s.id, name: s.name, description: s.description, effects: s.effects };
  });
  var gridStyles = figma.getLocalGridStyles().map(function(s) {
    return { id: s.id, name: s.name, description: s.description, grids: s.layoutGrids };
  });

  // ── Pages + top-level node tree ──
  var pages = figma.root.children.map(function(page) {
    var topNodes = page.children.map(function(node) {
      return serializeNode(node, 0);
    });
    return { name: page.name, id: page.id, children: topNodes };
  });

  // ── Tagged section metadata for resumability ──
  var sections = [
    { tag: 'COLLECTIONS', count: collectionData.length, checksum: simpleChecksum(collectionData) },
    { tag: 'VARIABLES', count: variableData.length, checksum: simpleChecksum(variableData) },
    { tag: 'PAINT_STYLES', count: paintStyles.length, checksum: simpleChecksum(paintStyles) },
    { tag: 'TEXT_STYLES', count: textStyles.length, checksum: simpleChecksum(textStyles) },
    { tag: 'EFFECT_STYLES', count: effectStyles.length, checksum: simpleChecksum(effectStyles) },
    { tag: 'GRID_STYLES', count: gridStyles.length, checksum: simpleChecksum(gridStyles) },
    { tag: 'PAGES', count: pages.length, checksum: simpleChecksum(pages) },
  ];
  var totalItems = 0;
  for (var si = 0; si < sections.length; si++) { totalItems += (sections[si] as any).count; }

  return {
    commandId: cmd.id, success: true,
    data: {
      _meta: { version: 1, extractedAt: new Date().toISOString(), totalSections: sections.length, totalItems: totalItems, sections: sections, resumeFrom: null },
      fileName: figma.root.name, collections: collectionData, variables: variableData,
      paintStyles: paintStyles, textStyles: textStyles, effectStyles: effectStyles,
      gridStyles: gridStyles, pages: pages,
    },
  };
}

// ============================================================================
// SECTION 3: NODE SERIALIZATION (recursive, depth-limited)
// ============================================================================

var MAX_DEPTH = 8;

function serializeNode(node: SceneNode, depth: number): Record<string, unknown> {
  var base: Record<string, unknown> = {
    id: node.id,
    name: node.name,
    type: node.type,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    visible: node.visible,
  };

  // Frame/component layout properties
  if ('layoutMode' in node) {
    var frame = node as FrameNode;
    base.layoutMode = frame.layoutMode;
    base.itemSpacing = frame.itemSpacing;
    base.paddingLeft = frame.paddingLeft;
    base.paddingRight = frame.paddingRight;
    base.paddingTop = frame.paddingTop;
    base.paddingBottom = frame.paddingBottom;
    base.primaryAxisAlignItems = frame.primaryAxisAlignItems;
    base.counterAxisAlignItems = frame.counterAxisAlignItems;
    base.layoutSizingHorizontal = frame.layoutSizingHorizontal;
    base.layoutSizingVertical = frame.layoutSizingVertical;
  }

  // Fills, strokes, effects
  if ('fills' in node) {
    base.fills = node.fills;
  }
  if ('strokes' in node) {
    base.strokes = node.strokes;
    base.strokeWeight = (node as any).strokeWeight;
  }
  if ('effects' in node) {
    base.effects = (node as any).effects;
  }
  if ('cornerRadius' in node) {
    base.cornerRadius = (node as any).cornerRadius;
  }
  if ('opacity' in node) {
    base.opacity = node.opacity;
  }

  // Text nodes
  if (node.type === 'TEXT') {
    var textNode = node as TextNode;
    base.characters = textNode.characters;
    base.fontName = textNode.fontName;
    base.fontSize = textNode.fontSize;
    base.lineHeight = textNode.lineHeight;
    base.letterSpacing = textNode.letterSpacing;
    base.textAlignHorizontal = textNode.textAlignHorizontal;
    base.textAlignVertical = textNode.textAlignVertical;
    base.textAutoResize = textNode.textAutoResize;
  }

  // Component info
  if (node.type === 'COMPONENT') {
    base.componentKey = (node as ComponentNode).key;
    base.componentDescription = (node as ComponentNode).description;
  }
  if (node.type === 'INSTANCE') {
    var inst = node as InstanceNode;
    base.mainComponentId = inst.mainComponent ? inst.mainComponent.id : null;
    base.mainComponentKey = inst.mainComponent ? inst.mainComponent.key : null;
  }

  // Recurse children (depth-limited)
  if ('children' in node && depth < MAX_DEPTH) {
    var children = (node as any).children as SceneNode[];
    base.children = children.map(function(child) {
      return serializeNode(child, depth + 1);
    });
  }

  return base;
}
