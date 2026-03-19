/**
 * Gumroad Client — HTTP client for Gumroad license API.
 *
 * Handles license verification against Gumroad's REST API.
 * Returns Result types for all operations.
 *
 * @module licensing/gumroad-client
 */

import { Result } from '@dsb/guardrails';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export interface GumroadLicense {
  readonly success: boolean;
  readonly uses: number;
  readonly purchase: {
    readonly product_id: string;
    readonly product_name: string;
    readonly license_key: string;
    readonly email: string;
    readonly variants: string;
    readonly refunded: boolean;
    readonly chargebacked: boolean;
    readonly custom_fields: Record<string, string>;
  };
}

export interface VerifyResult {
  readonly valid: boolean;
  readonly email: string;
  readonly tier: LicenseTier;
  readonly uses: number;
  readonly refunded: boolean;
  readonly chargebacked: boolean;
}

export type LicenseTier = 'free' | 'pro' | 'team';

// ============================================================================
// SECTION 2: CONFIGURATION
// ============================================================================

const GUMROAD_API_URL = 'https://api.gumroad.com/v2/licenses/verify';

/** Product ID will be set when Gumroad product is created */
const PRODUCT_ID = process.env.DSB_GUMROAD_PRODUCT_ID || '';

// ============================================================================
// SECTION 3: VERIFICATION
// ============================================================================

/**
 * Verify a license key against Gumroad API.
 *
 * @param licenseKey - The user's license key from their Gumroad purchase.
 * @returns Verification result with tier information.
 */
export async function verifyLicense(
  licenseKey: string
): Promise<Result<VerifyResult, string>> {
  // Development bypass
  if (process.env.LICENSE_BYPASS === 'true') {
    return Result.ok({
      valid: true,
      email: 'dev@localhost',
      tier: 'pro',
      uses: 1,
      refunded: false,
      chargebacked: false,
    });
  }

  if (!licenseKey || licenseKey.trim().length === 0) {
    return Result.err('License key is required. Enter the key from your Gumroad purchase.');
  }

  if (!PRODUCT_ID) {
    return Result.err(
      'Gumroad product not configured. Set DSB_GUMROAD_PRODUCT_ID environment variable.'
    );
  }

  try {
    const response = await fetch(GUMROAD_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        product_id: PRODUCT_ID,
        license_key: licenseKey.trim(),
        increment_uses_count: 'false',
      }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return Result.err('Invalid license key. Check your Gumroad purchase email for the correct key.');
      }
      return Result.err(`Gumroad API returned status ${response.status}. Try again later.`);
    }

    const data = await response.json() as GumroadLicense;

    if (!data.success) {
      return Result.err('License verification failed. The key may be invalid or expired.');
    }

    if (data.purchase.refunded) {
      return Result.err('This license has been refunded and is no longer valid.');
    }

    if (data.purchase.chargebacked) {
      return Result.err('This license has a chargeback and is no longer valid.');
    }

    const tier = detectTier(data);

    return Result.ok({
      valid: true,
      email: data.purchase.email,
      tier,
      uses: data.uses,
      refunded: data.purchase.refunded,
      chargebacked: data.purchase.chargebacked,
    });
  } catch (err) {
    if (err instanceof TypeError && String(err).includes('fetch')) {
      return Result.err(
        'Cannot reach Gumroad API. Check your internet connection. ' +
        'If you were previously activated, offline mode is available for 7 days.'
      );
    }
    return Result.err('License verification error: ' + String(err));
  }
}

/**
 * Detect license tier from Gumroad purchase data.
 * Tier is determined by the variant selected at purchase time.
 */
function detectTier(data: GumroadLicense): LicenseTier {
  const variant = (data.purchase.variants || '').toLowerCase();

  if (variant.includes('team')) return 'team';
  if (variant.includes('pro')) return 'pro';

  // Default to pro for any paid license
  return 'pro';
}
