/**
 * Context Store — Persists and loads project/global context for learning.
 *
 * Stores context as JSON files through guardrails' safe I/O.
 *
 * Two layers:
 *   - Project context: `<dsb-root>/.dsb/project-context.json`
 *   - Global context:  `~/.dsb/global-context.json`
 *
 * Claude uses saved context to resume where it left off across sessions —
 * remembering conventions, tier structure, template matches, and preferences.
 *
 * @module core/learning/context-store
 */

import * as path from 'node:path';
import * as os from 'node:os';
import { Result, safeReadJson, safeWriteJson, safeExists, DSB_ROOT } from '@dsb/guardrails';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

/** Context that persists across all projects (user preferences). */
export interface GlobalContext {
  readonly namingConvention?: 'camelCase' | 'kebab-case' | 'slash-separated';
  readonly defaultFontFamily?: string;
  readonly defaultBodyFont?: string;
  readonly preferredColorFormat?: 'hex' | 'hsl' | 'rgb' | 'oklch';
  readonly ide?: string;
  readonly platform?: string;
  readonly figmaPlan?: string;
  readonly connectedMcpServers?: string[];
  readonly updatedAt?: string;
}

/** Context specific to a single project (learned from scanning). */
export interface ProjectContext {
  readonly projectName?: string;
  readonly figmaFileKey?: string;
  readonly detectedTierStructure?: {
    readonly hasPrimitives: boolean;
    readonly hasSemantic: boolean;
    readonly hasComponent: boolean;
    readonly hasBreakpoints: boolean;
  };
  readonly detectedConventions?: {
    readonly naming?: string;
    readonly grouping?: string;
    readonly colorFormat?: string;
  };
  readonly templateMatch?: {
    readonly template: string;
    readonly score: number;
  };
  readonly framework?: string;
  readonly cssApproach?: string;
  readonly existingCollections?: string[];
  readonly existingStyleCount?: {
    readonly color: number;
    readonly text: number;
    readonly effect: number;
  };
  readonly gapAnalysis?: {
    readonly missingTiers: string[];
    readonly orphanedStyles: number;
    readonly inconsistentAliases: number;
  };
  readonly previousSpecs?: Array<{
    readonly version: string;
    readonly createdAt: string;
    readonly summary: string;
  }>;
  readonly updatedAt?: string;
}

// ============================================================================
// SECTION 2: PATH RESOLUTION
// ============================================================================

function globalContextPath(): string {
  return path.join(os.homedir(), '.dsb', 'global-context.json');
}

function projectContextPath(): string {
  return path.join(DSB_ROOT, '.dsb', 'project-context.json');
}

// ============================================================================
// SECTION 3: SAVE / LOAD
// ============================================================================

/**
 * Save global context (user preferences, cross-project).
 */
export function saveGlobalContext(ctx: GlobalContext): Result<string, string> {
  const stamped = { ...ctx, updatedAt: new Date().toISOString() };
  return safeWriteJson(globalContextPath(), stamped);
}

/**
 * Load global context. Returns empty object if no context file exists.
 */
export function loadGlobalContext(): Result<GlobalContext, string> {
  const exists = safeExists(globalContextPath());
  if (!exists.ok) return exists;
  if (!exists.value) return Result.ok({});

  return safeReadJson<GlobalContext>(globalContextPath());
}

/**
 * Save project context (learned structure, conventions, gaps).
 */
export function saveProjectContext(ctx: ProjectContext): Result<string, string> {
  const stamped = { ...ctx, updatedAt: new Date().toISOString() };
  return safeWriteJson(projectContextPath(), stamped);
}

/**
 * Load project context. Returns empty object if no context file exists.
 */
export function loadProjectContext(): Result<ProjectContext, string> {
  const exists = safeExists(projectContextPath());
  if (!exists.ok) return exists;
  if (!exists.value) return Result.ok({});

  return safeReadJson<ProjectContext>(projectContextPath());
}

/**
 * Merge global + project context into a single object for Claude's consumption.
 *
 * Project context takes priority over global where keys overlap.
 */
export function loadMergedContext(): Result<{ global: GlobalContext; project: ProjectContext }, string> {
  const globalResult = loadGlobalContext();
  if (!globalResult.ok) return globalResult;

  const projectResult = loadProjectContext();
  if (!projectResult.ok) return projectResult;

  return Result.ok({
    global: globalResult.value,
    project: projectResult.value,
  });
}
