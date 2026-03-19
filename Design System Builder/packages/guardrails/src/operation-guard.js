"use strict";
/**
 * Operation Guard — Pre-flight check before any file or Figma operation.
 *
 * Combines path validation, file policy, and audit logging into a single
 * approve/deny gate. Every MCP tool calls this before executing.
 *
 * @module operation-guard
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.guardOperation = guardOperation;
exports.guardRead = guardRead;
exports.guardWrite = guardWrite;
const result_1 = require("./result");
const path_validator_1 = require("./path-validator");
const file_policy_1 = require("./file-policy");
const audit_log_1 = require("./audit-log");
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
function guardOperation(requestedPath, operation, options) {
    // Step 1: Validate path is within sandbox
    const pathResult = (0, path_validator_1.validatePath)(requestedPath, operation);
    if (!pathResult.ok) {
        (0, audit_log_1.auditLog)('DENIED', requestedPath, 'DENIED', pathResult.error);
        return pathResult;
    }
    const safePath = pathResult.value.resolvedPath;
    // Step 2: Check file policy (if applicable)
    if (!(options === null || options === void 0 ? void 0 : options.skipFilePolicy)) {
        const policyResult = (0, file_policy_1.checkFilePolicy)(safePath);
        if (!policyResult.ok) {
            (0, audit_log_1.auditLog)('DENIED', safePath, 'ERROR', policyResult.error);
            return result_1.Result.err(policyResult.error);
        }
        const policy = policyResult.value;
        if (policy.verdict === 'blocked') {
            (0, audit_log_1.auditLog)('DENIED', safePath, 'DENIED', policy.reason);
            return result_1.Result.err(policy.reason);
        }
        // Warnings are logged but allowed
        if (policy.verdict === 'warning') {
            (0, audit_log_1.auditLog)(operation === 'read' ? 'READ' : operation === 'write' ? 'WRITE' : 'DELETE', safePath, 'OK', `Warning: ${policy.reason}`);
        }
        return result_1.Result.ok({ safePath, policy });
    }
    // Step 3: Log the approved operation
    const action = operation === 'read' ? 'READ'
        : operation === 'write' ? 'WRITE'
            : 'DELETE';
    (0, audit_log_1.auditLog)(action, safePath, 'OK', options === null || options === void 0 ? void 0 : options.label);
    return result_1.Result.ok({ safePath });
}
/**
 * Guard a read operation. Shorthand for guardOperation(path, 'read').
 */
function guardRead(requestedPath, options) {
    return guardOperation(requestedPath, 'read', options);
}
/**
 * Guard a write operation. Shorthand for guardOperation(path, 'write').
 */
function guardWrite(requestedPath, options) {
    return guardOperation(requestedPath, 'write', options);
}
