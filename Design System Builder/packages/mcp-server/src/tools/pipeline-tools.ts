/**
 * Pipeline orchestration MCP tools — analyze, preview,
 * apply, cross-validate, replicate, and export to Paper.
 *
 * @module tools/pipeline-tools
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge-client';
import type { OpenPencilAdapter } from '../pipeline/openpencil-adapter';
import { analyzeImpact } from '../pipeline/impact-analyzer';
import { WriteGovernor } from '../pipeline/write-governor';
import { planReplication } from '../pipeline/replication-planner';
import type { DeepExtractData } from '../pipeline/replication-planner';
import type { PropertyChange, GovernorCommand } from '../pipeline/types';
import { z } from 'zod';

const SCOPE_SCHEMA = z.object({
  pageIds: z.array(z.string()).optional(),
  nodeIds: z.array(z.string()).optional(),
  componentNames: z.array(z.string()).optional(),
}).optional();

const CHANGE_SCHEMA = z.object({
  nodeId: z.string(),
  property: z.string(),
  oldValue: z.unknown(),
  newValue: z.unknown(),
  tier: z.enum(['primitives', 'semantic', 'component', 'breakpoints']).optional(),
});

const GOVERNOR_COMMAND_SCHEMA = z.object({
  type: z.string(),
  payload: z.record(z.unknown()),
  group: z.enum(['variable-additions', 'node-additions', 'property-changes', 'node-deletions', 'variable-deletions']),
  dependsOn: z.array(z.string()).optional(),
});

/** Helper to return JSON text content. */
function jsonContent(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerPipelineTools(
  server: McpServer,
  bridge: BridgeClient,
  adapter: OpenPencilAdapter,
): void {
  // Tool 1: Analyze source .fig via OpenPencil
  server.tool(
    'dsb_analyze_source',
    'Read source .fig file via OpenPencil — returns tree, variables, components, reactions, fonts',
    { filePath: z.string(), scope: SCOPE_SCHEMA },
    async ({ filePath, scope }) => {
      const analysis = await adapter.readAll(filePath, scope ?? undefined);
      return jsonContent(analysis);
    },
  );

  // Tool 2: Preview cascading impact before applying changes
  server.tool(
    'dsb_preview_impact',
    'Analyze cascading impact of proposed changes through 3-tier tokens and component hierarchy',
    { filePath: z.string(), changes: z.array(CHANGE_SCHEMA) },
    async ({ filePath, changes }) => {
      const source = await adapter.readAll(filePath);
      const report = analyzeImpact(changes as PropertyChange[], source);
      return jsonContent(report);
    },
  );

  // Tool 3: Apply changes via write governor
  server.tool(
    'dsb_apply_changes',
    'Apply ordered changes to destination via adaptive write governor with circuit breaker',
    { commands: z.array(GOVERNOR_COMMAND_SCHEMA), dryRun: z.boolean().optional() },
    async ({ commands, dryRun }) => {
      if (dryRun) {
        return jsonContent({ dryRun: true, commandCount: commands.length, commands });
      }
      const governor = new WriteGovernor(bridge);
      const result = await governor.execute(commands as GovernorCommand[]);
      return jsonContent(result);
    },
  );

  // Tool 4: Cross-validate source vs destination
  server.tool(
    'dsb_cross_validate',
    'Compare source (OpenPencil) against destination (plugin) to find discrepancies',
    { sourceFilePath: z.string() },
    async ({ sourceFilePath }) => {
      const sourceVars = await adapter.readSourceVariables(sourceFilePath);
      const destVars = await bridge.sendCommand({ type: 'get_variables', payload: {} });
      return jsonContent({ source: sourceVars, destination: destVars.data });
    },
  );

  // Tool 5: Check if OpenPencil server is available
  server.tool(
    'dsb_check_openpencil',
    'Check if the OpenPencil MCP server is reachable',
    {},
    async () => {
      const available = await adapter.isAvailable();
      return jsonContent({ available, port: 3100 });
    },
  );

  // Tool 6: Deep extract source and plan replication
  server.tool(
    'dsb_plan_replication',
    'Deep-extract source file via plugin, generate a full replication plan with ordered commands for recreating pages, variables, styles, and nodes in the destination',
    { dryRun: z.boolean().optional().describe('If true, return plan only without executing') },
    async ({ dryRun }) => {
      const extractResult = await bridge.sendCommand({ type: 'deep_extract', payload: {} });
      if (!extractResult.success) {
        return jsonContent({ error: 'Deep extraction failed: ' + extractResult.error });
      }
      const sourceData = extractResult.data as DeepExtractData;
      const plan = planReplication(sourceData);
      if (dryRun) {
        return jsonContent({ dryRun: true, plan });
      }
      return jsonContent({ plan, message: 'Plan generated. Use dsb_execute_replication to apply.' });
    },
  );

  // Tool 7: Execute a replication plan on the destination
  server.tool(
    'dsb_execute_replication',
    'Execute a replication plan phase-by-phase on the destination file via write governor. Pass the phases array from dsb_plan_replication output.',
    {
      phases: z.array(z.object({
        name: z.string(),
        commands: z.array(GOVERNOR_COMMAND_SCHEMA),
      })),
    },
    async ({ phases }) => {
      const governor = new WriteGovernor(bridge);
      const results = [];
      for (const phase of phases) {
        const phaseResult = await governor.execute(phase.commands as GovernorCommand[]);
        results.push({ phase: phase.name, ...phaseResult });
        if (phaseResult.circuitBroken) {
          return jsonContent({
            status: 'circuit_broken',
            completedPhases: results,
            remainingPhases: phases.slice(results.length).map(p => p.name),
          });
        }
      }
      return jsonContent({
        status: 'complete',
        phasesExecuted: results.length,
        results,
      });
    },
  );

  // Tool 8: Unified replicate — full pipeline in one call (zero AI reasoning needed)
  server.tool(
    'dsb_replicate',
    'One-shot replication: extract source design system → generate plan → execute all phases via write governor. Deterministic pipeline — no AI orchestration needed. Supports dry-run preview and resume from a specific phase.',
    {
      dryRun: z.boolean().optional().describe('If true, extract and plan only — do not execute'),
      resumeFrom: z.string().optional().describe('Phase name to resume from (skips earlier completed phases)'),
    },
    async ({ dryRun, resumeFrom }) => {
      // ── Step 1: Deep extract from source ──
      const extractResult = await bridge.sendCommand({ type: 'deep_extract', payload: {} });
      if (!extractResult.success) {
        return jsonContent({ status: 'extract_failed', error: extractResult.error });
      }
      const sourceData = extractResult.data as DeepExtractData;
      const meta = (extractResult.data as Record<string, unknown>)?._meta ?? null;

      // ── Step 2: Generate replication plan ──
      const plan = planReplication(sourceData);
      if (dryRun) {
        return jsonContent({ status: 'dry_run', meta, plan });
      }

      // ── Step 3: Execute all phases (with optional resume) ──
      const governor = new WriteGovernor(bridge);
      const results: Array<Record<string, unknown>> = [];
      let skipping = !!resumeFrom;

      for (const phase of plan.phases) {
        if (skipping) {
          if (phase.name === resumeFrom) {
            skipping = false;
          } else {
            results.push({ phase: phase.name, skipped: true });
            continue;
          }
        }

        const phaseResult = await governor.execute(phase.commands as GovernorCommand[]);
        results.push({ phase: phase.name, ...phaseResult });

        if (phaseResult.circuitBroken) {
          return jsonContent({
            status: 'circuit_broken',
            meta,
            plan: { sourceFileName: plan.sourceFileName, summary: plan.summary },
            completedPhases: results,
            remainingPhases: plan.phases.slice(results.length).map(p => p.name),
          });
        }
      }

      return jsonContent({
        status: 'complete',
        meta,
        plan: {
          sourceFileName: plan.sourceFileName,
          summary: plan.summary,
          totalCommands: plan.totalCommands,
        },
        phasesExecuted: results.filter(r => !r.skipped).length,
        results,
      });
    },
  );
}
