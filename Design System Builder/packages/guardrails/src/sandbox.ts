/**
 * Sandbox — High-level convenience API for safe file operations.
 *
 * Wraps Node.js fs operations with guardrail enforcement.
 * All file I/O in DSB should go through this module instead of using fs directly.
 *
 * @module sandbox
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Result } from './result';
import { guardRead, guardWrite, guardOperation } from './operation-guard';
import { auditLog } from './audit-log';

// ============================================================================
// SECTION 1: SAFE FILE OPERATIONS
// ============================================================================

/**
 * Safely read a file within the sandbox.
 *
 * @param filePath - Path to the file (will be validated).
 * @returns File contents as string, or an error.
 */
export function safeReadFile(filePath: string): Result<string, string> {
  const guard = guardRead(filePath);
  if (!guard.ok) return guard;

  try {
    const content = fs.readFileSync(guard.value.safePath, 'utf-8');
    auditLog('READ', guard.value.safePath, 'OK');
    return Result.ok(content);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    auditLog('READ', guard.value.safePath, 'ERROR', message);
    return Result.err(`Failed to read file: ${message}`);
  }
}

/**
 * Safely read a JSON file within the sandbox.
 *
 * @param filePath - Path to the JSON file.
 * @returns Parsed JSON content, or an error.
 */
export function safeReadJson<T = unknown>(filePath: string): Result<T, string> {
  const contentResult = safeReadFile(filePath);
  if (!contentResult.ok) return contentResult;

  try {
    const parsed = JSON.parse(contentResult.value) as T;
    return Result.ok(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Result.err(`Failed to parse JSON from "${filePath}": ${message}`);
  }
}

/**
 * Safely write a file within the sandbox.
 *
 * @param filePath - Path to write to (will be validated).
 * @param content - Content to write.
 * @returns The written path, or an error.
 */
export function safeWriteFile(
  filePath: string,
  content: string
): Result<string, string> {
  const guard = guardWrite(filePath);
  if (!guard.ok) return guard;

  try {
    // Ensure parent directory exists
    const dir = path.dirname(guard.value.safePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(guard.value.safePath, content, 'utf-8');
    auditLog('WRITE', guard.value.safePath, 'OK');
    return Result.ok(guard.value.safePath);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    auditLog('WRITE', guard.value.safePath, 'ERROR', message);
    return Result.err(`Failed to write file: ${message}`);
  }
}

/**
 * Safely write a JSON file within the sandbox.
 *
 * @param filePath - Path to write to.
 * @param data - Data to serialize as JSON.
 * @returns The written path, or an error.
 */
export function safeWriteJson(
  filePath: string,
  data: unknown
): Result<string, string> {
  const content = JSON.stringify(data, null, 2);
  return safeWriteFile(filePath, content);
}

/**
 * Safely check if a file exists within the sandbox.
 *
 * @param filePath - Path to check.
 * @returns true if file exists, false if not, or an error if path is outside sandbox.
 */
export function safeExists(filePath: string): Result<boolean, string> {
  const guard = guardRead(filePath, { skipFilePolicy: true });
  if (!guard.ok) return guard;

  return Result.ok(fs.existsSync(guard.value.safePath));
}

/**
 * Safely list files in a directory within the sandbox.
 *
 * @param dirPath - Path to the directory.
 * @returns Array of filenames, or an error.
 */
export function safeListDir(dirPath: string): Result<string[], string> {
  const guard = guardRead(dirPath, { skipFilePolicy: true });
  if (!guard.ok) return guard;

  try {
    const entries = fs.readdirSync(guard.value.safePath);
    return Result.ok(entries);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Result.err(`Failed to list directory: ${message}`);
  }
}

/**
 * Safely delete a file within the sandbox (restricted to workspace/temp/).
 *
 * @param filePath - Path to delete.
 * @returns Confirmation or error.
 */
export function safeDelete(filePath: string): Result<string, string> {
  const guard = guardOperation(filePath, 'delete');
  if (!guard.ok) return guard;

  try {
    fs.unlinkSync(guard.value.safePath);
    auditLog('DELETE', guard.value.safePath, 'OK');
    return Result.ok(`Deleted: ${guard.value.safePath}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    auditLog('DELETE', guard.value.safePath, 'ERROR', message);
    return Result.err(`Failed to delete file: ${message}`);
  }
}
