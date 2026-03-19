/**
 * Audit Log — Records every file operation for full transparency.
 *
 * All reads, writes, and denials are logged to workspace/reports/audit.log.
 * Log format is append-only, timestamped, and human-readable.
 *
 * @module audit-log
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { DSB_ROOT } from './constants';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export type AuditAction = 'READ' | 'WRITE' | 'DELETE' | 'DENIED';

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: AuditAction;
  readonly path: string;
  readonly status: 'OK' | 'DENIED' | 'ERROR';
  readonly reason?: string;
}

// ============================================================================
// SECTION 2: LOGGING
// ============================================================================

const AUDIT_LOG_PATH: string = path.resolve(DSB_ROOT, 'workspace', 'reports', 'audit.log');

/** Maximum audit log size before rotation (5 MB). */
const MAX_LOG_SIZE: number = 5 * 1024 * 1024;

/**
 * Log an audit entry to the audit log file.
 *
 * @param action - The type of operation attempted.
 * @param filePath - The path that was accessed or denied.
 * @param status - Whether the operation succeeded or was denied.
 * @param reason - Optional reason for denial or error.
 */
export function auditLog(
  action: AuditAction,
  filePath: string,
  status: 'OK' | 'DENIED' | 'ERROR',
  reason?: string
): void {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    action,
    path: filePath,
    status,
    reason,
  };

  const line = formatEntry(entry);

  try {
    // Ensure the reports directory exists
    const reportsDir = path.dirname(AUDIT_LOG_PATH);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Rotate if log is too large
    rotateIfNeeded();

    // Append the entry
    fs.appendFileSync(AUDIT_LOG_PATH, line + '\n', 'utf-8');
  } catch {
    // Audit logging must never crash the application.
    // If we can't write to the log, we silently continue.
    // This is a deliberate design choice — availability over logging.
  }
}

/**
 * Read all audit entries. Useful for generating reports.
 */
export function readAuditLog(): ReadonlyArray<AuditEntry> {
  try {
    if (!fs.existsSync(AUDIT_LOG_PATH)) return [];

    const content = fs.readFileSync(AUDIT_LOG_PATH, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    return lines.map(parseEntry).filter((e): e is AuditEntry => e !== null);
  } catch {
    return [];
  }
}

/**
 * Get the path to the audit log file.
 */
export function getAuditLogPath(): string {
  return AUDIT_LOG_PATH;
}

// ============================================================================
// SECTION 3: FORMATTING
// ============================================================================

function formatEntry(entry: AuditEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    entry.action.padEnd(7),
    entry.path.padEnd(60),
    entry.status,
  ];

  if (entry.reason) {
    parts.push(`(${entry.reason})`);
  }

  return parts.join(' ');
}

function parseEntry(line: string): AuditEntry | null {
  const match = line.match(
    /^\[(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\]\s+(READ|WRITE|DELETE|DENIED)\s+(.+?)\s+(OK|DENIED|ERROR)\s*(?:\((.+)\))?$/
  );

  if (!match) return null;

  return {
    timestamp: match[1]!,
    action: match[2]! as AuditAction,
    path: match[3]!.trim(),
    status: match[4]! as 'OK' | 'DENIED' | 'ERROR',
    reason: match[5],
  };
}

// ============================================================================
// SECTION 4: LOG ROTATION
// ============================================================================

function rotateIfNeeded(): void {
  try {
    if (!fs.existsSync(AUDIT_LOG_PATH)) return;

    const stats = fs.statSync(AUDIT_LOG_PATH);
    if (stats.size < MAX_LOG_SIZE) return;

    // Rotate: rename current to .old, start fresh
    const oldPath = AUDIT_LOG_PATH + '.old';
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
    fs.renameSync(AUDIT_LOG_PATH, oldPath);
  } catch {
    // Rotation failure is non-fatal
  }
}
