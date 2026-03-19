/**
 * Integrity Verification — File hash manifest and tamper detection.
 *
 * At build time, a manifest of SHA-256 hashes is generated and HMAC-signed.
 * At runtime, the toolkit verifies its own files against this manifest.
 *
 * @module integrity
 */
import { Result } from './result';
export interface IntegrityManifest {
    /** Map of relative file paths to their SHA-256 hashes. */
    readonly files: Record<string, string>;
    /** HMAC-SHA256 signature of the files map. */
    readonly signature: string;
    /** Build version that generated this manifest. */
    readonly buildVersion: string;
    /** Timestamp of manifest generation. */
    readonly generatedAt: string;
}
export type IntegrityStatus = 'valid' | 'tampered' | 'missing_manifest' | 'bypassed';
export interface IntegrityCheckResult {
    readonly status: IntegrityStatus;
    /** Files that have been modified (hash mismatch). */
    readonly modifiedFiles: readonly string[];
    /** Files in manifest but missing from disk. */
    readonly missingFiles: readonly string[];
    /** Files on disk but not in manifest (additions). */
    readonly addedFiles: readonly string[];
}
/**
 * Generate an integrity manifest for all critical files.
 * Called at build/packaging time only.
 *
 * @param signingSecret - The secret used to sign the manifest (never shipped).
 * @param buildVersion - The build version string.
 * @returns The generated manifest.
 */
export declare function generateManifest(signingSecret: string, buildVersion: string): Result<IntegrityManifest, string>;
/**
 * Verify the integrity of the toolkit against the manifest.
 *
 * @returns Check result with lists of modified, missing, and added files.
 */
export declare function verifyIntegrity(): IntegrityCheckResult;
/**
 * Verify a random subset of files (used for heartbeat checks).
 *
 * @param count - Number of files to randomly check.
 * @returns Whether all checked files are intact.
 */
export declare function verifyRandomSubset(count?: number): IntegrityCheckResult;
//# sourceMappingURL=integrity.d.ts.map