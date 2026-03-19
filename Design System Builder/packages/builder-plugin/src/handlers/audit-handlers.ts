/**
 * Audit Handlers — lint design, check parity, health score.
 * ES2017-compatible (QuickJS sandbox).
 * @module builder-plugin/handlers/audit-handlers
 */

import type { CommandResult, PollCommand } from '../polling';

export async function handleLintDesign(cmd: PollCommand): Promise<CommandResult> {
  var issues: Array<{ type: string; severity: string; nodeId: string; nodeName: string; message: string }> = [];
  var nodes = figma.currentPage.findAll();

  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (!node) { continue; }

    // Check for hardcoded colors (fills not bound to variables/styles)
    if ('fills' in node && 'fillStyleId' in node) {
      var fills = (node as any).fills as Paint[];
      var styleId = (node as any).fillStyleId;
      if (fills && fills.length > 0 && !styleId && typeof styleId === 'string' && styleId === '') {
        issues.push({
          type: 'hardcoded-color',
          severity: 'warning',
          nodeId: node.id,
          nodeName: node.name,
          message: 'Fill uses hardcoded color instead of a style or variable',
        });
      }
    }

    // Check text contrast (simplified — flags very light text on assumed light backgrounds)
    if (node.type === 'TEXT') {
      var textFills = (node as TextNode).fills as SolidPaint[];
      if (textFills && textFills.length > 0 && textFills[0]!.type === 'SOLID') {
        var c = textFills[0]!.color;
        var luminance = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
        if (luminance > 0.85) {
          issues.push({
            type: 'low-contrast',
            severity: 'error',
            nodeId: node.id,
            nodeName: node.name,
            message: 'Text may have insufficient contrast (luminance: ' + luminance.toFixed(2) + ')',
          });
        }
      }
    }

    // Check for detached components (instances with missing main component)
    if (node.type === 'INSTANCE') {
      var instance = node as InstanceNode;
      if (!instance.mainComponent) {
        issues.push({
          type: 'detached-instance',
          severity: 'warning',
          nodeId: node.id,
          nodeName: node.name,
          message: 'Instance has no main component (detached or deleted)',
        });
      }
    }
  }

  return {
    commandId: cmd.id,
    success: true,
    data: { issues: issues, issueCount: issues.length, nodesScanned: nodes.length },
  };
}

export async function handleCheckDesignParity(cmd: PollCommand): Promise<CommandResult> {
  var nodeId = cmd.payload.nodeId as string;
  var codeSnippet = cmd.payload.codeSnippet as string;
  var node = figma.getNodeById(nodeId) as SceneNode | null;
  if (!node) {
    return { commandId: cmd.id, success: false, error: 'Node not found: ' + nodeId };
  }

  var specs: Record<string, unknown> = {
    id: node.id,
    name: node.name,
    type: node.type,
  };
  if ('width' in node) { specs.width = Math.round((node as any).width); }
  if ('height' in node) { specs.height = Math.round((node as any).height); }
  if ('fills' in node) { specs.fills = (node as any).fills; }
  if ('cornerRadius' in node) { specs.cornerRadius = (node as any).cornerRadius; }
  if ('paddingLeft' in node) {
    specs.padding = {
      left: (node as any).paddingLeft,
      right: (node as any).paddingRight,
      top: (node as any).paddingTop,
      bottom: (node as any).paddingBottom,
    };
  }
  if (node.type === 'TEXT') {
    var textNode = node as TextNode;
    specs.fontSize = textNode.fontSize;
    specs.fontName = textNode.fontName;
    specs.lineHeight = textNode.lineHeight;
  }

  return {
    commandId: cmd.id,
    success: true,
    data: {
      designSpecs: specs,
      codeSnippet: codeSnippet,
      note: 'Compare design specs against code implementation. MCP server or Claude should analyze parity.',
    },
  };
}

export async function handleGetDesignHealthScore(cmd: PollCommand): Promise<CommandResult> {
  var variables = figma.variables.getLocalVariables();
  var collections = figma.variables.getLocalVariableCollections();
  var paintStyles = figma.getLocalPaintStyles();
  var textStyles = figma.getLocalTextStyles();
  var nodes = figma.currentPage.findAll();

  // Scoring categories (0-100 each, weighted)
  var tokenScore = Math.min(100, variables.length * 2); // More tokens = better coverage
  var styleScore = Math.min(100, (paintStyles.length + textStyles.length) * 5);

  var componentCount = 0;
  var instanceCount = 0;
  var detachedCount = 0;
  var hardcodedColorCount = 0;

  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    if (!n) { continue; }
    if (n.type === 'COMPONENT') { componentCount++; }
    if (n.type === 'INSTANCE') {
      instanceCount++;
      if (!(n as InstanceNode).mainComponent) { detachedCount++; }
    }
    if ('fills' in n && 'fillStyleId' in n) {
      var fsi = (n as any).fillStyleId;
      if (typeof fsi === 'string' && fsi === '' && (n as any).fills && (n as any).fills.length > 0) {
        hardcodedColorCount++;
      }
    }
  }

  var componentScore = componentCount > 0 ? Math.min(100, (instanceCount / Math.max(1, nodes.length)) * 200) : 0;
  var consistencyScore = nodes.length > 0 ? Math.max(0, 100 - (hardcodedColorCount / nodes.length) * 200) : 100;
  var integrityScore = instanceCount > 0 ? Math.max(0, 100 - (detachedCount / instanceCount) * 100) : 100;

  var weights = { tokens: 0.25, styles: 0.2, components: 0.2, consistency: 0.2, integrity: 0.15 };
  var overall = Math.round(
    tokenScore * weights.tokens +
    styleScore * weights.styles +
    componentScore * weights.components +
    consistencyScore * weights.consistency +
    integrityScore * weights.integrity
  );

  return {
    commandId: cmd.id,
    success: true,
    data: {
      overall: overall,
      breakdown: {
        tokens: { score: Math.round(tokenScore), weight: weights.tokens, count: variables.length },
        styles: { score: Math.round(styleScore), weight: weights.styles, count: paintStyles.length + textStyles.length },
        components: { score: Math.round(componentScore), weight: weights.components, count: componentCount },
        consistency: { score: Math.round(consistencyScore), weight: weights.consistency, hardcodedColors: hardcodedColorCount },
        integrity: { score: Math.round(integrityScore), weight: weights.integrity, detachedInstances: detachedCount },
      },
      nodeCount: nodes.length,
    },
  };
}
