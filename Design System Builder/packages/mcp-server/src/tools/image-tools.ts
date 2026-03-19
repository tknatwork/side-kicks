/**
 * Image Tools — MCP tools for exporting and screenshotting nodes.
 * @module mcp-server/tools/image-tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge-client';

export function registerImageTools(server: McpServer, bridge: BridgeClient): void {
  server.tool(
    'dsb_export_node_image',
    'Export any node as PNG, SVG, or PDF. Returns base64-encoded image data.',
    {
      nodeId: z.string(),
      format: z.enum(['PNG', 'SVG', 'PDF']).default('PNG'),
      scale: z.number().default(2).describe('Export scale (only for PNG)'),
    },
    async ({ nodeId, format, scale }) => {
      const result = await bridge.sendCommand({ type: 'export_node_image', payload: { nodeId, format, scale } });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'dsb_take_screenshot',
    'Capture a screenshot of a specific node or the current viewport.',
    {
      nodeId: z.string().optional().describe('Node to screenshot (defaults to first child of current page)'),
      scale: z.number().default(1).describe('Screenshot scale'),
    },
    async ({ nodeId, scale }) => {
      const result = await bridge.sendCommand({ type: 'take_screenshot', payload: { nodeId, scale } });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
