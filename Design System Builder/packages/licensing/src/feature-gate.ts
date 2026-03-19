/**
 * Feature Gate — Controls which features are available per license tier.
 *
 * The feature gate is the enforcement point for licensing.
 * Every MCP tool checks it before executing.
 *
 * @module licensing/feature-gate
 */

import { Result } from '@dsb/guardrails';
import type { LicenseTier } from './gumroad-client';
import { getActivationStatus } from './activation';

// ============================================================================
// SECTION 1: FEATURE DEFINITIONS
// ============================================================================

/**
 * Feature categories that can be gated by license tier.
 */
export type Feature =
  // Query operations (free)
  | 'query:file_info'
  | 'query:collection_details'
  | 'query:selection'
  | 'query:fonts'
  // Export operations (free)
  | 'export:json'
  | 'export:dtcg'
  // Validation (free)
  | 'validate:tokens'
  | 'validate:plan_limits'
  | 'validate:fonts'
  // Creation operations (pro+)
  | 'create:collection'
  | 'create:variables'
  | 'create:styles'
  | 'create:pages'
  | 'create:nodes'
  // Batch operations (pro+)
  | 'batch:variables'
  | 'batch:aliases'
  // Generation operations (pro+)
  | 'generate:styles'
  | 'generate:palette'
  | 'generate:tokens'
  // Learning operations (pro+)
  | 'learn:scan_figma'
  | 'learn:scan_codebase'
  | 'learn:analyze'
  // Import operations (pro+)
  | 'import:tokens'
  // Agent operations (pro+)
  | 'agent:conversation'
  | 'agent:token'
  | 'agent:style'
  | 'agent:layout'
  | 'agent:qa';

/**
 * Feature access matrix.
 * true = accessible at this tier and above.
 */
const FEATURE_MATRIX: Readonly<Record<Feature, LicenseTier>> = {
  // Free tier — read and export only
  'query:file_info': 'free',
  'query:collection_details': 'free',
  'query:selection': 'free',
  'query:fonts': 'free',
  'export:json': 'free',
  'export:dtcg': 'free',
  'validate:tokens': 'free',
  'validate:plan_limits': 'free',
  'validate:fonts': 'free',

  // Pro tier — full creation and generation
  'create:collection': 'pro',
  'create:variables': 'pro',
  'create:styles': 'pro',
  'create:pages': 'pro',
  'create:nodes': 'pro',
  'batch:variables': 'pro',
  'batch:aliases': 'pro',
  'generate:styles': 'pro',
  'generate:palette': 'pro',
  'generate:tokens': 'pro',
  'learn:scan_figma': 'pro',
  'learn:scan_codebase': 'pro',
  'learn:analyze': 'pro',
  'import:tokens': 'pro',
  'agent:conversation': 'pro',
  'agent:token': 'pro',
  'agent:style': 'pro',
  'agent:layout': 'pro',
  'agent:qa': 'pro',
};

// ============================================================================
// SECTION 2: TIER HIERARCHY
// ============================================================================

const TIER_LEVEL: Readonly<Record<LicenseTier, number>> = {
  free: 0,
  pro: 1,
  team: 2,
};

function hasTierAccess(userTier: LicenseTier, requiredTier: LicenseTier): boolean {
  return TIER_LEVEL[userTier] >= TIER_LEVEL[requiredTier];
}

// ============================================================================
// SECTION 3: GATE CHECK
// ============================================================================

/**
 * Check if a feature is allowed under the current license.
 *
 * @param feature - The feature to check.
 * @returns Ok(true) if allowed, Err with upgrade message if not.
 */
export function checkFeatureAccess(feature: Feature): Result<true, string> {
  // Development bypass
  if (process.env.LICENSE_BYPASS === 'true') {
    return Result.ok(true);
  }

  const status = getActivationStatus();
  const requiredTier = FEATURE_MATRIX[feature];

  if (!requiredTier) {
    return Result.err(`Unknown feature: "${feature}".`);
  }

  if (hasTierAccess(status.tier, requiredTier)) {
    return Result.ok(true);
  }

  return Result.err(
    `The "${feature}" feature requires a ${requiredTier} license (you have: ${status.tier}). ` +
    `Upgrade at your Gumroad purchase page to unlock this feature.`
  );
}

/**
 * Get all features available at a given tier.
 */
export function getFeaturesForTier(tier: LicenseTier): readonly Feature[] {
  const features: Feature[] = [];

  for (const [feature, requiredTier] of Object.entries(FEATURE_MATRIX)) {
    if (hasTierAccess(tier, requiredTier as LicenseTier)) {
      features.push(feature as Feature);
    }
  }

  return features;
}

/**
 * Get all features with their required tier and current access status.
 */
export function getFeatureMatrix(): ReadonlyArray<{
  feature: Feature;
  requiredTier: LicenseTier;
  accessible: boolean;
}> {
  const status = getActivationStatus();

  return Object.entries(FEATURE_MATRIX).map(([feature, requiredTier]) => ({
    feature: feature as Feature,
    requiredTier,
    accessible: hasTierAccess(status.tier, requiredTier),
  }));
}
