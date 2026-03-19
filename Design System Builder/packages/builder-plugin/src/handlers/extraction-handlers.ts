/**
 * Extraction Handlers — full DS extraction, summary, local styles.
 * ES2017-compatible (QuickJS sandbox).
 * @module builder-plugin/handlers/extraction-handlers
 */

import type { CommandResult, PollCommand } from '../polling';

export async function handleExtractDesignSystem(cmd: PollCommand): Promise<CommandResult> {
  var collections = figma.variables.getLocalVariableCollections();
  var variables = figma.variables.getLocalVariables();
  var paintStyles = figma.getLocalPaintStyles();
  var textStyles = figma.getLocalTextStyles();
  var effectStyles = figma.getLocalEffectStyles();

  var collectionData = collections.map(function(c) {
    return { id: c.id, name: c.name, modes: c.modes, variableIds: c.variableIds };
  });

  var variableData = variables.map(function(v) {
    return { id: v.id, name: v.name, resolvedType: v.resolvedType, variableCollectionId: v.variableCollectionId };
  });

  var paintData = paintStyles.map(function(s) {
    return { id: s.id, name: s.name, paints: s.paints };
  });

  var textData = textStyles.map(function(s) {
    return { id: s.id, name: s.name, fontName: s.fontName, fontSize: s.fontSize, lineHeight: s.lineHeight };
  });

  var effectData = effectStyles.map(function(s) {
    return { id: s.id, name: s.name, effects: s.effects };
  });

  var components: Array<Record<string, unknown>> = [];
  function walkComponents(node: BaseNode) {
    if (node.type === 'COMPONENT') {
      var comp = node as ComponentNode;
      components.push({ id: comp.id, name: comp.name, key: comp.key, description: comp.description });
    }
    if ('children' in node) {
      var children = (node as any).children as BaseNode[];
      for (var i = 0; i < children.length; i++) { var c = children[i]; if (c) { walkComponents(c); } }
    }
  }
  walkComponents(figma.root);

  var fonts: Record<string, boolean> = {};
  figma.currentPage.findAll().forEach(function(node) {
    if (node.type === 'TEXT') {
      var textNode = node as TextNode;
      var nodefonts = textNode.getRangeAllFontNames(0, textNode.characters.length);
      for (var i = 0; i < nodefonts.length; i++) {
        var nf = nodefonts[i]; if (nf) { fonts[nf.family + ' ' + nf.style] = true; }
      }
    }
  });

  return {
    commandId: cmd.id,
    success: true,
    data: {
      collections: collectionData,
      variables: variableData,
      paintStyles: paintData,
      textStyles: textData,
      effectStyles: effectData,
      components: components,
      fonts: Object.keys(fonts),
      summary: {
        collectionCount: collectionData.length,
        variableCount: variableData.length,
        paintStyleCount: paintData.length,
        textStyleCount: textData.length,
        effectStyleCount: effectData.length,
        componentCount: components.length,
        fontCount: Object.keys(fonts).length,
      },
    },
  };
}

export async function handleExtractDesignSummary(cmd: PollCommand): Promise<CommandResult> {
  var collections = figma.variables.getLocalVariableCollections();
  var variables = figma.variables.getLocalVariables();
  var paintStyles = figma.getLocalPaintStyles();
  var textStyles = figma.getLocalTextStyles();
  var effectStyles = figma.getLocalEffectStyles();
  var pages = figma.root.children;
  var componentCount = 0;
  function countComponents(node: BaseNode) {
    if (node.type === 'COMPONENT') { componentCount++; }
    if ('children' in node) {
      var children = (node as any).children as BaseNode[];
      for (var i = 0; i < children.length; i++) { var c = children[i]; if (c) { countComponents(c); } }
    }
  }
  countComponents(figma.root);

  return {
    commandId: cmd.id,
    success: true,
    data: {
      fileName: figma.root.name,
      pageCount: pages.length,
      collectionCount: collections.length,
      variableCount: variables.length,
      paintStyleCount: paintStyles.length,
      textStyleCount: textStyles.length,
      effectStyleCount: effectStyles.length,
      componentCount: componentCount,
    },
  };
}

export async function handleGetLocalStyles(cmd: PollCommand): Promise<CommandResult> {
  var paintStyles = figma.getLocalPaintStyles().map(function(s) {
    return { id: s.id, name: s.name, type: 'PAINT', paints: s.paints };
  });
  var textStyles = figma.getLocalTextStyles().map(function(s) {
    return { id: s.id, name: s.name, type: 'TEXT', fontName: s.fontName, fontSize: s.fontSize };
  });
  var effectStyles = figma.getLocalEffectStyles().map(function(s) {
    return { id: s.id, name: s.name, type: 'EFFECT', effects: s.effects };
  });
  var gridStyles = figma.getLocalGridStyles().map(function(s) {
    return { id: s.id, name: s.name, type: 'GRID', grids: s.layoutGrids };
  });
  var all = ([] as unknown[]).concat(paintStyles, textStyles, effectStyles, gridStyles);
  return { commandId: cmd.id, success: true, data: { styles: all, count: all.length } };
}
