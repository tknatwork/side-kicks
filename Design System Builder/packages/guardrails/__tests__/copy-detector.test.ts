import { describe, it, expect } from 'vitest';
import { checkCloudSync } from '../src/copy-detector';
import { IS_DEVELOPMENT } from '../src/constants';

/**
 * Tests for copy-detector — focuses on the pure string-matching functions.
 *
 * Note: registerInstallPath and checkPathMismatch write to ~/.dsb/ (real fs),
 * so we only test checkCloudSync which is a pure string-matching function
 * that checks DSB_ROOT against known cloud sync directory names.
 *
 * checkGitRepo walks the real filesystem so we test its behavior in context.
 */

describe('copy-detector', () => {
  describe('checkCloudSync', () => {
    if (IS_DEVELOPMENT) {
      it('returns not-detected in development mode', () => {
        const result = checkCloudSync();
        expect(result.detected).toBe(false);
      });
    } else {
      it('returns a CopyDetectionResult', () => {
        const result = checkCloudSync();
        expect(typeof result.detected).toBe('boolean');
      });

      it('result has reason when detected', () => {
        const result = checkCloudSync();
        if (result.detected) {
          expect(result.reason).toBe('cloud_sync_detected');
          expect(result.details).toBeTruthy();
        } else {
          expect(result.reason).toBeUndefined();
        }
      });

      it('does not detect cloud sync for the test project path', () => {
        // The test project is in "Github Project" not a cloud sync dir
        const result = checkCloudSync();
        expect(result.detected).toBe(false);
      });
    }
  });

  describe('CopyDetectionResult shape', () => {
    it('has detected as boolean', () => {
      const result = checkCloudSync();
      expect(typeof result.detected).toBe('boolean');
    });

    it('has optional reason field', () => {
      const result = checkCloudSync();
      if (!result.detected) {
        expect(result.reason).toBeUndefined();
        expect(result.details).toBeUndefined();
      }
    });
  });
});
