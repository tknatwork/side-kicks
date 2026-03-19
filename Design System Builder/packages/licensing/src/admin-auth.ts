/**
 * Admin Auth — secp256k1 ECDSA authentication for DSB team access.
 *
 * Admin mode grants:
 *   - Full folder structure access (bypasses encryption barriers)
 *   - Plaintext reading of encrypted files
 *   - Update publishing tools
 *   - Telemetry raw data access
 *   - Anti-tamper daemon control (monitor-only mode)
 *
 * Admin mode is:
 *   - Session-only (key held in process memory, never on disk)
 *   - Time-limited (4-hour max session)
 *   - Challenge-response based (key proves identity without being stored)
 *   - Invisible to normal users (tools don't appear in MCP list)
 *
 * Authentication flow:
 *   1. User types `dsb admin unlock <signed-challenge>` in Claude Code
 *   2. MCP server generates a random challenge on first call
 *   3. Admin signs challenge with secp256k1 private key (hardware wallet)
 *   4. MCP server verifies signature against embedded public key
 *   5. If valid → admin mode activates for current session
 *
 * SECURITY:
 *   - The private key NEVER touches this code or any user machine
 *   - secp256k1 ECDSA is the same standard used by Bitcoin/Ethereum
 *   - Even with the public key extracted, signatures cannot be forged
 *   - Challenge-response prevents replay attacks
 *
 * @module licensing/admin-auth
 */

import * as crypto from 'node:crypto';
import { Result } from '@dsb/guardrails';
import { ADMIN_PUBLIC_KEY, ADMIN_KEY_ALGORITHM, ADMIN_SESSION_TTL_MS } from './admin-public-key';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export interface AdminSession {
  /** When admin mode was activated. */
  readonly activatedAt: number;
  /** When admin mode will automatically expire. */
  readonly expiresAt: number;
  /** The challenge that was signed to activate. */
  readonly challenge: string;
}

// ============================================================================
// SECTION 2: STATE (PROCESS MEMORY ONLY)
// ============================================================================

/**
 * Current admin session. Null = not in admin mode.
 *
 * CRITICAL: This is NEVER persisted to disk, logs, or any file.
 * It exists only in the MCP server process memory and is destroyed
 * on process exit, restart, or explicit lock.
 */
let activeSession: AdminSession | null = null;

/**
 * Pending challenge for the next admin unlock attempt.
 * Regenerated each time someone requests admin mode.
 * Expires after 5 minutes to prevent stale challenge attacks.
 */
let pendingChallenge: { value: string; createdAt: number } | null = null;

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// SECTION 3: CHALLENGE GENERATION
// ============================================================================

/**
 * Generate a fresh challenge for admin authentication.
 *
 * The admin must sign this challenge with their secp256k1 private key
 * and return the signature to complete authentication.
 *
 * @returns A random hex challenge string (64 chars = 32 bytes).
 */
export function generateAdminChallenge(): string {
  const challenge = crypto.randomBytes(32).toString('hex');
  pendingChallenge = {
    value: challenge,
    createdAt: Date.now(),
  };
  return challenge;
}

// ============================================================================
// SECTION 4: SIGNATURE VERIFICATION
// ============================================================================

/**
 * Verify an admin signature and activate admin mode if valid.
 *
 * @param signature - Base64-encoded ECDSA signature of the pending challenge.
 * @returns Ok(AdminSession) on success, Err(message) on failure.
 */
export function verifyAdminSignature(
  signature: string
): Result<AdminSession, string> {
  // Check for pending challenge
  if (!pendingChallenge) {
    return Result.err(
      'No pending admin challenge. Call generateAdminChallenge() first.'
    );
  }

  // Check challenge expiry
  if (Date.now() - pendingChallenge.createdAt > CHALLENGE_TTL_MS) {
    pendingChallenge = null;
    return Result.err(
      'Admin challenge expired. Generate a new one.'
    );
  }

  try {
    const signatureBuffer = Buffer.from(signature, 'base64');
    const challengeBuffer = Buffer.from(pendingChallenge.value, 'utf-8');

    const isValid = crypto.verify(
      ADMIN_KEY_ALGORITHM,
      challengeBuffer,
      ADMIN_PUBLIC_KEY,
      signatureBuffer
    );

    if (!isValid) {
      pendingChallenge = null;
      return Result.err('Admin signature verification failed. Invalid key.');
    }

    // Activate admin session
    const now = Date.now();
    activeSession = {
      activatedAt: now,
      expiresAt: now + ADMIN_SESSION_TTL_MS,
      challenge: pendingChallenge.value,
    };

    // Clear the challenge (one-time use)
    pendingChallenge = null;

    return Result.ok(activeSession);
  } catch (err: unknown) {
    pendingChallenge = null;
    const message = err instanceof Error ? err.message : String(err);
    return Result.err(`Admin verification error: ${message}`);
  }
}

// ============================================================================
// SECTION 5: SESSION MANAGEMENT
// ============================================================================

/**
 * Check if admin mode is currently active.
 *
 * Also handles automatic expiry — if the session TTL has elapsed,
 * admin mode is deactivated and this returns false.
 */
export function isAdminMode(): boolean {
  if (!activeSession) return false;

  // Check TTL
  if (Date.now() > activeSession.expiresAt) {
    activeSession = null;
    return false;
  }

  return true;
}

/**
 * Get the current admin session details (if active).
 * Returns null if not in admin mode.
 */
export function getAdminSession(): AdminSession | null {
  if (!isAdminMode()) return null;
  return activeSession;
}

/**
 * Explicitly deactivate admin mode.
 *
 * Called by `dsb admin lock` command or on MCP server shutdown.
 * Clears the session from memory immediately.
 */
export function deactivateAdminMode(): void {
  activeSession = null;
  pendingChallenge = null;
}

/**
 * Get remaining admin session time in milliseconds.
 * Returns 0 if not in admin mode.
 */
export function getAdminTimeRemaining(): number {
  if (!activeSession) return 0;

  const remaining = activeSession.expiresAt - Date.now();
  return Math.max(0, remaining);
}
