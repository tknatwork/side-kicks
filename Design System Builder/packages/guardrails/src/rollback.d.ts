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
import { Result } from './result';
export interface RollbackSnapshot {
    readonly id: string;
    readonly timestamp: string;
    readonly description: string;
    readonly data: unknown;
    readonly filePath: string;
}
export interface RollbackManifest {
    readonly snapshots: ReadonlyArray<RollbackSnapshot>;
}
/**
 * Create a rollback snapshot before a destructive operation.
 *
 * @param description - Human-readable description of what is being backed up.
 * @param data - The state data to snapshot (serializable to JSON).
 * @returns The snapshot metadata, or an error.
 */
export declare function createSnapshot(description: string, data: unknown): Result<RollbackSnapshot, string>;
/**
 * Load a rollback snapshot by ID.
 *
 * @param snapshotId - The snapshot ID to load.
 * @returns The snapshot data, or an error.
 */
export declare function loadSnapshot(snapshotId: string): Result<RollbackSnapshot, string>;
/**
 * List all available rollback snapshots.
 */
export declare function listSnapshots(): ReadonlyArray<RollbackSnapshot>;
/**
 * Remove snapshots older than 24 hours.
 * Called automatically on startup and periodically.
 */
export declare function cleanupOldSnapshots(): number;
//# sourceMappingURL=rollback.d.ts.map