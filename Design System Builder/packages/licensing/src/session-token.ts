/**
 * Session Token — Generate and validate session tokens for
 * protocol authentication between MCP server, orchestration server,
 * and Figma plugin.
 *
 * @module licensing/session-token
 */

import { randomBytes, createHmac } from 'node:crypto';
import { Result } from '@dsb/guardrails';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export interface SessionToken {
  readonly token: string;
  readonly createdAt: number;
  readonly expiresAt: number;
}

// ============================================================================
// SECTION 2: CONFIGURATION
// ============================================================================

/** Session tokens expire after 24 hours */
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

/** Secret used for HMAC — in production, derived from license key */
const TOKEN_SECRET = process.env.DSB_TOKEN_SECRET || 'dsb-dev-secret';

// ============================================================================
// SECTION 3: TOKEN GENERATION
// ============================================================================

/**
 * Generate a new session token.
 * The token is an HMAC of a random nonce + timestamp, ensuring
 * it's both unique and verifiable.
 */
export function generateSessionToken(): SessionToken {
  const nonce = randomBytes(32).toString('hex');
  const timestamp = Date.now();

  const hmac = createHmac('sha256', TOKEN_SECRET);
  hmac.update(nonce);
  hmac.update(String(timestamp));
  const token = hmac.digest('hex');

  return {
    token,
    createdAt: timestamp,
    expiresAt: timestamp + SESSION_DURATION_MS,
  };
}

/**
 * Validate a session token against the active session.
 */
export function validateSessionToken(
  token: string,
  activeSession: SessionToken
): Result<true, string> {
  if (!token) {
    return Result.err('Session token is required.');
  }

  if (token !== activeSession.token) {
    return Result.err('Invalid session token.');
  }

  if (Date.now() > activeSession.expiresAt) {
    return Result.err('Session token has expired. Restart the MCP server.');
  }

  return Result.ok(true);
}
