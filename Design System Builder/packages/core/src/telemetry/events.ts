/**
 * Telemetry Events — Type definitions and anonymization for DSB telemetry.
 *
 * All events are anonymized before collection:
 *   - No file contents, token values, color choices
 *   - No user identity, email, IP, or machine identifiers
 *   - No Figma file names, project names, or org info
 *
 * Session IDs are random UUIDs generated per-session (not tied to any user).
 *
 * @module core/telemetry/events
 */

import * as crypto from 'node:crypto';

// ============================================================================
// SECTION 1: EVENT TYPES
// ============================================================================

/** Categories of telemetry events. */
export type EventCategory =
  | 'ui'        // Config UI interaction events
  | 'build'     // Build pipeline events
  | 'feature'   // Feature usage events
  | 'error'     // Error/crash events
  | 'session';  // Session metadata

/** A single telemetry event. */
export interface TelemetryEvent {
  /** Random per-session ID (not tied to user identity). */
  readonly sessionId: string;
  /** Event category. */
  readonly category: EventCategory;
  /** Specific event name (e.g., 'wizard_step_completed', 'build_step_failed'). */
  readonly event: string;
  /** Event-specific data (anonymized — no PII, no file contents). */
  readonly data?: Readonly<Record<string, unknown>>;
  /** ISO timestamp. */
  readonly timestamp: string;
  /** DSB version. */
  readonly dsbVersion: string;
}

// ============================================================================
// SECTION 2: SESSION ID
// ============================================================================

/**
 * Generate a random session ID for telemetry.
 *
 * UUID v4 format — not derived from any user information.
 * Generated once per MCP server session.
 */
export function generateTelemetrySessionId(): string {
  return crypto.randomUUID();
}

// ============================================================================
// SECTION 3: EVENT FACTORIES
// ============================================================================

/**
 * Create a UI interaction event.
 *
 * @param sessionId - Telemetry session ID.
 * @param event - Event name (e.g., 'wizard_step_completed').
 * @param data - Anonymized interaction data.
 * @param dsbVersion - DSB version string.
 */
export function uiEvent(
  sessionId: string,
  event: string,
  data: Record<string, unknown>,
  dsbVersion: string
): TelemetryEvent {
  return {
    sessionId,
    category: 'ui',
    event,
    data,
    timestamp: new Date().toISOString(),
    dsbVersion,
  };
}

/**
 * Create a build pipeline event.
 */
export function buildEvent(
  sessionId: string,
  event: string,
  data: Record<string, unknown>,
  dsbVersion: string
): TelemetryEvent {
  return {
    sessionId,
    category: 'build',
    event,
    data,
    timestamp: new Date().toISOString(),
    dsbVersion,
  };
}

/**
 * Create an error event.
 */
export function errorEvent(
  sessionId: string,
  event: string,
  data: Record<string, unknown>,
  dsbVersion: string
): TelemetryEvent {
  return {
    sessionId,
    category: 'error',
    event,
    data,
    timestamp: new Date().toISOString(),
    dsbVersion,
  };
}

/**
 * Create a session metadata event (sent once per session).
 */
export function sessionEvent(
  sessionId: string,
  data: {
    nodeVersion: string;
    os: string;
    dsbVersion: string;
    figmaPlan?: string;
  }
): TelemetryEvent {
  return {
    sessionId,
    category: 'session',
    event: 'session_start',
    data,
    timestamp: new Date().toISOString(),
    dsbVersion: data.dsbVersion,
  };
}
