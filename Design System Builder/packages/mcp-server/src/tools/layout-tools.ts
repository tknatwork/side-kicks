/**
 * Layout Tools — MCP tools for creating pages, frames, and visual hierarchy.
 *
 * @module mcp-server/tools/layout-tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge-client';
import { checkFeatureAccess } from '@dsb/licensing';

export function registerLayoutTools(server: McpServer, bridge: BridgeClient): void {
  // ─── Create Page Structure ──────────────────────────────────────────
  server.tool(
    'dsb_create_page_structure',
    'Create the full page hierarchy for a design system: foundation pages + component pages.',
    {
      foundationPages: z.array(z.string()).default([
        'Colors', 'Typography', 'Spacing', 'Shadows & Effects', 'Grid & Layout',
      ]).describe('Foundation page names'),
      componentPages: z.array(z.string()).default([]).describe('Component page names'),
      includeOverview: z.boolean().default(true).describe('Create an Overview page'),
    },
    async ({ foundationPages, componentPages, includeOverview }) => {
      const gate = checkFeatureAccess('create:pages');
      if (!gate.ok) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: gate.error }) }] };
      }

      const allPages: string[] = [];
      if (includeOverview) allPages.push('Overview');
      allPages.push(...foundationPages.map(p => `Foundation / ${p}`));
      allPages.push(...componentPages.map(p => `Components / ${p}`));

      const result = await bridge.sendCommand({
        type: 'create_pages',
        payload: { names: allPages },
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ─── Create Page ────────────────────────────────────────────────────
  server.tool(
    'dsb_create_page',
    'Create a single page in the Figma file.',
    {
      name: z.string().describe('Page name'),
    },
    async ({ name }) => {
      const gate = checkFeatureAccess('create:pages');
      if (!gate.ok) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: gate.error }) }] };
      }

      const result = await bridge.sendCommand({
        type: 'create_page',
        payload: { name },
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ─── Create Frame ───────────────────────────────────────────────────
  server.tool(
    'dsb_create_frame',
    'Create a frame with optional auto-layout configuration.',
    {
      name: z.string(),
      width: z.number().default(1440),
      height: z.number().default(900),
      layoutMode: z.enum(['NONE', 'HORIZONTAL', 'VERTICAL']).default('VERTICAL'),
      itemSpacing: z.number().default(16),
      paddingTop: z.number().default(32),
      paddingRight: z.number().default(32),
      paddingBottom: z.number().default(32),
      paddingLeft: z.number().default(32),
    },
    async (config) => {
      const gate = checkFeatureAccess('create:nodes');
      if (!gate.ok) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: gate.error }) }] };
      }

      const result = await bridge.sendCommand({
        type: 'create_frame',
        payload: config,
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ─── Create Section ─────────────────────────────────────────────────
  server.tool(
    'dsb_create_section',
    'Create a Figma section (grouping container).',
    {
      name: z.string(),
      x: z.number().default(0),
      y: z.number().default(0),
    },
    async ({ name, x, y }) => {
      const gate = checkFeatureAccess('create:nodes');
      if (!gate.ok) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: gate.error }) }] };
      }

      const result = await bridge.sendCommand({
        type: 'create_section',
        payload: { name, x, y },
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ─── Create Text Node ──────────────────────────────────────────────
  server.tool(
    'dsb_create_text',
    'Create a text node in the current page.',
    {
      characters: z.string().describe('The text content'),
      fontFamily: z.string().default('Inter'),
      fontStyle: z.string().default('Regular'),
      fontSize: z.number().default(16),
      x: z.number().default(0),
      y: z.number().default(0),
    },
    async (config) => {
      const gate = checkFeatureAccess('create:nodes');
      if (!gate.ok) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: gate.error }) }] };
      }

      const result = await bridge.sendCommand({
        type: 'create_text',
        payload: config,
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ─── Create Rectangle ──────────────────────────────────────────────
  server.tool(
    'dsb_create_rectangle',
    'Create a rectangle (useful for color swatches).',
    {
      name: z.string().default('Rectangle'),
      width: z.number().default(100),
      height: z.number().default(100),
      color: z.object({
        r: z.number(), g: z.number(), b: z.number(), a: z.number().default(1),
      }).optional().describe('Fill color (RGBA 0-1)'),
    },
    async ({ name, width, height, color }) => {
      const gate = checkFeatureAccess('create:nodes');
      if (!gate.ok) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: gate.error }) }] };
      }

      const result = await bridge.sendCommand({
        type: 'create_rectangle',
        payload: { name, width, height, color },
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
