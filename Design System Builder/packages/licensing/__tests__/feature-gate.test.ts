import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkFeatureAccess, getFeaturesForTier, getFeatureMatrix } from '../src/feature-gate';
import type { Feature } from '../src/feature-gate';
import { activate, deactivate } from '../src/activation';

describe('feature-gate', () => {
  beforeEach(() => {
    // Enable bypass for activation, then disable for gate tests
    vi.stubEnv('LICENSE_BYPASS', 'false');
    deactivate();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('checkFeatureAccess', () => {
    it('allows free features without activation', () => {
      const result = checkFeatureAccess('query:file_info');
      expect(result.ok).toBe(true);
    });

    it('blocks pro features without activation', () => {
      const result = checkFeatureAccess('create:collection');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('pro license');
      }
    });

    it('allows all features in bypass mode', () => {
      vi.stubEnv('LICENSE_BYPASS', 'true');
      const result = checkFeatureAccess('create:collection');
      expect(result.ok).toBe(true);
    });

    it('returns error for unknown features', () => {
      const result = checkFeatureAccess('nonexistent:feature' as Feature);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Unknown feature');
      }
    });
  });

  describe('getFeaturesForTier', () => {
    it('returns only free features for free tier', () => {
      const features = getFeaturesForTier('free');
      expect(features.length).toBeGreaterThan(0);

      // All should be query, export, or validate
      for (const f of features) {
        expect(f).toMatch(/^(query|export|validate):/);
      }
    });

    it('returns more features for pro tier', () => {
      const freeFeatures = getFeaturesForTier('free');
      const proFeatures = getFeaturesForTier('pro');
      expect(proFeatures.length).toBeGreaterThan(freeFeatures.length);
    });

    it('team tier includes all pro features', () => {
      const proFeatures = getFeaturesForTier('pro');
      const teamFeatures = getFeaturesForTier('team');
      expect(teamFeatures.length).toBeGreaterThanOrEqual(proFeatures.length);
    });
  });

  describe('getFeatureMatrix', () => {
    it('returns all features with access status', () => {
      const matrix = getFeatureMatrix();
      expect(matrix.length).toBeGreaterThan(0);

      // Without activation, free features should be accessible
      const freeFeature = matrix.find(m => m.feature === 'query:file_info');
      expect(freeFeature?.accessible).toBe(true);

      // Pro features should not be accessible
      const proFeature = matrix.find(m => m.feature === 'create:collection');
      expect(proFeature?.accessible).toBe(false);
    });
  });
});
