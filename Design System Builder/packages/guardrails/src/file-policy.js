"use strict";
/**
 * File Policy — Determines which files are allowed/blocked based on extension and content.
 *
 * Enforces file type restrictions for workspace/context/ input and
 * prevents accidental processing of secrets, executables, or archives.
 *
 * @module file-policy
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
exports.checkFilePolicy = checkFilePolicy;
exports.checkDirectorySize = checkDirectorySize;
const path = __importStar(require("node:path"));
const fs = __importStar(require("node:fs"));
const result_1 = require("./result");
const constants_1 = require("./constants");
// ============================================================================
// SECTION 2: FILE VALIDATION
// ============================================================================
/**
 * Check if a file is allowed to be processed based on its extension and size.
 *
 * @param filePath - Absolute path to the file (already validated by path-validator).
 * @returns The policy verdict with reason.
 */
function checkFilePolicy(filePath) {
    const ext = getExtension(filePath);
    const basename = path.basename(filePath);
    // Check for secret patterns first (highest priority block)
    for (const pattern of constants_1.SECRET_PATTERNS) {
        if (pattern.test(basename)) {
            return result_1.Result.ok({
                verdict: 'blocked',
                reason: `File "${basename}" matches a secret pattern (${pattern.source}). ` +
                    'Secrets must never be processed. Remove this file from workspace/context/.',
                extension: ext,
                sizeBytes: 0,
            });
        }
    }
    // Check blocked extensions
    if (constants_1.BLOCKED_EXTENSIONS.has(ext)) {
        return result_1.Result.ok({
            verdict: 'blocked',
            reason: `Extension "${ext}" is blocked. ` +
                'This file type cannot be processed for safety reasons.',
            extension: ext,
            sizeBytes: 0,
        });
    }
    // Check file size
    let sizeBytes = 0;
    try {
        const stats = fs.statSync(filePath);
        sizeBytes = stats.size;
    }
    catch (_a) {
        // File might not exist yet (being created)
        sizeBytes = 0;
    }
    if (sizeBytes > constants_1.MAX_FILE_SIZE) {
        return result_1.Result.ok({
            verdict: 'blocked',
            reason: `File is ${formatBytes(sizeBytes)} which exceeds the ${formatBytes(constants_1.MAX_FILE_SIZE)} limit. ` +
                'Split the file or remove unnecessary content.',
            extension: ext,
            sizeBytes,
        });
    }
    // Check if extension is explicitly allowed
    if (constants_1.ALLOWED_EXTENSIONS.has(ext)) {
        return result_1.Result.ok({
            verdict: 'allowed',
            reason: 'File type and size within policy limits.',
            extension: ext,
            sizeBytes,
        });
    }
    // Unknown extension — warn but allow (defensive: don't block unexpectedly)
    return result_1.Result.ok({
        verdict: 'warning',
        reason: `Extension "${ext}" is not in the recognized list. ` +
            'Processing with caution. If this is a mistake, remove the file.',
        extension: ext,
        sizeBytes,
    });
}
/**
 * Check if the total size of a directory is within limits.
 *
 * @param dirPath - Absolute path to the directory.
 * @param maxSize - Maximum allowed total size in bytes.
 */
function checkDirectorySize(dirPath, maxSize = constants_1.MAX_CONTEXT_SIZE) {
    let totalSize = 0;
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isFile()) {
                const stats = fs.statSync(fullPath);
                totalSize += stats.size;
            }
            else if (entry.isDirectory()) {
                // Recurse into subdirectories
                const subResult = checkDirectorySize(fullPath, maxSize);
                if (subResult.ok) {
                    totalSize += subResult.value;
                }
            }
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return result_1.Result.err(`Failed to check directory size: ${message}`);
    }
    if (totalSize > maxSize) {
        return result_1.Result.err(`Directory "${dirPath}" is ${formatBytes(totalSize)} which exceeds ` +
            `the ${formatBytes(maxSize)} limit. Remove unnecessary files.`);
    }
    return result_1.Result.ok(totalSize);
}
// ============================================================================
// SECTION 3: HELPERS
// ============================================================================
/**
 * Extract the file extension, handling compound extensions like .tokens.json.
 */
function getExtension(filePath) {
    const basename = path.basename(filePath);
    // Handle compound extensions
    if (basename.endsWith('.tokens.json'))
        return '.tokens.json';
    if (basename.endsWith('.config.js'))
        return '.config.js';
    if (basename.endsWith('.config.ts'))
        return '.config.ts';
    if (basename.endsWith('.env.local'))
        return '.env.local';
    // Check for .env.* patterns
    const envMatch = basename.match(/^\.env\..+$/);
    if (envMatch)
        return '.env.local'; // Treat all .env.* as blocked
    return path.extname(filePath).toLowerCase();
}
/**
 * Format bytes into a human-readable string.
 */
function formatBytes(bytes) {
    if (bytes === 0)
        return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
