/**
 * File role MCP tools — source/destination/both toggle.
 *
 * @module tools/file-role-tools
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge-client';
import { z } from 'zod';

const FILE_ROLE_SCHEMA = z.object({
  role: z.enum(['source', 'destination', 'source+destination']),
});

export function registerFileRoleTools(server: McpServer, bridge: BridgeClient): void {
  server.tool(
    'dsb_set_file_role',
    'Set the active file role: source (read-only), destination (write), or source+destination (in-place)',
    { role: FILE_ROLE_SCHEMA.shape.role },
    async ({ role }) => {
      const result = await bridge.sendCommand({ type: 'set_file_role', payload: { role } });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'dsb_get_file_role',
    'Get the current file role (source, destination, or source+destination)',
    {},
    async () => {
      const result = await bridge.sendCommand({ type: 'get_file_role', payload: {} });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
