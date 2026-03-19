/**
 * Activation — License activation and cached validation.
 *
 * Manages the activation lifecycle:
 * 1. First activation: verify with Gumroad → cache locally
 * 2. Subsequent sessions: load cache → verify if expired
 * 3. Offline grace: allow cached activation for 7 days
 *
 * @module licensing/activation
 */

import { Result } from '@dsb/guardrails';
import { verifyLicense } from './gumroad-client';
import type { VerifyResult, LicenseTier } from './gumroad-client';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export interface ActivationRecord {
  readonly licenseKey: string;
  readonly email: string;
  readonly tier: LicenseTier;
  readonly activatedAt: number;
  readonly lastVerifiedAt: number;
  readonly expiresAt: number;
}

export interface ActivationStatus {
  readonly activated: boolean;
  readonly tier: LicenseTier;
  readonly email: string;
  readonly offlineMode: boolean;
  readonly daysUntilRevalidation: number;
}

// ============================================================================
// SECTION 2: CONFIGURATION
// ============================================================================

/** Cache duration: 7 days before re-validation is required */
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// ============================================================================
// SECTION 3: IN-MEMORY ACTIVATION STATE
// ============================================================================

/**
 * Current activation record (in-memory).
 * In production, this would be persisted to ~/.dsb/activation.enc.
 * For now, we keep it in memory — the MCP server holds it for the session.
 */
let currentActivation: ActivationRecord | null = null;

/**
 * Activate a license key.
 * Verifies with Gumroad and caches the result.
 */
export async function activate(
  licenseKey: string
): Promise<Result<ActivationRecord, string>> {
  // Development bypass
  if (process.env.LICENSE_BYPASS === 'true') {
    const record: ActivationRecord = {
      licenseKey: 'DEV-BYPASS',
      email: 'dev@localhost',
      tier: 'pro',
      activatedAt: Date.now(),
      lastVerifiedAt: Date.now(),
      expiresAt: Date.now() + CACHE_DURATION_MS,
    };
    currentActivation = record;
    return Result.ok(record);
  }

  const verifyResult = await verifyLicense(licenseKey);
  if (!verifyResult.ok) {
    return Result.err(verifyResult.error);
  }

  const verified = verifyResult.value;
  const now = Date.now();

  const record: ActivationRecord = {
    licenseKey,
    email: verified.email,
    tier: verified.tier,
    activatedAt: now,
    lastVerifiedAt: now,
    expiresAt: now + CACHE_DURATION_MS,
  };

  currentActivation = record;
  return Result.ok(record);
}

/**
 * Check current activation status.
 * Returns the cached status without re-verifying (unless expired).
 */
export function getActivationStatus(): ActivationStatus {
  // Development bypass
  if (process.env.LICENSE_BYPASS === 'true') {
    return {
      activated: true,
      tier: 'pro',
      email: 'dev@localhost',
      offlineMode: false,
      daysUntilRevalidation: 7,
    };
  }

  if (!currentActivation) {
    return {
      activated: false,
      tier: 'free',
      email: '',
      offlineMode: false,
      daysUntilRevalidation: 0,
    };
  }

  const now = Date.now();
  const expired = now > currentActivation.expiresAt;
  const msUntilExpiry = Math.max(0, currentActivation.expiresAt - now);
  const daysUntil = Math.ceil(msUntilExpiry / (24 * 60 * 60 * 1000));

  return {
    activated: true,
    tier: expired ? 'free' : currentActivation.tier,
    email: currentActivation.email,
    offlineMode: expired,
    daysUntilRevalidation: daysUntil,
  };
}

/**
 * Re-validate the current activation against Gumroad.
 * Call this when the cache has expired and we have internet.
 */
export async function revalidate(): Promise<Result<ActivationRecord, string>> {
  if (!currentActivation) {
    return Result.err('No activation to revalidate. Call activate() first.');
  }

  return activate(currentActivation.licenseKey);
}

/**
 * Deactivate the current license.
 */
export function deactivate(): void {
  currentActivation = null;
}

/**
 * Load an activation record (e.g., from persisted storage).
 */
export function loadActivation(record: ActivationRecord): void {
  currentActivation = record;
}

/**
 * Get the raw activation record (for persistence).
 */
export function getActivationRecord(): ActivationRecord | null {
  return currentActivation;
}
