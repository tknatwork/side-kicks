/**
 * Token Tools — MCP tools for creating and managing Figma variable collections.
 *
 * These are the core design system building tools that create the
 * 3-tier variable architecture: Primitives → Semantic → Component.
 *
 * @module mcp-server/tools/token-tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge-client';
import { checkFeatureAccess } from '@dsb/licensing';
import {
  generateAllTokens,
  generatePrimitives,
  generateSemanticTokens,
  generateComponentTokens,
} from '@dsb/core';
import type { DesignSystemSpec } from '@dsb/core';

export function registerTokenTools(server: McpServer, bridge: BridgeClient): void {
  // ─── Create Full 3-Tier System ──────────────────────────────────────
  server.tool(
    'dsb_build_token_system',
    'Build the complete 3-tier variable system (Primitives → Semantic → Component) from a design system spec. This is the primary build command.',
    {
      spec: z.object({
        name: z.string(),
        version: z.string().default('1.0.0'),
        framework: z.string().default('react'),
        palette: z.object({
          primary: z.string().describe('Primary color as hex, e.g., "#3B82F6"'),
          secondary: z.string().optional(),
          accent: z.string().optional(),
          success: z.string().optional(),
          warning: z.string().optional(),
          error: z.string().optional(),
        }),
        typography: z.object({
          headingFont: z.string().default('Inter'),
          bodyFont: z.string().default('Inter'),
          baseFontSize: z.number().default(16),
        }),
        spacing: z.object({
          baseUnit: z.number().default(4),
          scale: z.array(z.number()).default([0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24]),
        }),
        themes: z.array(z.string()).default(['Light', 'Dark']),
        components: z.array(z.string()).default(['Button', 'Card']),
      }).describe('Full design system specification'),
    },
    async ({ spec }) => {
      const gate = checkFeatureAccess('create:collection');
      if (!gate.ok) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: gate.error }) }] };
      }

      // Build the tier architecture
      const fullSpec: DesignSystemSpec = {
        name: spec.name,
        version: spec.version,
        createdAt: new Date().toISOString().split('T')[0],
        framework: spec.framework,
        tiers: {
          primitives: { collectionName: 'Primitives', modes: ['Value'], tier: 'primitives' },
          semantic: { collectionName: 'Semantic', modes: ['Value'], tier: 'semantic' },
          component: { collectionName: 'Mapped', modes: spec.themes, tier: 'component' },
        },
        palette: spec.palette,
        typography: spec.typography,
        spacing: spec.spacing,
        components: spec.components,
      };

      // Generate all tokens
      const tokenResult = generateAllTokens(fullSpec);
      if (!tokenResult.ok) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: tokenResult.error }) }] };
      }

      const tokens = tokenResult.value;
      const results: unknown[] = [];

      // Step 1: Create Primitives collection
      const primResult = await bridge.sendCommand({
        type: 'create_collection',
        payload: { name: 'Primitives', modes: ['Value'] },
      });
      results.push({ step: 'create_primitives_collection', ...primResult });

      if (primResult.success && primResult.data) {
        const collectionId = (primResult.data as Record<string, unknown>).collectionId as string;

        // Batch create primitive variables
        const primVars = tokens.primitives.map(v => ({
          name: v.name,
          type: v.type,
        }));

        const batchResult = await bridge.sendCommand({
          type: 'batch_create_variables',
          payload: { collectionId, variables: primVars },
        });
        results.push({ step: 'create_primitive_variables', ...batchResult });
      }

      // Step 2: Create Semantic collection
      const semResult = await bridge.sendCommand({
        type: 'create_collection',
        payload: { name: 'Semantic', modes: ['Value'] },
      });
      results.push({ step: 'create_semantic_collection', ...semResult });

      // Step 3: Create Mapped (Component) collection
      const mapResult = await bridge.sendCommand({
        type: 'create_collection',
        payload: { name: 'Mapped', modes: spec.themes },
      });
      results.push({ step: 'create_mapped_collection', ...mapResult });

      const hasErrors = results.some((r: any) => !r.success);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: !hasErrors,
            tokenCounts: {
              primitives: tokens.primitives.length,
              semantic: tokens.semantic.length,
              component: tokens.component.length,
              total: tokens.primitives.length + tokens.semantic.length + tokens.component.length,
            },
            steps: results,
            message: hasErrors
              ? 'Some steps failed. Check the steps array for details.'
              : `Created ${tokens.primitives.length + tokens.semantic.length + tokens.component.length} tokens across 3 collections.`,
          }, null, 2),
        }],
      };
    }
  );

  // ─── Create Single Collection ───────────────────────────────────────
  server.tool(
    'dsb_create_collection',
    'Create a single Figma variable collection with specified modes.',
    {
      name: z.string().describe('Collection name, e.g., "Primitives", "Semantic", "Mapped"'),
      modes: z.array(z.string()).describe('Mode names, e.g., ["Value"] or ["Light", "Dark"]'),
    },
    async ({ name, modes }) => {
      const gate = checkFeatureAccess('create:collection');
      if (!gate.ok) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: gate.error }) }] };
      }

      const result = await bridge.sendCommand({
        type: 'create_collection',
        payload: { name, modes },
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ─── Batch Create Variables ─────────────────────────────────────────
  server.tool(
    'dsb_batch_create_variables',
    'Create multiple variables in a collection at once.',
    {
      collectionId: z.string().describe('The collection ID to add variables to'),
      variables: z.array(z.object({
        name: z.string(),
        type: z.enum(['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']),
      })).describe('Variables to create'),
    },
    async ({ collectionId, variables }) => {
      const gate = checkFeatureAccess('batch:variables');
      if (!gate.ok) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: gate.error }) }] };
      }

      const result = await bridge.sendCommand({
        type: 'batch_create_variables',
        payload: { collectionId, variables },
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ─── Set Variable Value ─────────────────────────────────────────────
  server.tool(
    'dsb_set_variable_value',
    'Set the value of a variable for a specific mode.',
    {
      variableId: z.string(),
      modeId: z.string(),
      value: z.unknown().describe('The value to set (color object, number, string, or boolean)'),
    },
    async ({ variableId, modeId, value }) => {
      const gate = checkFeatureAccess('create:variables');
      if (!gate.ok) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: gate.error }) }] };
      }

      const result = await bridge.sendCommand({
        type: 'set_variable_value',
        payload: { variableId, modeId, value },
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ─── Set Variable Alias ─────────────────────────────────────────────
  server.tool(
    'dsb_set_variable_alias',
    'Set a variable to alias (reference) another variable.',
    {
      variableId: z.string().describe('The variable to set the alias on'),
      modeId: z.string().describe('The mode to set the alias for'),
      targetVariableId: z.string().describe('The variable to alias to'),
    },
    async ({ variableId, modeId, targetVariableId }) => {
      const gate = checkFeatureAccess('batch:aliases');
      if (!gate.ok) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: gate.error }) }] };
      }

      const result = await bridge.sendCommand({
        type: 'set_variable_alias',
        payload: { variableId, modeId, targetVariableId },
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
