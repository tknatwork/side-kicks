"use strict";
/**
 * Audit Log — Records every file operation for full transparency.
 *
 * All reads, writes, and denials are logged to workspace/reports/audit.log.
 * Log format is append-only, timestamped, and human-readable.
 *
 * @module audit-log
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLog = auditLog;
exports.readAuditLog = readAuditLog;
exports.getAuditLogPath = getAuditLogPath;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const constants_1 = require("./constants");
// ============================================================================
// SECTION 2: LOGGING
// ============================================================================
const AUDIT_LOG_PATH = path.resolve(constants_1.DSB_ROOT, 'workspace', 'reports', 'audit.log');
/** Maximum audit log size before rotation (5 MB). */
const MAX_LOG_SIZE = 5 * 1024 * 1024;
/**
 * Log an audit entry to the audit log file.
 *
 * @param action - The type of operation attempted.
 * @param filePath - The path that was accessed or denied.
 * @param status - Whether the operation succeeded or was denied.
 * @param reason - Optional reason for denial or error.
 */
function auditLog(action, filePath, status, reason) {
    const entry = {
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
    }
    catch (_a) {
        // Audit logging must never crash the application.
        // If we can't write to the log, we silently continue.
        // This is a deliberate design choice — availability over logging.
    }
}
/**
 * Read all audit entries. Useful for generating reports.
 */
function readAuditLog() {
    try {
        if (!fs.existsSync(AUDIT_LOG_PATH))
            return [];
        const content = fs.readFileSync(AUDIT_LOG_PATH, 'utf-8');
        const lines = content.split('\n').filter(Boolean);
        return lines.map(parseEntry).filter((e) => e !== null);
    }
    catch (_a) {
        return [];
    }
}
/**
 * Get the path to the audit log file.
 */
function getAuditLogPath() {
    return AUDIT_LOG_PATH;
}
// ============================================================================
// SECTION 3: FORMATTING
// ============================================================================
function formatEntry(entry) {
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
function parseEntry(line) {
    const match = line.match(/^\[(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\]\s+(READ|WRITE|DELETE|DENIED)\s+(.+?)\s+(OK|DENIED|ERROR)\s*(?:\((.+)\))?$/);
    if (!match)
        return null;
    return {
        timestamp: match[1],
        action: match[2],
        path: match[3].trim(),
        status: match[4],
        reason: match[5],
    };
}
// ============================================================================
// SECTION 4: LOG ROTATION
// ============================================================================
function rotateIfNeeded() {
    try {
        if (!fs.existsSync(AUDIT_LOG_PATH))
            return;
        const stats = fs.statSync(AUDIT_LOG_PATH);
        if (stats.size < MAX_LOG_SIZE)
            return;
        // Rotate: rename current to .old, start fresh
        const oldPath = AUDIT_LOG_PATH + '.old';
        if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
        }
        fs.renameSync(AUDIT_LOG_PATH, oldPath);
    }
    catch (_a) {
        // Rotation failure is non-fatal
    }
}
