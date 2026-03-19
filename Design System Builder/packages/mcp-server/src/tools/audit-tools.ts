/**
 * Audit Tools — MCP tools for design linting, parity checks, and health scores.
 * @module mcp-server/tools/audit-tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge-client';

export function registerAuditTools(server: McpServer, bridge: BridgeClient): void {
  server.tool(
    'dsb_lint_design',
    'Run a design lint: WCAG accessibility checks, hardcoded color detection, detached component audit.',
    {},
    async () => {
      const result = await bridge.sendCommand({ type: 'lint_design', payload: {} });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'dsb_check_design_parity',
    'Compare a Figma node\'s design specs against a code snippet to identify parity gaps.',
    {
      nodeId: z.string().describe('Figma node ID to extract specs from'),
      codeSnippet: z.string().describe('Code implementation to compare against'),
    },
    async ({ nodeId, codeSnippet }) => {
      const result = await bridge.sendCommand({ type: 'check_design_parity', payload: { nodeId, codeSnippet } });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'dsb_get_design_health_score',
    'Get a weighted 0-100 health score: token coverage, style adoption, component usage, consistency, integrity.',
    {},
    async () => {
      const result = await bridge.sendCommand({ type: 'get_design_health_score', payload: {} });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
