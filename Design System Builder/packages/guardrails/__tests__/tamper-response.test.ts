import { describe, it, expect } from 'vitest';
import { evaluateTamperLevel } from '../src/tamper-response';
import { IS_DEVELOPMENT } from '../src/constants';
import type { IntegrityCheckResult } from '../src/integrity';

/**
 * Tests for tamper-response evaluateTamperLevel — the pure classification function.
 *
 * Note: In development mode (IS_DEVELOPMENT === true), evaluateTamperLevel always
 * returns null. These tests adapt accordingly.
 */

/** Helper to build an IntegrityCheckResult for testing. */
function makeCheckResult(overrides: Partial<IntegrityCheckResult> = {}): IntegrityCheckResult {
  return {
    status: 'tampered',
    modifiedFiles: [],
    missingFiles: [],
    addedFiles: [],
    ...overrides,
  };
}

describe('tamper-response', () => {
  describe('evaluateTamperLevel', () => {
    it('returns null for valid status', () => {
      const result = evaluateTamperLevel(makeCheckResult({ status: 'valid' }));
      expect(result).toBeNull();
    });

    it('returns null for bypassed status', () => {
      const result = evaluateTamperLevel(makeCheckResult({ status: 'bypassed' }));
      expect(result).toBeNull();
    });

    if (!IS_DEVELOPMENT) {
      it('returns Level 3 when integrity-manifest.json is modified', () => {
        const result = evaluateTamperLevel(makeCheckResult({
          modifiedFiles: ['integrity-manifest.json'],
        }));
        expect(result).toBe(3);
      });

      it('returns Level 3 when licensing files are modified', () => {
        const result = evaluateTamperLevel(makeCheckResult({
          modifiedFiles: ['packages/licensing/dist/index.js'],
        }));
        expect(result).toBe(3);
      });

      it('returns Level 3 when guardrails files are modified', () => {
        const result = evaluateTamperLevel(makeCheckResult({
          modifiedFiles: ['packages/guardrails/dist/index.js'],
        }));
        expect(result).toBe(3);
      });

      it('returns Level 1 for a single non-critical file modification', () => {
        const result = evaluateTamperLevel(makeCheckResult({
          modifiedFiles: ['packages/core/dist/index.js'],
        }));
        expect(result).toBe(1);
      });

      it('returns Level 1 for a single missing file', () => {
        const result = evaluateTamperLevel(makeCheckResult({
          missingFiles: ['packages/core/dist/index.js'],
        }));
        expect(result).toBe(1);
      });

      it('returns Level 2 or 3 for >2 modified files', () => {
        const result = evaluateTamperLevel(makeCheckResult({
          modifiedFiles: ['a.js', 'b.js', 'c.js'],
        }));
        // Level 2 on first occurrence, escalates to 3 if tamper state already exists
        expect([2, 3]).toContain(result);
      });

      it('returns Level 2 or 3 for >2 missing files', () => {
        const result = evaluateTamperLevel(makeCheckResult({
          missingFiles: ['a.js', 'b.js', 'c.js'],
        }));
        // Level 2 on first occurrence, escalates to 3 if tamper state already exists
        expect([2, 3]).toContain(result);
      });

      it('returns Level 2 for exactly 2 modified + 1 missing (total > 2)', () => {
        const result = evaluateTamperLevel(makeCheckResult({
          modifiedFiles: ['a.js', 'b.js'],
          missingFiles: ['c.js'],
        }));
        // ≤2 modified, ≤1 missing, falls to last branch → returns 2
        // The condition is: modified.length > 2 || missing.length > 2
        // 2 > 2 is false, 1 > 2 is false → falls through to the ≤1 check
        // modified.length ≤ 1 is false (it's 2) → returns 2
        expect(result).toBe(2);
      });
    } else {
      it('returns null for all tampered results in development mode', () => {
        const result = evaluateTamperLevel(makeCheckResult({
          modifiedFiles: ['integrity-manifest.json'],
        }));
        expect(result).toBeNull();
      });
    }

    it('returns null for missing_manifest status in development mode', () => {
      // In dev mode, early return for IS_DEVELOPMENT happens before status check
      // In prod mode, missing_manifest is not 'valid' or 'bypassed', so it continues
      const result = evaluateTamperLevel(makeCheckResult({ status: 'missing_manifest' }));
      if (IS_DEVELOPMENT) {
        expect(result).toBeNull();
      } else {
        // missing_manifest with no modified/missing files → status is 'missing_manifest'
        // The function checks modified/missing arrays which are empty
        // ≤1 modified and ≤1 missing → returns 1
        expect(result).toBe(1);
      }
    });
  });
});
