/**
 * Operation Guard — Pre-flight check before any file or Figma operation.
 *
 * Combines path validation, file policy, and audit logging into a single
 * approve/deny gate. Every MCP tool calls this before executing.
 *
 * @module operation-guard
 */
import { Result } from './result';
import { type FileOperation } from './path-validator';
import { type FilePolicyResult } from './file-policy';
export interface OperationApproval {
    /** The validated, safe absolute path. */
    readonly safePath: string;
    /** File policy result (if applicable). */
    readonly policy?: FilePolicyResult;
}
export interface GuardOptions {
    /** Skip file policy check (e.g., for directory operations). */
    readonly skipFilePolicy?: boolean;
    /** Custom label for audit log. */
    readonly label?: string;
}
/**
 * Request approval for a file operation.
 *
 * This is the primary entry point for all file access in DSB.
 * It validates the path, checks file policy, and logs the attempt.
 *
 * @param requestedPath - The path to access.
 * @param operation - The type of operation.
 * @param options - Additional guard options.
 * @returns Approval with the safe path, or a denial reason.
 */
export declare function guardOperation(requestedPath: string, operation: FileOperation, options?: GuardOptions): Result<OperationApproval, string>;
/**
 * Guard a read operation. Shorthand for guardOperation(path, 'read').
 */
export declare function guardRead(requestedPath: string, options?: GuardOptions): Result<OperationApproval, string>;
/**
 * Guard a write operation. Shorthand for guardOperation(path, 'write').
 */
export declare function guardWrite(requestedPath: string, options?: GuardOptions): Result<OperationApproval, string>;
//# sourceMappingURL=operation-guard.d.ts.map