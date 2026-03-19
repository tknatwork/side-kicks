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

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Result } from './result';
import { DSB_ROOT } from './constants';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

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

// ============================================================================
// SECTION 2: SNAPSHOT OPERATIONS
// ============================================================================

const TEMP_DIR: string = path.resolve(DSB_ROOT, 'workspace', 'temp');
const SNAPSHOT_PREFIX = 'rollback-';

/** Maximum age for temp files before auto-cleanup (24 hours). */
const MAX_SNAPSHOT_AGE_MS: number = 24 * 60 * 60 * 1000;

/**
 * Create a rollback snapshot before a destructive operation.
 *
 * @param description - Human-readable description of what is being backed up.
 * @param data - The state data to snapshot (serializable to JSON).
 * @returns The snapshot metadata, or an error.
 */
export function createSnapshot(
  description: string,
  data: unknown
): Result<RollbackSnapshot, string> {
  const id = generateSnapshotId();
  const timestamp = new Date().toISOString();
  const filename = `${SNAPSHOT_PREFIX}${id}.json`;
  const filePath = path.resolve(TEMP_DIR, filename);

  const snapshot: RollbackSnapshot = {
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
    return Result.ok(snapshot);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Result.err(`Failed to create rollback snapshot: ${message}`);
  }
}

/**
 * Load a rollback snapshot by ID.
 *
 * @param snapshotId - The snapshot ID to load.
 * @returns The snapshot data, or an error.
 */
export function loadSnapshot(snapshotId: string): Result<RollbackSnapshot, string> {
  const filename = `${SNAPSHOT_PREFIX}${snapshotId}.json`;
  const filePath = path.resolve(TEMP_DIR, filename);

  try {
    if (!fs.existsSync(filePath)) {
      return Result.err(`Snapshot "${snapshotId}" not found. It may have been auto-cleaned.`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const snapshot = JSON.parse(content) as RollbackSnapshot;
    return Result.ok(snapshot);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Result.err(`Failed to load snapshot "${snapshotId}": ${message}`);
  }
}

/**
 * List all available rollback snapshots.
 */
export function listSnapshots(): ReadonlyArray<RollbackSnapshot> {
  try {
    if (!fs.existsSync(TEMP_DIR)) return [];

    const files = fs.readdirSync(TEMP_DIR)
      .filter(f => f.startsWith(SNAPSHOT_PREFIX) && f.endsWith('.json'));

    const snapshots: RollbackSnapshot[] = [];
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.resolve(TEMP_DIR, file), 'utf-8');
        snapshots.push(JSON.parse(content) as RollbackSnapshot);
      } catch {
        // Skip corrupted snapshots
      }
    }

    return snapshots.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch {
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
export function cleanupOldSnapshots(): number {
  let removed = 0;
  const now = Date.now();

  try {
    if (!fs.existsSync(TEMP_DIR)) return 0;

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
      } catch {
        // Skip files we can't stat/delete
      }
    }
  } catch {
    // Cleanup failure is non-fatal
  }

  return removed;
}

// ============================================================================
// SECTION 4: HELPERS
// ============================================================================

function generateSnapshotId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}
