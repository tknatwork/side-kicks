/**
 * Version Checker — Checks the update server for new DSB releases.
 *
 * Called on MCP server startup (non-blocking). Fetches the signed
 * version manifest from the update server, verifies its Ed25519
 * signature, and compares semver to the local version.
 *
 * Flow:
 *   1. MCP server starts → calls checkForUpdates() in background
 *   2. Fetches signed manifest from HTTPS endpoint (Gumroad license as auth)
 *   3. Verifies Ed25519 signature with embedded public key
 *   4. Compares semver: local vs remote
 *   5. Returns UpdateCheckResult for Claude to present to user
 *
 * @module updater/version-checker
 */

import * as https from 'node:https';
import * as crypto from 'node:crypto';
import { Result } from '@dsb/guardrails';
import {
  MANIFEST_ENDPOINT,
  UPDATE_PUBLIC_KEY,
  CURRENT_VERSION,
  UPDATE_CHECK_TIMEOUT_MS,
  MIN_TLS_VERSION,
} from './constants';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

/** The signed manifest returned by the update server. */
export interface UpdateManifest {
  /** Latest available version (semver, e.g., "2.1.0"). */
  readonly version: string;
  /** Human-readable changelog (Markdown). */
  readonly changelog: string;
  /** HTTPS URL to download the signed bundle. */
  readonly downloadUrl: string;
  /** SHA-256 checksum of the bundle file. */
  readonly bundleChecksum: string;
  /** ISO timestamp of the release. */
  readonly releasedAt: string;
  /** Minimum DSB version required to apply this update (for skip-version upgrades). */
  readonly minVersion: string;
  /** Per-file checksums for integrity verification after extraction. */
  readonly fileChecksums: Record<string, string>;
}

/** Signed manifest envelope from the server. */
export interface SignedManifest {
  /** Base64-encoded Ed25519 signature of the manifest JSON. */
  readonly signature: string;
  /** The manifest payload (JSON string). */
  readonly payload: string;
}

/** Result of a version check. */
export interface UpdateCheckResult {
  /** Whether a newer version is available. */
  readonly available: boolean;
  /** Current installed version. */
  readonly currentVersion: string;
  /** Latest available version (null if check failed). */
  readonly latestVersion: string | null;
  /** Changelog for the update (null if no update or check failed). */
  readonly changelog: string | null;
  /** The verified manifest (null if no update or check failed). */
  readonly manifest: UpdateManifest | null;
}

// ============================================================================
// SECTION 2: VERSION CHECK
// ============================================================================

/**
 * Check for available updates.
 *
 * Non-blocking — designed to be called on startup without awaiting.
 * If the check fails (network error, invalid signature, etc.),
 * it returns { available: false } rather than throwing.
 *
 * @param licenseKey - The user's Gumroad license key (for server auth).
 * @returns Update check result.
 */
export async function checkForUpdates(
  licenseKey: string
): Promise<UpdateCheckResult> {
  const noUpdate: UpdateCheckResult = {
    available: false,
    currentVersion: CURRENT_VERSION,
    latestVersion: null,
    changelog: null,
    manifest: null,
  };

  // Fetch signed manifest
  const manifestResult = await fetchSignedManifest(licenseKey);
  if (!manifestResult.ok) {
    // Silently fail — update checks should never block startup
    return noUpdate;
  }

  // Verify signature
  const verifyResult = verifyManifestSignature(manifestResult.value);
  if (!verifyResult.ok) {
    return noUpdate;
  }

  const manifest = verifyResult.value;

  // Compare versions
  if (!isNewerVersion(CURRENT_VERSION, manifest.version)) {
    return { ...noUpdate, latestVersion: manifest.version };
  }

  // Check minimum version constraint
  if (!isVersionAtLeast(CURRENT_VERSION, manifest.minVersion)) {
    // Current version is too old for a direct upgrade — need manual reinstall
    return noUpdate;
  }

  return {
    available: true,
    currentVersion: CURRENT_VERSION,
    latestVersion: manifest.version,
    changelog: manifest.changelog,
    manifest,
  };
}

// ============================================================================
// SECTION 3: MANIFEST FETCHING
// ============================================================================

/**
 * Fetch the signed manifest from the update server.
 *
 * @param licenseKey - Gumroad license for authentication.
 * @returns Signed manifest envelope or error.
 */
