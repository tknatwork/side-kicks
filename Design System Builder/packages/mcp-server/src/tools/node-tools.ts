/**
 * Node Tools — MCP tools for manipulating Figma nodes.
 * @module mcp-server/tools/node-tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge-client';

export function registerNodeTools(server: McpServer, bridge: BridgeClient): void {
  server.tool(
    'dsb_resize_node',
    'Resize a node by ID to the specified width and height.',
    { nodeId: z.string(), width: z.number(), height: z.number() },
    async ({ nodeId, width, height }) => {
      const result = await bridge.sendCommand({ type: 'resize_node', payload: { nodeId, width, height } });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'dsb_move_node',
    'Move a node to the specified x, y position.',
    { nodeId: z.string(), x: z.number(), y: z.number() },
    async ({ nodeId, x, y }) => {
      const result = await bridge.sendCommand({ type: 'move_node', payload: { nodeId, x, y } });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'dsb_clone_node',
    'Deep-clone a node, optionally placing the clone under a different parent.',
    { nodeId: z.string(), parentId: z.string().optional() },
    async ({ nodeId, parentId }) => {
      const result = await bridge.sendCommand({ type: 'clone_node', payload: { nodeId, parentId } });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'dsb_set_fills',
    'Set fill paints on a node (solid, gradient, or image fills).',
    {
      nodeId: z.string(),
      fills: z.array(z.object({
        type: z.string(),
        color: z.object({ r: z.number(), g: z.number(), b: z.number() }).optional(),
        opacity: z.number().optional(),
      })),
    },
    async ({ nodeId, fills }) => {
      const result = await bridge.sendCommand({ type: 'set_fills', payload: { nodeId, fills } });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'dsb_set_strokes',
    'Set stroke paints and optional weight on a node.',
    {
      nodeId: z.string(),
      strokes: z.array(z.object({
        type: z.string(),
        color: z.object({ r: z.number(), g: z.number(), b: z.number() }).optional(),
        opacity: z.number().optional(),
      })),
      weight: z.number().optional(),
    },
    async ({ nodeId, strokes, weight }) => {
      const result = await bridge.sendCommand({ type: 'set_strokes', payload: { nodeId, strokes, weight } });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'dsb_set_text_content',
    'Update the text content of a text node (auto-loads required fonts).',
    { nodeId: z.string(), text: z.string() },
    async ({ nodeId, text }) => {
      const result = await bridge.sendCommand({ type: 'set_text_content', payload: { nodeId, text } });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'dsb_set_node_properties',
    'Batch-set properties on a node (opacity, cornerRadius, visible, name, etc.).',
    {
      nodeId: z.string(),
      properties: z.record(z.unknown()).describe('Key-value pairs of node properties to set'),
    },
    async ({ nodeId, properties }) => {
      const result = await bridge.sendCommand({ type: 'set_node_properties', payload: { nodeId, properties } });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
