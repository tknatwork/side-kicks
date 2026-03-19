/**
 * Export Tools — MCP tools for exporting and validating design tokens.
 *
 * Export and validation tools are available on the free tier.
 *
 * @module mcp-server/tools/export-tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge-client';
import { checkFeatureAccess } from '@dsb/licensing';
import {
  validateTokens,
  getPlanLimits,
  exportDtcgFormat,
  exportCurrentFormat,
} from '@dsb/core';
import type { DesignSystemSpec, VariableDefinition } from '@dsb/core';

export function registerExportTools(server: McpServer, _bridge: BridgeClient): void {
  // ─── Validate Tokens ────────────────────────────────────────────────
  server.tool(
    'dsb_validate_tokens',
    'Validate a set of token definitions against 3-tier rules, naming conventions, and Figma plan limits.',
    {
      variables: z.array(z.object({
        name: z.string(),
        type: z.enum(['color', 'float', 'string', 'boolean']),
        scopes: z.array(z.string()),
        values: z.record(z.unknown()),
        tier: z.enum(['primitives', 'semantic', 'component', 'breakpoints']),
      })).describe('Token definitions to validate'),
      spec: z.object({
        name: z.string(),
        version: z.string(),
        createdAt: z.string(),
        framework: z.string(),
        tiers: z.object({
          primitives: z.object({ collectionName: z.string(), modes: z.array(z.string()), tier: z.literal('primitives') }),
          semantic: z.object({ collectionName: z.string(), modes: z.array(z.string()), tier: z.literal('semantic') }),
          component: z.object({ collectionName: z.string(), modes: z.array(z.string()), tier: z.literal('component') }),
        }),
        palette: z.record(z.string()),
        typography: z.object({ headingFont: z.string(), bodyFont: z.string(), baseFontSize: z.number() }),
        spacing: z.object({ baseUnit: z.number(), scale: z.array(z.number()) }),
        components: z.array(z.string()),
      }).describe('Design system spec for validation context'),
      figmaPlan: z.string().default('professional').describe('Figma plan name for limit checks'),
    },
    async ({ variables, spec, figmaPlan }) => {
      const report = validateTokens(
        variables as unknown as ReadonlyArray<VariableDefinition>,
        spec as unknown as DesignSystemSpec,
        figmaPlan
      );

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(report, null, 2),
        }],
      };
    }
  );

  // ─── Check Plan Limits ──────────────────────────────────────────────
  server.tool(
    'dsb_check_plan_limits',
    'Check Figma plan limits for variable counts, mode counts, and collection counts.',
    {
      planName: z.string().default('professional').describe('Figma plan: starter, professional, organization, enterprise'),
    },
    async ({ planName }) => {
      const limits = getPlanLimits(planName);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ plan: planName, limits }, null, 2),
        }],
      };
    }
  );

  // ─── Export DTCG ────────────────────────────────────────────────────
  server.tool(
    'dsb_export_dtcg',
    'Export tokens in W3C Design Token Community Group (DTCG) format.',
    {
      variables: z.array(z.object({
        name: z.string(),
        type: z.enum(['color', 'float', 'string', 'boolean']),
        scopes: z.array(z.string()),
        values: z.record(z.unknown()),
        tier: z.enum(['primitives', 'semantic', 'component', 'breakpoints']),
      })).describe('Token definitions to export'),
      modeName: z.string().default('Value').describe('Which mode to export values for'),
    },
    async ({ variables, modeName }) => {
      const result = exportDtcgFormat(
        variables as unknown as ReadonlyArray<VariableDefinition>,
        modeName
      );

      if (!result.ok) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: result.error }) }] };
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result.value, null, 2),
        }],
      };
    }
  );

  // ─── Export Current Format ──────────────────────────────────────────
  server.tool(
    'dsb_export_json',
    'Export tokens in the current JSON format (compatible with Variables & Styles Extractor).',
    {
      variables: z.array(z.object({
        name: z.string(),
        type: z.enum(['color', 'float', 'string', 'boolean']),
        scopes: z.array(z.string()),
        values: z.record(z.unknown()),
        tier: z.enum(['primitives', 'semantic', 'component', 'breakpoints']),
      })).describe('Token definitions to export'),
      tiers: z.object({
        primitives: z.object({ collectionName: z.string(), modes: z.array(z.string()), tier: z.literal('primitives') }),
        semantic: z.object({ collectionName: z.string(), modes: z.array(z.string()), tier: z.literal('semantic') }),
        component: z.object({ collectionName: z.string(), modes: z.array(z.string()), tier: z.literal('component') }),
      }).describe('Tier architecture for grouping'),
    },
    async ({ variables, tiers }) => {
      const result = exportCurrentFormat(
        variables as unknown as ReadonlyArray<VariableDefinition>,
        tiers as any
      );

      if (!result.ok) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: result.error }) }] };
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result.value, null, 2),
        }],
      };
    }
  );
}