export async function fetchSignedManifest(
  licenseKey: string
): Promise<Result<SignedManifest, string>> {
  const url = `${MANIFEST_ENDPOINT}?license=${encodeURIComponent(licenseKey)}&version=${encodeURIComponent(CURRENT_VERSION)}`;

  return new Promise((resolve) => {
    const req = https.get(
      url,
      {
        timeout: UPDATE_CHECK_TIMEOUT_MS,
        minVersion: MIN_TLS_VERSION as 'TLSv1.3',
      },
      (res) => {
        if (res.statusCode === 403) {
          resolve(Result.err('License invalid or expired. Update server returned 403.'));
          return;
        }

        if (res.statusCode === 204 || res.statusCode === 304) {
          resolve(Result.err('No update available (server returned no-content).'));
          return;
        }

        if (res.statusCode !== 200) {
          resolve(Result.err(`Update server returned HTTP ${res.statusCode ?? 'unknown'}.`));
          return;
        }

        let body = '';
        res.setEncoding('utf-8');
        res.on('data', (chunk: string) => { body += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body) as SignedManifest;
            if (!parsed.signature || !parsed.payload) {
              resolve(Result.err('Malformed manifest: missing signature or payload.'));
              return;
            }
            resolve(Result.ok(parsed));
          } catch {
            resolve(Result.err('Failed to parse manifest JSON from update server.'));
          }
        });
      }
    );

    req.on('error', (err) => {
      resolve(Result.err(`Update check network error: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(Result.err('Update check timed out.'));
    });
  });
}

// ============================================================================
// SECTION 4: SIGNATURE VERIFICATION
// ============================================================================

/**
 * Verify the Ed25519 signature of a manifest payload.
 *
 * The update server signs the JSON payload with the Ed25519 private key.
 * We verify here using the embedded public key. If the signature is
 * invalid (tampered CDN, MITM, forged payload), verification fails
 * and the update is rejected.
 *
 * @param signed - The signed manifest envelope.
 * @returns Parsed and verified manifest, or error.
 */
export function verifyManifestSignature(
  signed: SignedManifest
): Result<UpdateManifest, string> {
  try {
    const signatureBuffer = Buffer.from(signed.signature, 'base64');
    const payloadBuffer = Buffer.from(signed.payload, 'utf-8');

    const isValid = crypto.verify(
      null, // Ed25519 doesn't use a separate hash algorithm
      payloadBuffer,
      UPDATE_PUBLIC_KEY,
      signatureBuffer
    );

    if (!isValid) {
      return Result.err(
        'Update manifest signature verification failed. '
        + 'The manifest may have been tampered with. Update rejected.'
      );
    }

    const manifest = JSON.parse(signed.payload) as UpdateManifest;

    // Basic shape validation
    if (!manifest.version || !manifest.downloadUrl || !manifest.bundleChecksum) {
      return Result.err('Manifest missing required fields (version, downloadUrl, bundleChecksum).');
    }

    return Result.ok(manifest);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Result.err(`Signature verification error: ${message}`);
  }
}

// ============================================================================
// SECTION 5: SEMVER COMPARISON
// ============================================================================

/**
 * Parse a semver string into [major, minor, patch].
 * Returns [0, 0, 0] for invalid strings.
 */
function parseSemver(version: string): [number, number, number] {
  const cleaned = version.replace(/^v/, '');
  const parts = cleaned.split('.');
  return [
    parseInt(parts[0] ?? '0', 10) || 0,
    parseInt(parts[1] ?? '0', 10) || 0,
    parseInt(parts[2] ?? '0', 10) || 0,
  ];
}

/**
 * Check if `remote` is newer than `local`.
 *
 * @param local - Current installed version (e.g., "0.1.0").
 * @param remote - Available remote version (e.g., "0.2.0").
 * @returns true if remote > local.
 */
export function isNewerVersion(local: string, remote: string): boolean {
  const [lMaj, lMin, lPatch] = parseSemver(local);
  const [rMaj, rMin, rPatch] = parseSemver(remote);

  if (rMaj !== lMaj) return rMaj > lMaj;
  if (rMin !== lMin) return rMin > lMin;
  return rPatch > lPatch;
}

/**
 * Check if `current` >= `minimum`.
 *
 * Used for minVersion constraint — ensures the user's current version
 * is new enough to apply the update directly (no skip-version gaps).
 *
 * @param current - Current installed version.
 * @param minimum - Minimum required version for this update.
 * @returns true if current >= minimum.
 */
export function isVersionAtLeast(current: string, minimum: string): boolean {
  const [cMaj, cMin, cPatch] = parseSemver(current);
  const [mMaj, mMin, mPatch] = parseSemver(minimum);

  if (cMaj !== mMaj) return cMaj > mMaj;
  if (cMin !== mMin) return cMin > mMin;
  return cPatch >= mPatch;
}
