"use strict";
/**
 * Sandbox — High-level convenience API for safe file operations.
 *
 * Wraps Node.js fs operations with guardrail enforcement.
 * All file I/O in DSB should go through this module instead of using fs directly.
 *
 * @module sandbox
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
exports.safeReadFile = safeReadFile;
exports.safeReadJson = safeReadJson;
exports.safeWriteFile = safeWriteFile;
exports.safeWriteJson = safeWriteJson;
exports.safeExists = safeExists;
exports.safeListDir = safeListDir;
exports.safeDelete = safeDelete;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const result_1 = require("./result");
const operation_guard_1 = require("./operation-guard");
const audit_log_1 = require("./audit-log");
// ============================================================================
// SECTION 1: SAFE FILE OPERATIONS
// ============================================================================
/**
 * Safely read a file within the sandbox.
 *
 * @param filePath - Path to the file (will be validated).
 * @returns File contents as string, or an error.
 */
function safeReadFile(filePath) {
    const guard = (0, operation_guard_1.guardRead)(filePath);
    if (!guard.ok)
        return guard;
    try {
        const content = fs.readFileSync(guard.value.safePath, 'utf-8');
        (0, audit_log_1.auditLog)('READ', guard.value.safePath, 'OK');
        return result_1.Result.ok(content);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        (0, audit_log_1.auditLog)('READ', guard.value.safePath, 'ERROR', message);
        return result_1.Result.err(`Failed to read file: ${message}`);
    }
}
/**
 * Safely read a JSON file within the sandbox.
 *
 * @param filePath - Path to the JSON file.
 * @returns Parsed JSON content, or an error.
 */
function safeReadJson(filePath) {
    const contentResult = safeReadFile(filePath);
    if (!contentResult.ok)
        return contentResult;
    try {
        const parsed = JSON.parse(contentResult.value);
        return result_1.Result.ok(parsed);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return result_1.Result.err(`Failed to parse JSON from "${filePath}": ${message}`);
    }
}
/**
 * Safely write a file within the sandbox.
 *
 * @param filePath - Path to write to (will be validated).
 * @param content - Content to write.
 * @returns The written path, or an error.
 */
function safeWriteFile(filePath, content) {
    const guard = (0, operation_guard_1.guardWrite)(filePath);
    if (!guard.ok)
        return guard;
    try {
        // Ensure parent directory exists
        const dir = path.dirname(guard.value.safePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(guard.value.safePath, content, 'utf-8');
        (0, audit_log_1.auditLog)('WRITE', guard.value.safePath, 'OK');
        return result_1.Result.ok(guard.value.safePath);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        (0, audit_log_1.auditLog)('WRITE', guard.value.safePath, 'ERROR', message);
        return result_1.Result.err(`Failed to write file: ${message}`);
    }
}
/**
 * Safely write a JSON file within the sandbox.
 *
 * @param filePath - Path to write to.
 * @param data - Data to serialize as JSON.
 * @returns The written path, or an error.
 */
function safeWriteJson(filePath, data) {
    const content = JSON.stringify(data, null, 2);
    return safeWriteFile(filePath, content);
}
/**
 * Safely check if a file exists within the sandbox.
 *
 * @param filePath - Path to check.
 * @returns true if file exists, false if not, or an error if path is outside sandbox.
 */
function safeExists(filePath) {
    const guard = (0, operation_guard_1.guardRead)(filePath, { skipFilePolicy: true });
    if (!guard.ok)
        return guard;
    return result_1.Result.ok(fs.existsSync(guard.value.safePath));
}
/**
 * Safely list files in a directory within the sandbox.
 *
 * @param dirPath - Path to the directory.
 * @returns Array of filenames, or an error.
 */
function safeListDir(dirPath) {
    const guard = (0, operation_guard_1.guardRead)(dirPath, { skipFilePolicy: true });
    if (!guard.ok)
        return guard;
    try {
        const entries = fs.readdirSync(guard.value.safePath);
        return result_1.Result.ok(entries);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return result_1.Result.err(`Failed to list directory: ${message}`);
    }
}
/**
 * Safely delete a file within the sandbox (restricted to workspace/temp/).
 *
 * @param filePath - Path to delete.
 * @returns Confirmation or error.
 */
function safeDelete(filePath) {
    const guard = (0, operation_guard_1.guardOperation)(filePath, 'delete');
    if (!guard.ok)
        return guard;
    try {
        fs.unlinkSync(guard.value.safePath);
        (0, audit_log_1.auditLog)('DELETE', guard.value.safePath, 'OK');
        return result_1.Result.ok(`Deleted: ${guard.value.safePath}`);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        (0, audit_log_1.auditLog)('DELETE', guard.value.safePath, 'ERROR', message);
        return result_1.Result.err(`Failed to delete file: ${message}`);
    }
}
