/**
 * Updater Constants — Endpoints, keys, and paths for the OTA update system.
 *
 * SECURITY NOTES:
 * - The Ed25519 public key is embedded here for signature verification.
 *   The corresponding private key lives ONLY on the DSB build server
 *   (hardware wallet). It never touches user machines.
 * - The update server URL uses HTTPS exclusively (TLS 1.3 minimum).
 * - Gumroad license authenticates download access; Ed25519 verifies integrity.
 *
 * @module updater/constants
 */

import * as path from 'node:path';
import { DSB_ROOT } from '@dsb/guardrails';

// ============================================================================
// SECTION 1: ENDPOINTS
// ============================================================================

/**
 * HTTPS endpoint for the update manifest.
 *
 * The manifest JSON is signed with Ed25519. The MCP server fetches it
 * on startup (non-blocking) and compares semver to decide if an update
 * is available.
 */
export const UPDATE_SERVER_URL = 'https://updates.dsb.example/v1';

/** Manifest endpoint: GET /manifest?license=<key>&version=<current>. */
export const MANIFEST_ENDPOINT = `${UPDATE_SERVER_URL}/manifest`;

/** Bundle download endpoint: GET /bundle/<version>?license=<key>. */
export const BUNDLE_ENDPOINT = `${UPDATE_SERVER_URL}/bundle`;

// ============================================================================
// SECTION 2: CRYPTOGRAPHIC KEYS
// ============================================================================

/**
 * Ed25519 public key for verifying update bundle signatures.
 *
 * This is the ONLY key on user machines. The private key exists solely
 * on the DSB build server. Even if someone extracts this from the
 * source code, they cannot forge valid signatures — Ed25519 is
 * asymmetric (verify-only from the public key).
 *
 * Format: PEM-encoded Ed25519 public key.
 *
 * PLACEHOLDER: Replace with the real generated public key before first release.
 */
export const UPDATE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAPLACEHOLDERKEYTHATWILLBEREPLACEDBEFORERELEASEk=
-----END PUBLIC KEY-----`;

// ============================================================================
// SECTION 3: PATHS
// ============================================================================

/**
 * Backup directory for the current installation before an update.
 * Pattern: workspace/temp/backup-{version}/
 */
export function backupDir(version: string): string {
  return path.join(DSB_ROOT, 'workspace', 'temp', `backup-${version}`);
}

/**
 * Staging directory where the new update is extracted and verified
 * before the atomic swap.
 */
export function stagingDir(): string {
  return path.join(DSB_ROOT, 'workspace', 'temp', 'staging');
}

/**
 * Downloaded bundle path (temporary, deleted after extraction).
 */
export function bundlePath(version: string): string {
  return path.join(DSB_ROOT, 'workspace', 'temp', `update-${version}.tar.gz`);
}

// ============================================================================
// SECTION 4: TIMING
// ============================================================================

/** How long to wait for the update server to respond (ms). */
export const UPDATE_CHECK_TIMEOUT_MS = 10_000;

/** How long to wait for a bundle download (ms). */
export const BUNDLE_DOWNLOAD_TIMEOUT_MS = 120_000;

/** Update token TTL for the anti-tamper daemon (5 minutes). */
export const UPDATE_TOKEN_TTL_MS = 5 * 60 * 1000;

// ============================================================================
// SECTION 5: VERSIONING
// ============================================================================

/** Current DSB version. Updated at build time. */
export const CURRENT_VERSION = '0.1.0';

/**
 * Minimum TLS version for update connections.
 * Node.js 18+ supports TLS 1.3 natively.
 */
export const MIN_TLS_VERSION = 'TLSv1.3';
