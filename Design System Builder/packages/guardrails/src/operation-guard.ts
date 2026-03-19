/**
 * Operation Guard — Pre-flight check before any file or Figma operation.
 *
 * Combines path validation, file policy, and audit logging into a single
 * approve/deny gate. Every MCP tool calls this before executing.
 *
 * @module operation-guard
 */

import { Result } from './result';
import { validatePath, type FileOperation } from './path-validator';
import { checkFilePolicy, type FilePolicyResult } from './file-policy';
import { auditLog } from './audit-log';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

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

// ============================================================================
// SECTION 2: GUARD FUNCTIONS
// ============================================================================

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
export function guardOperation(
  requestedPath: string,
  operation: FileOperation,
  options?: GuardOptions
): Result<OperationApproval, string> {
  // Step 1: Validate path is within sandbox
  const pathResult = validatePath(requestedPath, operation);
  if (!pathResult.ok) {
    auditLog(
      'DENIED',
      requestedPath,
      'DENIED',
      pathResult.error
    );
    return pathResult;
  }

  const safePath = pathResult.value.resolvedPath;

  // Step 2: Check file policy (if applicable)
  if (!options?.skipFilePolicy) {
    const policyResult = checkFilePolicy(safePath);
    if (!policyResult.ok) {
      auditLog('DENIED', safePath, 'ERROR', policyResult.error);
      return Result.err(policyResult.error);
    }

    const policy = policyResult.value;
    if (policy.verdict === 'blocked') {
      auditLog('DENIED', safePath, 'DENIED', policy.reason);
      return Result.err(policy.reason);
    }

    // Warnings are logged but allowed
    if (policy.verdict === 'warning') {
      auditLog(
        operation === 'read' ? 'READ' : operation === 'write' ? 'WRITE' : 'DELETE',
        safePath,
        'OK',
        `Warning: ${policy.reason}`
      );
    }

    return Result.ok({ safePath, policy });
  }

  // Step 3: Log the approved operation
  const action = operation === 'read' ? 'READ' as const
    : operation === 'write' ? 'WRITE' as const
    : 'DELETE' as const;

  auditLog(action, safePath, 'OK', options?.label);

  return Result.ok({ safePath });
}

/**
 * Guard a read operation. Shorthand for guardOperation(path, 'read').
 */
export function guardRead(
  requestedPath: string,
  options?: GuardOptions
): Result<OperationApproval, string> {
  return guardOperation(requestedPath, 'read', options);
}

/**
 * Guard a write operation. Shorthand for guardOperation(path, 'write').
 */
export function guardWrite(
  requestedPath: string,
  options?: GuardOptions
): Result<OperationApproval, string> {
  return guardOperation(requestedPath, 'write', options);
}
