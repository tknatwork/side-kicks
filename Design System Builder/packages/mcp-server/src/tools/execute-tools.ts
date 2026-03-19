/**
 * Execute Tools — escape hatch for running arbitrary Figma Plugin API code.
 * @module mcp-server/tools/execute-tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge-client';

export function registerExecuteTools(server: McpServer, bridge: BridgeClient): void {
  server.tool(
    'dsb_execute',
    'Run arbitrary Figma Plugin API code. Use for anything structured tools don\'t cover. Code receives `figma` as a parameter.',
    {
      code: z.string().describe('JavaScript code to execute in the Figma plugin sandbox. Has access to the `figma` global.'),
    },
    async ({ code }) => {
      const result = await bridge.sendCommand({ type: 'execute_code', payload: { code } });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
