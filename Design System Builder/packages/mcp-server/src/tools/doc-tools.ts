/**
 * Doc Tools — auto-generate component documentation from Figma metadata.
 * @module mcp-server/tools/doc-tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge-client';

export function registerDocTools(server: McpServer, bridge: BridgeClient): void {
  server.tool(
    'dsb_generate_component_doc',
    'Auto-generate markdown documentation from a component\'s metadata (properties, variants, description).',
    { componentId: z.string().describe('Component or ComponentSet ID') },
    async ({ componentId }) => {
      const result = await bridge.sendCommand({ type: 'generate_component_doc', payload: { componentId } });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
