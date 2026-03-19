"use strict";
/**
 * Path Validator — Ensures all file operations stay within sandbox boundaries.
 *
 * Every file read/write must pass through validatePath() before execution.
 * Prevents path traversal attacks, symlink escapes, and out-of-bounds access.
 *
 * @module path-validator
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
exports.validatePath = validatePath;
exports.validateDeletePath = validateDeletePath;
const path = __importStar(require("node:path"));
const fs = __importStar(require("node:fs"));
const result_1 = require("./result");
const constants_1 = require("./constants");
// ============================================================================
// SECTION 2: PATH VALIDATION
// ============================================================================
/**
 * Validates that a requested path is within the sandbox boundary.
 *
 * @param requestedPath - The path the caller wants to access.
 * @param operation - The type of operation (read, write, delete).
 * @returns The resolved safe path, or an error explaining the denial.
 */
function validatePath(requestedPath, operation) {
    // Reject empty paths
    if (!requestedPath || requestedPath.trim().length === 0) {
        return result_1.Result.err('Path is empty or whitespace');
    }
    // Reject paths with null bytes (path traversal attack vector)
    if (requestedPath.includes('\0')) {
        return result_1.Result.err('Path contains null bytes — rejected as potential attack');
    }
    // Resolve to absolute path (handles .., ., ~, relative paths)
    const resolved = path.resolve(requestedPath);
    // Resolve symlinks to prevent symlink-based escapes
    let realPath;
    try {
        // If the file exists, resolve its real path (follows symlinks)
        realPath = fs.realpathSync(resolved);
    }
    catch (_a) {
        // File doesn't exist yet (write operation) — use the resolved path
        // but verify the parent directory exists and is within bounds
        realPath = resolved;
        if (operation === 'write') {
            const parentDir = path.dirname(resolved);
            try {
                const realParent = fs.realpathSync(parentDir);
                // Reconstruct: real parent + filename
                realPath = path.join(realParent, path.basename(resolved));
            }
            catch (_b) {
                // Parent directory doesn't exist — caller needs to create it
                // Still validate the intended path
                realPath = resolved;
            }
        }
    }
    // Select allowed roots based on operation
    const allowedRoots = getAllowedRoots(operation);
    // Check if the resolved path falls under any allowed root
    for (const root of allowedRoots) {
        if (isWithinRoot(realPath, root)) {
            return result_1.Result.ok({
                resolvedPath: realPath,
                matchedRoot: root,
            });
        }
    }
    // Path is outside all allowed boundaries
    const rootList = allowedRoots.join('\n  - ');
    return result_1.Result.err(`Access denied: "${realPath}" is outside sandbox boundaries.\n` +
        `Operation: ${operation}\n` +
        `Allowed roots:\n  - ${rootList}\n` +
        `If you need this file, place it in workspace/context/.`);
}
/**
 * Validates a path specifically for the delete operation.
 * Delete is more restrictive — only allowed in workspace/temp/ and workspace/reports/audit.log rotation.
 */
function validateDeletePath(requestedPath) {
    const validation = validatePath(requestedPath, 'delete');
    if (!validation.ok)
        return validation;
    const resolved = validation.value.resolvedPath;
    // Deletes are only allowed in workspace/temp/
    const tempRoot = path.resolve(validation.value.matchedRoot, '..', 'temp');
    if (!isWithinRoot(resolved, tempRoot)) {
        return result_1.Result.err(`Delete denied: Can only delete files in workspace/temp/. ` +
            `"${resolved}" is outside the deletable boundary.`);
    }
    return validation;
}
// ============================================================================
// SECTION 3: HELPERS
// ============================================================================
/**
 * Check if a path is within a given root directory.
 * Uses string prefix check after normalization.
 */
function isWithinRoot(filePath, root) {
    const normalizedPath = path.normalize(filePath) + path.sep;
    const normalizedRoot = path.normalize(root) + path.sep;
    return normalizedPath.startsWith(normalizedRoot) || path.normalize(filePath) === path.normalize(root);
}
/**
 * Get the allowed roots for a given operation type.
 */
function getAllowedRoots(operation) {
    switch (operation) {
        case 'read':
            return constants_1.READ_ALLOWED_ROOTS;
        case 'write':
            return constants_1.WRITE_ALLOWED_ROOTS;
        case 'delete':
            return constants_1.WRITE_ALLOWED_ROOTS; // Same as write, further restricted in validateDeletePath
    }
}
