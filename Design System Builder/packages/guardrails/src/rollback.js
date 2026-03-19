"use strict";
/**
 * Rollback — State snapshot and restore for Figma operations.
 *
 * Before any destructive Figma modification, the toolkit captures a snapshot
 * of the current state. If the build fails or the user requests undo,
 * the snapshot is used to restore the previous state.
 *
 * Snapshots are stored in workspace/temp/ and auto-cleaned after 24 hours.
 *
 * @module rollback
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
exports.createSnapshot = createSnapshot;
exports.loadSnapshot = loadSnapshot;
exports.listSnapshots = listSnapshots;
exports.cleanupOldSnapshots = cleanupOldSnapshots;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const result_1 = require("./result");
const constants_1 = require("./constants");
// ============================================================================
// SECTION 2: SNAPSHOT OPERATIONS
// ============================================================================
const TEMP_DIR = path.resolve(constants_1.DSB_ROOT, 'workspace', 'temp');
const SNAPSHOT_PREFIX = 'rollback-';
/** Maximum age for temp files before auto-cleanup (24 hours). */
const MAX_SNAPSHOT_AGE_MS = 24 * 60 * 60 * 1000;
/**
 * Create a rollback snapshot before a destructive operation.
 *
 * @param description - Human-readable description of what is being backed up.
 * @param data - The state data to snapshot (serializable to JSON).
 * @returns The snapshot metadata, or an error.
 */
function createSnapshot(description, data) {
    const id = generateSnapshotId();
    const timestamp = new Date().toISOString();
    const filename = `${SNAPSHOT_PREFIX}${id}.json`;
    const filePath = path.resolve(TEMP_DIR, filename);
    const snapshot = {
        id,
        timestamp,
        description,
        data,
        filePath,
    };
    try {
        // Ensure temp directory exists
        if (!fs.existsSync(TEMP_DIR)) {
            fs.mkdirSync(TEMP_DIR, { recursive: true });
        }
        const content = JSON.stringify(snapshot, null, 2);
        fs.writeFileSync(filePath, content, 'utf-8');
        return result_1.Result.ok(snapshot);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return result_1.Result.err(`Failed to create rollback snapshot: ${message}`);
    }
}
/**
 * Load a rollback snapshot by ID.
 *
 * @param snapshotId - The snapshot ID to load.
 * @returns The snapshot data, or an error.
 */
function loadSnapshot(snapshotId) {
    const filename = `${SNAPSHOT_PREFIX}${snapshotId}.json`;
    const filePath = path.resolve(TEMP_DIR, filename);
    try {
        if (!fs.existsSync(filePath)) {
            return result_1.Result.err(`Snapshot "${snapshotId}" not found. It may have been auto-cleaned.`);
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        const snapshot = JSON.parse(content);
        return result_1.Result.ok(snapshot);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return result_1.Result.err(`Failed to load snapshot "${snapshotId}": ${message}`);
    }
}
/**
 * List all available rollback snapshots.
 */
function listSnapshots() {
    try {
        if (!fs.existsSync(TEMP_DIR))
            return [];
        const files = fs.readdirSync(TEMP_DIR)
            .filter(f => f.startsWith(SNAPSHOT_PREFIX) && f.endsWith('.json'));
        const snapshots = [];
        for (const file of files) {
            try {
                const content = fs.readFileSync(path.resolve(TEMP_DIR, file), 'utf-8');
                snapshots.push(JSON.parse(content));
            }
            catch (_a) {
                // Skip corrupted snapshots
            }
        }
        return snapshots.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    catch (_b) {
        return [];
    }
}
// ============================================================================
// SECTION 3: CLEANUP
// ============================================================================
/**
 * Remove snapshots older than 24 hours.
 * Called automatically on startup and periodically.
 */
function cleanupOldSnapshots() {
    let removed = 0;
    const now = Date.now();
    try {
        if (!fs.existsSync(TEMP_DIR))
            return 0;
        const files = fs.readdirSync(TEMP_DIR)
            .filter(f => f.startsWith(SNAPSHOT_PREFIX) && f.endsWith('.json'));
        for (const file of files) {
            const filePath = path.resolve(TEMP_DIR, file);
            try {
                const stats = fs.statSync(filePath);
                if (now - stats.mtimeMs > MAX_SNAPSHOT_AGE_MS) {
                    fs.unlinkSync(filePath);
                    removed++;
                }
            }
            catch (_a) {
                // Skip files we can't stat/delete
            }
        }
    }
    catch (_b) {
        // Cleanup failure is non-fatal
    }
    return removed;
}
// ============================================================================
// SECTION 4: HELPERS
// ============================================================================
function generateSnapshotId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
}
