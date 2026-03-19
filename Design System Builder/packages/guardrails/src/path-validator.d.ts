/**
 * Path Validator — Ensures all file operations stay within sandbox boundaries.
 *
 * Every file read/write must pass through validatePath() before execution.
 * Prevents path traversal attacks, symlink escapes, and out-of-bounds access.
 *
 * @module path-validator
 */
import { Result } from './result';
export type FileOperation = 'read' | 'write' | 'delete';
export interface PathValidationResult {
    /** The fully resolved, safe absolute path. */
    readonly resolvedPath: string;
    /** Which allowed root this path falls under. */
    readonly matchedRoot: string;
}
/**
 * Validates that a requested path is within the sandbox boundary.
 *
 * @param requestedPath - The path the caller wants to access.
 * @param operation - The type of operation (read, write, delete).
 * @returns The resolved safe path, or an error explaining the denial.
 */
export declare function validatePath(requestedPath: string, operation: FileOperation): Result<PathValidationResult, string>;
/**
 * Validates a path specifically for the delete operation.
 * Delete is more restrictive — only allowed in workspace/temp/ and workspace/reports/audit.log rotation.
 */
export declare function validateDeletePath(requestedPath: string): Result<PathValidationResult, string>;
//# sourceMappingURL=path-validator.d.ts.map