/**
 * @dsb/licensing — Gumroad license validation, activation,
 * session tokens, feature gating, and admin authentication.
 *
 * @module licensing
 */

// Gumroad client
export { verifyLicense } from './gumroad-client';
export type { GumroadLicense, VerifyResult, LicenseTier } from './gumroad-client';

// Activation
export {
  activate,
  getActivationStatus,
  revalidate,
  deactivate,
  loadActivation,
  getActivationRecord,
} from './activation';
export type { ActivationRecord, ActivationStatus } from './activation';

// Session tokens
export { generateSessionToken, validateSessionToken } from './session-token';
export type { SessionToken } from './session-token';

// Feature gate
export { checkFeatureAccess, getFeaturesForTier, getFeatureMatrix } from './feature-gate';
export type { Feature } from './feature-gate';

// Admin public key
export {
  ADMIN_PUBLIC_KEY,
  ADMIN_KEY_ALGORITHM,
  ADMIN_DERIVATION_PATH,
  ADMIN_SESSION_TTL_MS,
} from './admin-public-key';

// Admin authentication
export {
  generateAdminChallenge,
  verifyAdminSignature,
  isAdminMode,
  getAdminSession,
  deactivateAdminMode,
  getAdminTimeRemaining,
} from './admin-auth';
export type { AdminSession } from './admin-auth';
