/**
 * Machine Fingerprint — Cross-platform machine identification.
 *
 * Generates a deterministic fingerprint for the current machine.
 * Used for license binding (one license = one machine).
 *
 * Platform-specific:
 *   macOS:   IOPlatformSerialNumber + username
 *   Windows: MachineGuid from registry + username
 *   Linux:   /etc/machine-id + username
 *
 * @module machine-fingerprint
 */
import { Result } from './result';
/**
 * Generate a deterministic machine fingerprint.
 *
 * @returns SHA-256 hash of platform ID + username.
 */
export declare function getMachineFingerprint(): Result<string, string>;
//# sourceMappingURL=machine-fingerprint.d.ts.map