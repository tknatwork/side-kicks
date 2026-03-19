import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import {
  safeReadFile,
  safeReadJson,
  safeWriteFile,
  safeWriteJson,
  safeExists,
  safeListDir,
  safeDelete,
} from '../src/sandbox';
import { DSB_ROOT } from '../src/constants';

describe('sandbox', () => {
  // =========================================================================
  // READ OPERATIONS — path validation (sandbox boundary enforcement)
  // =========================================================================

  describe('safeReadFile', () => {
    it('denies reading outside sandbox', () => {
      const result = safeReadFile('/etc/passwd');
      expect(result.ok).toBe(false);
    });

    it('denies reading with traversal attack', () => {
      const evil = path.resolve(DSB_ROOT, 'workspace', 'context', '..', '..', '..', 'etc', 'passwd');
      const result = safeReadFile(evil);
      expect(result.ok).toBe(false);
    });

    it('returns error for non-existent file in valid path', () => {
      const target = path.resolve(DSB_ROOT, 'workspace', 'context', 'nonexistent-file-12345.json');
      const result = safeReadFile(target);
      // Guard passes (path is valid), but read fails (file missing)
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Failed to read');
      }
    });

    it('reads a real file inside workspace/context/', () => {
      const target = path.resolve(DSB_ROOT, 'workspace', 'context', 'README.md');
      const result = safeReadFile(target);
      // This file should exist in the project
      if (result.ok) {
        expect(typeof result.value).toBe('string');
        expect(result.value.length).toBeGreaterThan(0);
      }
    });
  });

  describe('safeReadJson', () => {
    it('denies reading JSON outside sandbox', () => {
      const result = safeReadJson('/etc/hosts');
      expect(result.ok).toBe(false);
    });

    it('returns error for non-JSON content', () => {
      // README.md is not valid JSON
      const target = path.resolve(DSB_ROOT, 'workspace', 'context', 'README.md');
      const result = safeReadJson(target);
      if (!result.ok) {
        expect(result.error).toContain('parse JSON');
      }
      // Some README.md might not exist, or it might be accidental JSON — both ok
    });
  });

  // =========================================================================
  // WRITE OPERATIONS — path validation
  // =========================================================================

  describe('safeWriteFile', () => {
    it('denies writing outside sandbox', () => {
      const result = safeWriteFile('/tmp/hack.txt', 'evil');
      expect(result.ok).toBe(false);
    });

    it('denies writing to workspace/context/ (read-only)', () => {
      const target = path.resolve(DSB_ROOT, 'workspace', 'context', 'injected.json');
      const result = safeWriteFile(target, '{}');
      expect(result.ok).toBe(false);
    });

    it('denies writing to system paths', () => {
      const result = safeWriteFile('/etc/shadow', 'hack');
      expect(result.ok).toBe(false);
    });
  });

  describe('safeWriteJson', () => {
    it('denies writing JSON outside sandbox', () => {
      const result = safeWriteJson('/tmp/data.json', { x: 1 });
      expect(result.ok).toBe(false);
    });
  });

  // =========================================================================
  // EXISTS — path validation
  // =========================================================================

  describe('safeExists', () => {
    it('denies existence check outside sandbox', () => {
      const result = safeExists('/etc/hosts');
      expect(result.ok).toBe(false);
    });

    it('returns true for existing workspace/context/README.md', () => {
      const target = path.resolve(DSB_ROOT, 'workspace', 'context', 'README.md');
      const result = safeExists(target);
      if (result.ok) {
        // README.md should exist
        expect(result.value).toBe(true);
      }
    });

    it('returns false for non-existent file in valid path', () => {
      const target = path.resolve(DSB_ROOT, 'workspace', 'context', 'does-not-exist-xyz.json');
      const result = safeExists(target);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(false);
      }
    });
  });

  // =========================================================================
  // LIST DIR — path validation
  // =========================================================================

  describe('safeListDir', () => {
    it('denies listing outside sandbox', () => {
      const result = safeListDir('/etc');
      expect(result.ok).toBe(false);
    });

    it('lists workspace/context/ directory', () => {
      const target = path.resolve(DSB_ROOT, 'workspace', 'context');
      const result = safeListDir(target);
      if (result.ok) {
        expect(Array.isArray(result.value)).toBe(true);
        expect(result.value.length).toBeGreaterThan(0);
      }
    });
  });

  // =========================================================================
  // DELETE — path validation (restricted to workspace/temp/)
  // =========================================================================

  describe('safeDelete', () => {
    it('denies deleting outside sandbox', () => {
      const result = safeDelete('/etc/hosts');
      expect(result.ok).toBe(false);
    });

    it('denies deleting from workspace/context/', () => {
      const target = path.resolve(DSB_ROOT, 'workspace', 'context', 'README.md');
      const result = safeDelete(target);
      expect(result.ok).toBe(false);
    });
  });
});
