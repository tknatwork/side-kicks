/**
 * Debug Tools — MCP tools for console, debugging, and reconnection.
 * @module mcp-server/tools/debug-tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge-client';

export function registerDebugTools(server: McpServer, bridge: BridgeClient): void {
  server.tool(
    'dsb_get_console_logs',
    'Retrieve the plugin console log buffer, optionally filtered by keyword.',
    {
      filter: z.string().optional().describe('Filter logs containing this string'),
      limit: z.number().default(200).describe('Maximum number of log entries'),
    },
    async ({ filter, limit }) => {
      const result = await bridge.sendCommand({ type: 'get_console_buffer', payload: { filter, limit } });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'dsb_clear_console',
    'Clear the plugin console log buffer.',
    {},
    async () => {
      const result = await bridge.sendCommand({ type: 'clear_console', payload: {} });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'dsb_reload_page',
    'Force-reload the current Figma page (triggers a brief page switch).',
    {},
    async () => {
      const result = await bridge.sendCommand({ type: 'reload_page', payload: {} });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'dsb_reconnect',
    'Reconnect to the Figma plugin by verifying orchestration server health and plugin connection.',
    {},
    async () => {
      const health = await bridge.healthCheck();
      if (!health) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ connected: false, error: 'Orchestration server unreachable' }, null, 2) }] };
      }
      const status = await bridge.getStatus();
      return { content: [{ type: 'text' as const, text: JSON.stringify({ connected: true, ...status }, null, 2) }] };
    }
  );
}
