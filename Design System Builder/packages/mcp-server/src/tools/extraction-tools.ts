/**
 * Extraction Tools — MCP tools for full design system extraction.
 * @module mcp-server/tools/extraction-tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge-client';

export function registerExtractionTools(server: McpServer, bridge: BridgeClient): void {
  server.tool(
    'dsb_extract_design_system',
    'Extract the full design system in one call: variables, collections, styles, components, and fonts.',
    {},
    async () => {
      const result = await bridge.sendCommand({ type: 'extract_design_system', payload: {} });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'dsb_extract_design_summary',
    'Get a lightweight overview of the design system: counts, categories, coverage.',
    {},
    async () => {
      const result = await bridge.sendCommand({ type: 'extract_design_summary', payload: {} });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'dsb_get_local_styles',
    'Get all local paint, text, effect, and grid styles with their resolved values.',
    {},
    async () => {
      const result = await bridge.sendCommand({ type: 'get_local_styles', payload: {} });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
