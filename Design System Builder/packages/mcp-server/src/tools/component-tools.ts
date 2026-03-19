/**
 * Component Tools — MCP tools for component operations.
 * @module mcp-server/tools/component-tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge-client';

export function registerComponentTools(server: McpServer, bridge: BridgeClient): void {
  server.tool(
    'dsb_instantiate_component',
    'Create an instance of a component by its ID, optionally at specific coordinates.',
    { componentId: z.string(), x: z.number().optional(), y: z.number().optional() },
    async ({ componentId, x, y }) => {
      const result = await bridge.sendCommand({ type: 'instantiate_component', payload: { componentId, x, y } });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'dsb_search_components',
    'Search for components by name pattern (regex) across the entire file.',
    { pattern: z.string().describe('Regex pattern to match component names') },
    async ({ pattern }) => {
      const result = await bridge.sendCommand({ type: 'search_components', payload: { pattern } });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'dsb_get_component_metadata',
    'Get detailed metadata for a component or component set (properties, variants, description).',
    { componentId: z.string() },
    async ({ componentId }) => {
      const result = await bridge.sendCommand({ type: 'get_component_metadata', payload: { componentId } });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'dsb_arrange_component_set',
    'Arrange variants in a component set into a grid layout.',
    {
      setId: z.string(),
      columns: z.number().default(4).describe('Number of columns in the grid'),
      gap: z.number().default(20).describe('Gap between variants in pixels'),
    },
    async ({ setId, columns, gap }) => {
      const result = await bridge.sendCommand({ type: 'arrange_component_set', payload: { setId, columns, gap } });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
