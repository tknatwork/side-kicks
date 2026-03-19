/**
 * Doc Handlers — auto-generate component documentation.
 * ES2017-compatible (QuickJS sandbox).
 * @module builder-plugin/handlers/doc-handlers
 */

import type { CommandResult, PollCommand } from '../polling';

export async function handleGenerateComponentDoc(cmd: PollCommand): Promise<CommandResult> {
  var componentId = cmd.payload.componentId as string;
  var node = figma.getNodeById(componentId);
  if (!node || (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET')) {
    return { commandId: cmd.id, success: false, error: 'Component not found: ' + componentId };
  }

  var comp = node as ComponentNode;
  var lines: string[] = [];
  lines.push('# ' + comp.name);
  lines.push('');
  if (comp.description) {
    lines.push(comp.description);
    lines.push('');
  }
  lines.push('## Properties');
  lines.push('');
  lines.push('| Property | Type | Default |');
  lines.push('|----------|------|---------|');

  if (node.type === 'COMPONENT_SET') {
    var set = node as ComponentSetNode;
    // Extract variant properties from variant names
    var propMap: Record<string, Set<string>> = {};
    for (var i = 0; i < set.children.length; i++) {
      var child = set.children[i]; if (!child) { continue; }
      var pairs = child.name.split(', ');
      for (var j = 0; j < pairs.length; j++) {
        var pair = pairs[j]; if (!pair) { continue; } var parts = pair.split('=');
        if (parts.length === 2) {
          var propName = parts[0]!.trim();
          var propValue = parts[1]!.trim();
          if (!propMap[propName]) { propMap[propName] = new Set(); }
          propMap[propName]!.add(propValue);
        }
      }
    }
    var propNames = Object.keys(propMap);
    for (var k = 0; k < propNames.length; k++) {
      var name = propNames[k]!;
      var values = Array.from(propMap[name]!);
      lines.push('| ' + name + ' | enum | ' + values.join(', ') + ' |');
    }
    lines.push('');
    lines.push('## Variants (' + set.children.length + ')');
    lines.push('');
    for (var v = 0; v < set.children.length; v++) {
      lines.push('- `' + (set.children[v] as any).name + '`');
    }
  } else {
    lines.push('| (base component — no variant properties) | — | — |');
  }

  lines.push('');
  lines.push('## Metadata');
  lines.push('');
  lines.push('- **Key:** `' + comp.key + '`');
  lines.push('- **ID:** `' + comp.id + '`');
  lines.push('- **Type:** ' + node.type);

  return {
    commandId: cmd.id,
    success: true,
    data: { markdown: lines.join('\n'), componentName: comp.name },
  };
}
