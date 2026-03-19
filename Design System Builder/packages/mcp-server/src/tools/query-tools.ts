/**
 * Query Tools — MCP tools for reading Figma file state (read-only).
 *
 * These tools are available on the free tier.
 *
 * @module mcp-server/tools/query-tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge-client';

export function registerQueryTools(server: McpServer, bridge: BridgeClient): void {
  // ─── Get File Info ──────────────────────────────────────────────────
  server.tool(
    'dsb_get_file_info',
    'Get overview of the current Figma file: page count, collection count, variable count, style count.',
    {},
    async () => {
      const result = await bridge.sendCommand({
        type: 'get_file_info',
        payload: {},
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ─── Get Collection Details ─────────────────────────────────────────
  server.tool(
    'dsb_get_collection_details',
    'Get detailed information about all variable collections: names, modes, variable counts.',
    {},
    async () => {
      const result = await bridge.sendCommand({
        type: 'get_collection_details',
        payload: {},
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ─── Get Collections ────────────────────────────────────────────────
  server.tool(
    'dsb_get_collections',
    'List all variable collections with their IDs and mode names.',
    {},
    async () => {
      const result = await bridge.sendCommand({
        type: 'get_collections',
        payload: {},
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ─── Get Variables ──────────────────────────────────────────────────
  server.tool(
    'dsb_get_variables',
    'List all variables with their IDs, names, types, and collection associations.',
    {},
    async () => {
      const result = await bridge.sendCommand({
        type: 'get_variables',
        payload: {},
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ─── Get Styles ─────────────────────────────────────────────────────
  server.tool(
    'dsb_get_styles',
    'List all Figma styles (color, text, effect) in the current file.',
    {},
    async () => {
      const result = await bridge.sendCommand({
        type: 'get_styles',
        payload: {},
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ─── Get Pages ──────────────────────────────────────────────────────
  server.tool(
    'dsb_get_pages',
    'List all pages in the current Figma file.',
    {},
    async () => {
      const result = await bridge.sendCommand({
        type: 'get_pages',
        payload: {},
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ─── Check Fonts ────────────────────────────────────────────────────
  server.tool(
    'dsb_check_fonts',
    'Check if specified fonts are available in the current Figma environment.',
    {
      fonts: z.array(z.object({
        family: z.string(),
        style: z.string().default('Regular'),
      })).describe('Font families and styles to check'),
    },
    async ({ fonts }) => {
      const result = await bridge.sendCommand({
        type: 'check_fonts',
        payload: { fonts },
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ─── Get Selection ──────────────────────────────────────────────────
  server.tool(
    'dsb_get_selection',
    'Get information about the currently selected nodes in Figma.',
    {},
    async () => {
      const result = await bridge.sendCommand({
        type: 'get_selection_info',
        payload: {},
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
