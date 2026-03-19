/**
 * Path Validator — Ensures all file operations stay within sandbox boundaries.
 *
 * Every file read/write must pass through validatePath() before execution.
 * Prevents path traversal attacks, symlink escapes, and out-of-bounds access.
 *
 * @module path-validator
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { Result } from './result';
import { READ_ALLOWED_ROOTS, WRITE_ALLOWED_ROOTS } from './constants';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export type FileOperation = 'read' | 'write' | 'delete';

export interface PathValidationResult {
  /** The fully resolved, safe absolute path. */
  readonly resolvedPath: string;
  /** Which allowed root this path falls under. */
  readonly matchedRoot: string;
}

// ============================================================================
// SECTION 2: PATH VALIDATION
// ============================================================================

/**
 * Validates that a requested path is within the sandbox boundary.
 *
 * @param requestedPath - The path the caller wants to access.
 * @param operation - The type of operation (read, write, delete).
 * @returns The resolved safe path, or an error explaining the denial.
 */
export function validatePath(
  requestedPath: string,
  operation: FileOperation
): Result<PathValidationResult, string> {
  // Reject empty paths
  if (!requestedPath || requestedPath.trim().length === 0) {
    return Result.err('Path is empty or whitespace');
  }

  // Reject paths with null bytes (path traversal attack vector)
  if (requestedPath.includes('\0')) {
    return Result.err('Path contains null bytes — rejected as potential attack');
  }

  // Resolve to absolute path (handles .., ., ~, relative paths)
  const resolved = path.resolve(requestedPath);

  // Resolve symlinks to prevent symlink-based escapes
  let realPath: string;
  try {
    // If the file exists, resolve its real path (follows symlinks)
    realPath = fs.realpathSync(resolved);
  } catch {
    // File doesn't exist yet (write operation) — use the resolved path
    // but verify the parent directory exists and is within bounds
    realPath = resolved;

    if (operation === 'write') {
      const parentDir = path.dirname(resolved);
      try {
        const realParent = fs.realpathSync(parentDir);
        // Reconstruct: real parent + filename
        realPath = path.join(realParent, path.basename(resolved));
      } catch {
        // Parent directory doesn't exist — caller needs to create it
        // Still validate the intended path
        realPath = resolved;
      }
    }
  }

  // Select allowed roots based on operation
  const allowedRoots = getAllowedRoots(operation);

  // Check if the resolved path falls under any allowed root
  for (const root of allowedRoots) {
    if (isWithinRoot(realPath, root)) {
      return Result.ok({
        resolvedPath: realPath,
        matchedRoot: root,
      });
    }
  }

  // Path is outside all allowed boundaries
  const rootList = allowedRoots.join('\n  - ');
  return Result.err(
    `Access denied: "${realPath}" is outside sandbox boundaries.\n` +
    `Operation: ${operation}\n` +
    `Allowed roots:\n  - ${rootList}\n` +
    `If you need this file, place it in workspace/context/.`
  );
}

/**
 * Validates a path specifically for the delete operation.
 * Delete is more restrictive — only allowed in workspace/temp/ and workspace/reports/audit.log rotation.
 */
export function validateDeletePath(requestedPath: string): Result<PathValidationResult, string> {
  const validation = validatePath(requestedPath, 'delete');
  if (!validation.ok) return validation;

  const resolved = validation.value.resolvedPath;

  // Deletes are only allowed in workspace/temp/
  const tempRoot = path.resolve(validation.value.matchedRoot, '..', 'temp');
  if (!isWithinRoot(resolved, tempRoot)) {
    return Result.err(
      `Delete denied: Can only delete files in workspace/temp/. ` +
      `"${resolved}" is outside the deletable boundary.`
    );
  }

  return validation;
}

// ============================================================================
// SECTION 3: HELPERS
// ============================================================================

/**
 * Check if a path is within a given root directory.
 * Uses string prefix check after normalization.
 */
function isWithinRoot(filePath: string, root: string): boolean {
  const normalizedPath = path.normalize(filePath) + path.sep;
  const normalizedRoot = path.normalize(root) + path.sep;
  return normalizedPath.startsWith(normalizedRoot) || path.normalize(filePath) === path.normalize(root);
}

/**
 * Get the allowed roots for a given operation type.
 */
function getAllowedRoots(operation: FileOperation): readonly string[] {
  switch (operation) {
    case 'read':
      return READ_ALLOWED_ROOTS;
    case 'write':
      return WRITE_ALLOWED_ROOTS;
    case 'delete':
      return WRITE_ALLOWED_ROOTS; // Same as write, further restricted in validateDeletePath
  }
}
