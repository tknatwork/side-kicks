/**
 * Workspace Reader — Lists and reads files from workspace/context/.
 *
 * This is Claude's sandboxed window into the user's provided files.
 * Users drop brand guidelines, token JSONs, CSS files, etc. into
 * workspace/context/ and then ask Claude to "learn from my context files."
 *
 * Claude uses this module (via MCP tools) to enumerate and read those files,
 * then applies its own reasoning to detect conventions, gaps, and patterns.
 * No analysis code here — that's Claude's job.
 *
 * @module core/learning/workspace-reader
 */

import * as path from 'node:path';
import {
  Result,
  safeReadFile,
  safeReadJson,
  safeListDir,
  safeExists,
  DSB_ROOT,
  checkFilePolicy,
} from '@dsb/guardrails';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export interface WorkspaceFile {
  readonly name: string;
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly extension: string;
  readonly sizeHint: 'small' | 'medium' | 'large';
}

export interface WorkspaceManifest {
  readonly files: WorkspaceFile[];
  readonly totalCount: number;
  readonly byExtension: Record<string, number>;
}

// ============================================================================
// SECTION 2: PATHS
// ============================================================================

function contextDir(): string {
  return path.join(DSB_ROOT, 'workspace', 'context');
}

function specsDir(): string {
  return path.join(DSB_ROOT, 'workspace', 'specs');
}

function exportsDir(): string {
  return path.join(DSB_ROOT, 'workspace', 'exports');
}

function reportsDir(): string {
  return path.join(DSB_ROOT, 'workspace', 'reports');
}

// ============================================================================
// SECTION 3: LISTING
// ============================================================================

/**
 * List all files in workspace/context/ that pass file policy checks.
 *
 * Returns a manifest with file metadata — Claude decides which to read.
 */
export function listContextFiles(): Result<WorkspaceManifest, string> {
  return listWorkspaceDir(contextDir(), 'context');
}

/**
 * List files in workspace/specs/.
 */
export function listSpecFiles(): Result<WorkspaceManifest, string> {
  return listWorkspaceDir(specsDir(), 'specs');
}

/**
 * List files in workspace/exports/.
 */
export function listExportFiles(): Result<WorkspaceManifest, string> {
  return listWorkspaceDir(exportsDir(), 'exports');
}

/**
 * List files in workspace/reports/.
 */
export function listReportFiles(): Result<WorkspaceManifest, string> {
  return listWorkspaceDir(reportsDir(), 'reports');
}

function listWorkspaceDir(dirPath: string, subdir: string): Result<WorkspaceManifest, string> {
  const exists = safeExists(dirPath);
  if (!exists.ok) return exists;
  if (!exists.value) {
    return Result.ok({ files: [], totalCount: 0, byExtension: {} });
  }

  const listing = safeListDir(dirPath);
  if (!listing.ok) return listing;

  const files: WorkspaceFile[] = [];
  const byExtension: Record<string, number> = {};

  for (const name of listing.value) {
    // Skip dotfiles and gitkeep
    if (name.startsWith('.')) continue;
    if (name === 'README.md' && subdir === 'context') continue;

    const absPath = path.join(dirPath, name);
    const ext = path.extname(name).toLowerCase();

    // Check file policy (skip blocked extensions)
    const policy = checkFilePolicy(absPath);
    if (!policy.ok || policy.value.verdict === 'blocked') continue;

    files.push({
      name,
      relativePath: `workspace/${subdir}/${name}`,
      absolutePath: absPath,
      extension: ext,
      sizeHint: guessSizeHint(ext),
    });

    byExtension[ext] = (byExtension[ext] || 0) + 1;
  }

  return Result.ok({
    files,
    totalCount: files.length,
    byExtension,
  });
}

function guessSizeHint(ext: string): 'small' | 'medium' | 'large' {
  const large = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.svg']);
  const medium = new Set(['.json', '.tokens', '.tokens.json', '.css', '.scss']);
  if (large.has(ext)) return 'large';
  if (medium.has(ext)) return 'medium';
  return 'small';
}

// ============================================================================
// SECTION 4: READING
// ============================================================================

/**
 * Read a single file from workspace/context/ by filename.
 *
 * Returns the raw text content. For JSON files, use readContextJson().
 */
export function readContextFile(filename: string): Result<string, string> {
  const absPath = path.join(contextDir(), filename);
  return safeReadFile(absPath);
}

/**
 * Read and parse a JSON file from workspace/context/.
 */
export function readContextJson<T = unknown>(filename: string): Result<T, string> {
  const absPath = path.join(contextDir(), filename);
  return safeReadJson<T>(absPath);
}

/**
 * Read a spec file from workspace/specs/.
 */
export function readSpecFile(filename: string): Result<string, string> {
  const absPath = path.join(specsDir(), filename);
  return safeReadFile(absPath);
}

/**
 * Read and parse a JSON spec file.
 */
export function readSpecJson<T = unknown>(filename: string): Result<T, string> {
  const absPath = path.join(specsDir(), filename);
  return safeReadJson<T>(absPath);
}

/**
 * Read multiple context files at once. Returns a map of filename → content.
 * Skips files that fail to read (logs the error but continues).
 */
export function readMultipleContextFiles(
  filenames: string[]
): Result<Record<string, string>, string> {
  const results: Record<string, string> = {};

  for (const filename of filenames) {
    const result = readContextFile(filename);
    if (result.ok) {
      results[filename] = result.value;
    }
    // Skip failures silently — caller sees which files succeeded
  }

  return Result.ok(results);
}
