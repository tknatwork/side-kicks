/**
 * Audit Log — Records every file operation for full transparency.
 *
 * All reads, writes, and denials are logged to workspace/reports/audit.log.
 * Log format is append-only, timestamped, and human-readable.
 *
 * @module audit-log
 */
export type AuditAction = 'READ' | 'WRITE' | 'DELETE' | 'DENIED';
export interface AuditEntry {
    readonly timestamp: string;
    readonly action: AuditAction;
    readonly path: string;
    readonly status: 'OK' | 'DENIED' | 'ERROR';
    readonly reason?: string;
}
/**
 * Log an audit entry to the audit log file.
 *
 * @param action - The type of operation attempted.
 * @param filePath - The path that was accessed or denied.
 * @param status - Whether the operation succeeded or was denied.
 * @param reason - Optional reason for denial or error.
 */
export declare function auditLog(action: AuditAction, filePath: string, status: 'OK' | 'DENIED' | 'ERROR', reason?: string): void;
/**
 * Read all audit entries. Useful for generating reports.
 */
export declare function readAuditLog(): ReadonlyArray<AuditEntry>;
/**
 * Get the path to the audit log file.
 */
export declare function getAuditLogPath(): string;
//# sourceMappingURL=audit-log.d.ts.map