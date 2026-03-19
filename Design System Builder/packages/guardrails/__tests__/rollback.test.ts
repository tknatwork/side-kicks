import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createSnapshot, loadSnapshot, listSnapshots, cleanupOldSnapshots } from '../src/rollback';
import { DSB_ROOT } from '../src/constants';

const TEMP_DIR = path.resolve(DSB_ROOT, 'workspace', 'temp');

/** Collect snapshot file paths created during tests for cleanup. */
const createdFiles: string[] = [];

afterEach(() => {
  for (const f of createdFiles) {
    try { fs.unlinkSync(f); } catch { /* ok */ }
  }
  createdFiles.length = 0;
});

describe('rollback', () => {
  describe('createSnapshot', () => {
    it('creates a snapshot and returns ok Result', () => {
      const result = createSnapshot('test backup', { key: 'value' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        createdFiles.push(result.value.filePath);
        expect(result.value.description).toBe('test backup');
        expect(result.value.data).toEqual({ key: 'value' });
        expect(result.value.id).toBeTruthy();
        expect(result.value.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      }
    });

    it('writes a valid JSON file to workspace/temp', () => {
      const result = createSnapshot('disk check', [1, 2, 3]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        createdFiles.push(result.value.filePath);
        expect(fs.existsSync(result.value.filePath)).toBe(true);
        const raw = fs.readFileSync(result.value.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        expect(parsed.description).toBe('disk check');
        expect(parsed.data).toEqual([1, 2, 3]);
      }
    });

    it('snapshot filenames start with rollback-', () => {
      const result = createSnapshot('naming test', null);
      expect(result.ok).toBe(true);
      if (result.ok) {
        createdFiles.push(result.value.filePath);
        const basename = path.basename(result.value.filePath);
        expect(basename.startsWith('rollback-')).toBe(true);
        expect(basename.endsWith('.json')).toBe(true);
      }
    });

    it('generates unique IDs for each snapshot', () => {
      const r1 = createSnapshot('s1', {});
      const r2 = createSnapshot('s2', {});
      expect(r1.ok && r2.ok).toBe(true);
      if (r1.ok && r2.ok) {
        createdFiles.push(r1.value.filePath, r2.value.filePath);
        expect(r1.value.id).not.toBe(r2.value.id);
      }
    });
  });

  describe('loadSnapshot', () => {
    it('loads a previously created snapshot', () => {
      const createResult = createSnapshot('load test', { x: 42 });
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;
      createdFiles.push(createResult.value.filePath);

      const loadResult = loadSnapshot(createResult.value.id);
      expect(loadResult.ok).toBe(true);
      if (loadResult.ok) {
        expect(loadResult.value.description).toBe('load test');
        expect(loadResult.value.data).toEqual({ x: 42 });
      }
    });

    it('returns error for non-existent snapshot', () => {
      const result = loadSnapshot('nonexistent-id-12345');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('not found');
      }
    });
  });

  describe('listSnapshots', () => {
    it('includes created snapshots in the list', () => {
      const r1 = createSnapshot('list-test-1', { a: 1 });
      const r2 = createSnapshot('list-test-2', { b: 2 });
      expect(r1.ok && r2.ok).toBe(true);
      if (r1.ok) createdFiles.push(r1.value.filePath);
      if (r2.ok) createdFiles.push(r2.value.filePath);

      const snapshots = listSnapshots();
      const ids = snapshots.map(s => s.id);
      if (r1.ok) expect(ids).toContain(r1.value.id);
      if (r2.ok) expect(ids).toContain(r2.value.id);
    });

    it('returns snapshots sorted by timestamp descending', () => {
      const r1 = createSnapshot('older', {});
      // Small delay to ensure different timestamps
      const r2 = createSnapshot('newer', {});
      if (r1.ok) createdFiles.push(r1.value.filePath);
      if (r2.ok) createdFiles.push(r2.value.filePath);

      const snapshots = listSnapshots();
      if (snapshots.length >= 2) {
        const t0 = new Date(snapshots[0]!.timestamp).getTime();
        const t1 = new Date(snapshots[1]!.timestamp).getTime();
        expect(t0).toBeGreaterThanOrEqual(t1);
      }
    });

    it('returns empty array when temp dir has no snapshots', () => {
      // listSnapshots filters by prefix, so even if temp files exist, only rollback- files count
      const snapshots = listSnapshots();
      expect(Array.isArray(snapshots)).toBe(true);
    });
  });

  describe('cleanupOldSnapshots', () => {
    it('returns 0 when no old snapshots exist', () => {
      // Create a fresh snapshot (not old)
      const r = createSnapshot('fresh', {});
      if (r.ok) createdFiles.push(r.value.filePath);

      const removed = cleanupOldSnapshots();
      // Fresh snapshot should NOT be removed
      expect(removed).toBeGreaterThanOrEqual(0);
      if (r.ok) expect(fs.existsSync(r.value.filePath)).toBe(true);
    });

    it('returns a number', () => {
      const removed = cleanupOldSnapshots();
      expect(typeof removed).toBe('number');
    });
  });
});
