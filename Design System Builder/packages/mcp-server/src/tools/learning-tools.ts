/**
 * Learning Tools — MCP tools for workspace reading, context persistence,
 * and the study → learn → recommend pipeline.
 *
 * Four tools:
 *   - dsb_read_workspace:     List and read files from workspace/ subdirectories
 *   - dsb_save_context:       Persist learned project/global context to disk
 *   - dsb_load_context:       Load previously saved context for session continuity
 *   - dsb_study_and_learn:    Run the full study→learn→recommend pipeline on workspace files
 *
 * These are free-tier tools (no license required) — reading and context
 * management doesn't create anything in Figma.
 *
 * @module mcp-server/tools/learning-tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge-client';
import {
  listContextFiles,
  listSpecFiles,
  listExportFiles,
  listReportFiles,
  readContextFile,
  readContextJson,
  readMultipleContextFiles,
  readSpecJson,
  saveGlobalContext,
  loadGlobalContext,
  saveProjectContext,
  loadProjectContext,
  loadMergedContext,
  DesignSystemLearner,
} from '@dsb/core';
import type {
  GlobalContext,
  ProjectContext,
  ExtractorConfig,
  SourceFormat,
  GenerationRecommendation,
} from '@dsb/core';

export function registerLearningTools(server: McpServer, _bridge: BridgeClient): void {
  // ─── Read Workspace ─────────────────────────────────────────────────
  server.tool(
    'dsb_read_workspace',
    'List files in a workspace subdirectory, or read specific files from workspace/context/. ' +
    'Use action "list" to see what files are available, or "read" to get file contents. ' +
    'Users drop files into workspace/context/ for you to learn from.',
    {
      action: z.enum(['list', 'read']).describe(
        '"list" to enumerate files in a workspace subdirectory, "read" to get file contents'
      ),
      subdirectory: z.enum(['context', 'specs', 'exports', 'reports']).default('context').describe(
        'Which workspace subdirectory to target'
      ),
      filenames: z.array(z.string()).optional().describe(
        'For action "read": filenames to read from the subdirectory. Omit for "list".'
      ),
    },
    async ({ action, subdirectory, filenames }) => {
      if (action === 'list') {
        const listFn = {
          context: listContextFiles,
          specs: listSpecFiles,
          exports: listExportFiles,
          reports: listReportFiles,
        }[subdirectory];

        const result = listFn();
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

      // action === 'read'
      if (!filenames || filenames.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ error: 'Provide filenames to read.' }),
          }],
        };
      }

      if (subdirectory === 'context') {
        if (filenames.length === 1) {
          // Single file — try JSON parse, fall back to raw text
          const jsonResult = readContextJson(filenames[0]);
          if (jsonResult.ok) {
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({ filename: filenames[0], parsed: true, content: jsonResult.value }, null, 2),
              }],
            };
          }
          const textResult = readContextFile(filenames[0]);
          if (!textResult.ok) {
            return { content: [{ type: 'text' as const, text: JSON.stringify({ error: textResult.error }) }] };
          }
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ filename: filenames[0], parsed: false, content: textResult.value }, null, 2),
            }],
          };
        }

        // Multiple files
        const result = readMultipleContextFiles(filenames);
        if (!result.ok) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: result.error }) }] };
        }
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ filesRead: Object.keys(result.value).length, contents: result.value }, null, 2),
          }],
        };
      }

      // specs subdirectory
      if (subdirectory === 'specs') {
        const specResult = readSpecJson(filenames[0]);
        if (!specResult.ok) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: specResult.error }) }] };
        }
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ filename: filenames[0], content: specResult.value }, null, 2),
          }],
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ error: `Reading from workspace/${subdirectory}/ is not yet supported for individual files.` }),
        }],
      };
    }
  );

  // ─── Save Context ───────────────────────────────────────────────────
  server.tool(
    'dsb_save_context',
    'Persist learned context to disk so it survives across sessions. ' +
    'Use scope "project" for project-specific learnings (tier structure, conventions, gaps), ' +
    'or "global" for user preferences (naming style, preferred fonts, IDE).',
    {
      scope: z.enum(['project', 'global']).describe(
        '"project" for this project, "global" for cross-project preferences'
      ),
      context: z.record(z.unknown()).describe(
        'The context object to persist. Keys depend on scope — see GlobalContext and ProjectContext types.'
      ),
    },
    async ({ scope, context }) => {
      const result = scope === 'global'
        ? saveGlobalContext(context as GlobalContext)
        : saveProjectContext(context as ProjectContext);

      if (!result.ok) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: result.error }) }] };
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ saved: true, scope, path: result.value }),
        }],
      };
    }
  );

  // ─── Load Context ───────────────────────────────────────────────────
  server.tool(
    'dsb_load_context',
    'Load previously saved context from disk. Use at session start to resume ' +
    'where you left off — remembering conventions, tier structure, template matches, and preferences. ' +
    'Use scope "merged" to get both global and project context in one call.',
    {
      scope: z.enum(['project', 'global', 'merged']).default('merged').describe(
        '"project" for this project, "global" for preferences, "merged" for both'
      ),
    },
    async ({ scope }) => {
      if (scope === 'merged') {
        const result = loadMergedContext();
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

      const result = scope === 'global'
        ? loadGlobalContext()
        : loadProjectContext();

      if (!result.ok) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: result.error }) }] };
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ scope, context: result.value }, null, 2),
        }],
      };
    }
  );

  // ─── Study and Learn ────────────────────────────────────────────────
  server.tool(
    'dsb_study_and_learn',
    'Run the full study→learn→recommend pipeline on files from workspace/context/. ' +
    'Reads the specified files, detects their format (Figma JSON, CSS, DTCG), ' +
    'extracts structural fingerprints, synthesizes patterns, and generates ' +
    'recommendations. Optionally saves the recommendation to project context ' +
    'so dsb_start_build can use it. Returns the recommendation for inspection.',
    {
      filenames: z.array(z.string()).describe(
        'Filenames in workspace/context/ to study (e.g., ["ant-design-vars.json", "tailwind.css"]). ' +
        'Use dsb_read_workspace action:list first to see available files.'
      ),
      sourceNames: z.array(z.string()).optional().describe(
        'Human-readable names for each source, in the same order as filenames. ' +
        'Defaults to the filenames themselves.'
      ),
      formatHints: z.array(z.enum([
        'figma-extractor-json', 'css-variables', 'dtcg-json',
        'style-dictionary', 'tokens-studio', 'unknown',
      ])).optional().describe(
        'Format hints for each file, in the same order as filenames. ' +
        'If omitted, format is auto-detected from file content.'
      ),
      autoSave: z.boolean().default(true).describe(
        'Whether to auto-save the recommendation to project context. ' +
        'If false, the recommendation is returned but not persisted — ' +
        'you can call dsb_save_context manually after inspection.'
      ),
    },
    async ({ filenames, sourceNames, formatHints, autoSave }) => {
      if (filenames.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ error: 'Provide at least one filename to study.' }),
          }],
        };
      }

      const learner = new DesignSystemLearner();
      const studyResults: Array<{
        filename: string;
        sourceName: string;
        ok: boolean;
        error?: string;
        warnings: readonly string[];
        durationMs: number;
        variableCount?: number;
        format?: string;
      }> = [];

      // Study each file
      for (let i = 0; i < filenames.length; i++) {
        const filename = filenames[i]!;
        const sourceName = sourceNames?.[i] ?? filename;
        const formatHint = formatHints?.[i] as SourceFormat | undefined;

        // Read the file from workspace/context/
        const fileResult = readContextFile(filename);
        if (!fileResult.ok) {
          studyResults.push({
            filename,
            sourceName,
            ok: false,
            error: `Failed to read file: ${fileResult.error}`,
            warnings: [],
            durationMs: 0,
          });
          continue;
        }

        // Build the extractor config
        const config: ExtractorConfig = {
          sourceName,
          ...(formatHint ? { formatHint } : {}),
        };

        // Run study
        const extraction = learner.study(fileResult.value, config);
        studyResults.push({
          filename,
          sourceName,
          ok: extraction.ok,
          error: extraction.error,
          warnings: extraction.warnings,
          durationMs: extraction.durationMs,
          variableCount: extraction.fingerprint?.source.totalVariables,
          format: extraction.fingerprint?.source.sourceFormat,
        });
      }

      // Check if any studies succeeded
      const successCount = studyResults.filter(r => r.ok).length;
      if (successCount === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: 'All study attempts failed. Check file formats and contents.',
              studies: studyResults,
            }, null, 2),
          }],
        };
      }

      // Learn (synthesize patterns)
      const synthesis = learner.learn();

      // Generate recommendation
      const recommendation = learner.recommend();

      // Auto-save to project context if requested
      let savedPath: string | undefined;
      if (autoSave) {
        // Load existing project context, merge recommendation into it
        const existingCtx = loadProjectContext();
        const ctx: Record<string, unknown> = existingCtx.ok && existingCtx.value
          ? { ...existingCtx.value as Record<string, unknown> }
          : {};

        ctx.recommendation = recommendation;
        ctx.updatedAt = new Date().toISOString();

        const saveResult = saveProjectContext(ctx as ProjectContext);
        if (saveResult.ok) {
          savedPath = saveResult.value;
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            message: `Studied ${successCount}/${filenames.length} source(s). Recommendation generated.`,
            studies: studyResults,
            synthesis: synthesis ? {
              sourceCount: synthesis.sourceCount,
              sourceNames: synthesis.sourceNames,
              dominantSeparator: synthesis.dominantSeparator,
              dominantShadeCount: synthesis.dominantShadeCount,
              tierCountRange: synthesis.tierCountRange,
              commonPatterns: synthesis.commonPatterns,
              divergences: synthesis.divergences,
            } : null,
            recommendation: {
              tierCount: recommendation.recommendedTierCount,
              tiers: recommendation.recommendedTiers.map(t => ({
                name: t.name,
                tier: t.tier,
                modes: t.modes,
                purpose: t.purpose,
              })),
              namingSeparator: recommendation.namingSeparator,
              colorShadeCount: recommendation.colorShadeCount,
              useCrossCollectionAliases: recommendation.useCrossCollectionAliases,
              maxAliasDepth: recommendation.maxAliasDepth,
              bindStylesToVariables: recommendation.bindStylesToVariables,
              confidence: recommendation.confidence,
              rationale: recommendation.rationale,
            },
            saved: autoSave ? { path: savedPath, autoSaved: true } : { autoSaved: false },
            nextStep: autoSave
              ? 'Recommendation saved. It will be used automatically by dsb_start_build.'
              : 'Recommendation NOT saved. Call dsb_save_context with scope:project to persist it.',
          }, null, 2),
        }],
      };
    }
  );
}
