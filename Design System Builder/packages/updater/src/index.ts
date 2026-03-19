/**
 * @dsb/updater — Secure OTA update system for Design System Builder.
 *
 * Modules:
 *   constants        — Endpoints, embedded public key, paths, timing
 *   version-checker  — Fetch + verify signed manifests, semver comparison
 *   update-pipeline  — Atomic download → verify → backup → swap → rollback
 *
 * SECURITY MODEL:
 *   - Ed25519 public key embedded in constants (verify-only, cannot forge)
 *   - Gumroad license authenticates download access (separate system)
 *   - Every bundle is signature-checked + per-file checksum-verified
 *   - Atomic swap + automatic rollback on any failure
 *   - Anti-tamper daemon paused via time-limited update token during install
 *
 * @module updater
 */

// ─── Constants ───────────────────────────────────────────────────────────────

export {
  UPDATE_SERVER_URL,
  MANIFEST_ENDPOINT,
  BUNDLE_ENDPOINT,
  UPDATE_PUBLIC_KEY,
  CURRENT_VERSION,
  UPDATE_CHECK_TIMEOUT_MS,
  BUNDLE_DOWNLOAD_TIMEOUT_MS,
  UPDATE_TOKEN_TTL_MS,
  MIN_TLS_VERSION,
  backupDir,
  stagingDir,
  bundlePath,
} from './constants';

// ─── Version Checker ─────────────────────────────────────────────────────────

export {
  checkForUpdates,
  fetchSignedManifest,
  verifyManifestSignature,
  isNewerVersion,
  isVersionAtLeast,
} from './version-checker';

export type {
  UpdateManifest,
  SignedManifest,
  UpdateCheckResult,
} from './version-checker';

// ─── Update Pipeline ─────────────────────────────────────────────────────────

export {
  executeUpdate,
} from './update-pipeline';

export type {
  UpdateResult,
  UpdateBridge,
  ProgressCallback,
} from './update-pipeline';

// ─── Publish Pipeline (Admin-Only) ───────────────────────────────────────────

export {
  publishUpdate,
} from './publish-pipeline';

export type {
  PublishConfig,
  PublishResult,
} from './publish-pipeline';
