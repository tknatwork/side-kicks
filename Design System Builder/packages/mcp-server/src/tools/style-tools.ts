/**
 * Style Tools — MCP tools for creating Figma styles from variables.
 *
 * @module mcp-server/tools/style-tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge-client';
import { checkFeatureAccess } from '@dsb/licensing';

export function registerStyleTools(server: McpServer, bridge: BridgeClient): void {
  // ─── Create Color Style ─────────────────────────────────────────────
  server.tool(
    'dsb_create_color_style',
    'Create a Figma color style (PaintStyle).',
    {
      name: z.string().describe('Style name, e.g., "Primary/500"'),
      color: z.object({
        r: z.number().min(0).max(1),
        g: z.number().min(0).max(1),
        b: z.number().min(0).max(1),
        a: z.number().min(0).max(1).default(1),
      }).describe('RGBA color (0-1 range, Figma format)'),
    },
    async ({ name, color }) => {
      const gate = checkFeatureAccess('create:styles');
      if (!gate.ok) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: gate.error }) }] };
      }

      const result = await bridge.sendCommand({
        type: 'create_color_style',
        payload: { name, color },
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ─── Create Text Style ──────────────────────────────────────────────
  server.tool(
    'dsb_create_text_style',
    'Create a Figma text style with font, size, and spacing settings.',
    {
      name: z.string().describe('Style name, e.g., "Heading/H1"'),
      fontFamily: z.string().default('Inter'),
      fontStyle: z.string().default('Regular'),
      fontSize: z.number().describe('Font size in pixels'),
      lineHeight: z.number().optional().describe('Line height in pixels'),
      letterSpacing: z.number().optional().describe('Letter spacing in pixels'),
    },
    async ({ name, fontFamily, fontStyle, fontSize, lineHeight, letterSpacing }) => {
      const gate = checkFeatureAccess('create:styles');
      if (!gate.ok) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: gate.error }) }] };
      }

      const result = await bridge.sendCommand({
        type: 'create_text_style',
        payload: { name, fontFamily, fontStyle, fontSize, lineHeight, letterSpacing },
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ─── Create Effect Style ────────────────────────────────────────────
  server.tool(
    'dsb_create_effect_style',
    'Create a Figma effect style (drop shadow).',
    {
      name: z.string().describe('Style name, e.g., "Shadow/Medium"'),
      offsetX: z.number().default(0),
      offsetY: z.number().default(4),
      radius: z.number().default(8),
      spread: z.number().default(0),
      color: z.object({
        r: z.number(), g: z.number(), b: z.number(), a: z.number(),
      }).optional().describe('Shadow color (RGBA 0-1)'),
    },
    async ({ name, offsetX, offsetY, radius, spread, color }) => {
      const gate = checkFeatureAccess('create:styles');
      if (!gate.ok) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: gate.error }) }] };
      }

      const result = await bridge.sendCommand({
        type: 'create_effect_style',
        payload: { name, offsetX, offsetY, radius, spread, color },
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ─── Create Grid Style ──────────────────────────────────────────────
  server.tool(
    'dsb_create_grid_style',
    'Create a Figma grid style (column layout).',
    {
      name: z.string().describe('Style name, e.g., "Grid/12-Column"'),
      count: z.number().default(12).describe('Number of columns'),
      gutterSize: z.number().default(16).describe('Gutter width in pixels'),
      margin: z.number().default(24).describe('Margin width in pixels'),
      alignment: z.enum(['MIN', 'CENTER', 'STRETCH']).default('STRETCH'),
    },
    async ({ name, count, gutterSize, margin, alignment }) => {
      const gate = checkFeatureAccess('create:styles');
      if (!gate.ok) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: gate.error }) }] };
      }

      const result = await bridge.sendCommand({
        type: 'create_grid_style',
        payload: { name, count, gutterSize, margin, alignment },
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
