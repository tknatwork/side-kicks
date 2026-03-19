/**
 * File Policy — Determines which files are allowed/blocked based on extension and content.
 *
 * Enforces file type restrictions for workspace/context/ input and
 * prevents accidental processing of secrets, executables, or archives.
 *
 * @module file-policy
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { Result } from './result';
import {
  ALLOWED_EXTENSIONS,
  BLOCKED_EXTENSIONS,
  SECRET_PATTERNS,
  MAX_FILE_SIZE,
  MAX_CONTEXT_SIZE,
} from './constants';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export type FilePolicyVerdict = 'allowed' | 'blocked' | 'warning';

export interface FilePolicyResult {
  readonly verdict: FilePolicyVerdict;
  readonly reason: string;
  readonly extension: string;
  readonly sizeBytes: number;
}

// ============================================================================
// SECTION 2: FILE VALIDATION
// ============================================================================

/**
 * Check if a file is allowed to be processed based on its extension and size.
 *
 * @param filePath - Absolute path to the file (already validated by path-validator).
 * @returns The policy verdict with reason.
 */
export function checkFilePolicy(filePath: string): Result<FilePolicyResult, string> {
  const ext = getExtension(filePath);
  const basename = path.basename(filePath);

  // Check for secret patterns first (highest priority block)
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(basename)) {
      return Result.ok({
        verdict: 'blocked',
        reason: `File "${basename}" matches a secret pattern (${pattern.source}). ` +
          'Secrets must never be processed. Remove this file from workspace/context/.',
        extension: ext,
        sizeBytes: 0,
      });
    }
  }

  // Check blocked extensions
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return Result.ok({
      verdict: 'blocked',
      reason: `Extension "${ext}" is blocked. ` +
        'This file type cannot be processed for safety reasons.',
      extension: ext,
      sizeBytes: 0,
    });
  }

  // Check file size
  let sizeBytes = 0;
  try {
    const stats = fs.statSync(filePath);
    sizeBytes = stats.size;
  } catch {
    // File might not exist yet (being created)
    sizeBytes = 0;
  }

  if (sizeBytes > MAX_FILE_SIZE) {
    return Result.ok({
      verdict: 'blocked',
      reason: `File is ${formatBytes(sizeBytes)} which exceeds the ${formatBytes(MAX_FILE_SIZE)} limit. ` +
        'Split the file or remove unnecessary content.',
      extension: ext,
      sizeBytes,
    });
  }

  // Check if extension is explicitly allowed
  if (ALLOWED_EXTENSIONS.has(ext)) {
    return Result.ok({
      verdict: 'allowed',
      reason: 'File type and size within policy limits.',
      extension: ext,
      sizeBytes,
    });
  }

  // Unknown extension — warn but allow (defensive: don't block unexpectedly)
  return Result.ok({
    verdict: 'warning',
    reason: `Extension "${ext}" is not in the recognized list. ` +
      'Processing with caution. If this is a mistake, remove the file.',
    extension: ext,
    sizeBytes,
  });
}

/**
 * Check if the total size of a directory is within limits.
 *
 * @param dirPath - Absolute path to the directory.
 * @param maxSize - Maximum allowed total size in bytes.
 */
export function checkDirectorySize(
  dirPath: string,
  maxSize: number = MAX_CONTEXT_SIZE
): Result<number, string> {
  let totalSize = 0;

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isFile()) {
        const stats = fs.statSync(fullPath);
        totalSize += stats.size;
      } else if (entry.isDirectory()) {
        // Recurse into subdirectories
        const subResult = checkDirectorySize(fullPath, maxSize);
        if (subResult.ok) {
          totalSize += subResult.value;
        }
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Result.err(`Failed to check directory size: ${message}`);
  }

  if (totalSize > maxSize) {
    return Result.err(
      `Directory "${dirPath}" is ${formatBytes(totalSize)} which exceeds ` +
      `the ${formatBytes(maxSize)} limit. Remove unnecessary files.`
    );
  }

  return Result.ok(totalSize);
}

// ============================================================================
// SECTION 3: HELPERS
// ============================================================================

/**
 * Extract the file extension, handling compound extensions like .tokens.json.
 */
function getExtension(filePath: string): string {
  const basename = path.basename(filePath);

  // Handle compound extensions
  if (basename.endsWith('.tokens.json')) return '.tokens.json';
  if (basename.endsWith('.config.js')) return '.config.js';
  if (basename.endsWith('.config.ts')) return '.config.ts';
  if (basename.endsWith('.env.local')) return '.env.local';

  // Check for .env.* patterns
  const envMatch = basename.match(/^\.env\..+$/);
  if (envMatch) return '.env.local'; // Treat all .env.* as blocked

  return path.extname(filePath).toLowerCase();
}

/**
 * Format bytes into a human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
