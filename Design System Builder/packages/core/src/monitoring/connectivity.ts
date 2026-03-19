/**
 * Connectivity — Internet connection checks for DSB operations.
 *
 * Verified before: license validation, update checks, telemetry flushes,
 * and build start. Uses DNS resolution + HTTPS request to the DSB
 * health endpoint.
 *
 * @module core/monitoring/connectivity
 */

import * as dns from 'node:dns';
import * as https from 'node:https';
import { Result } from '@dsb/guardrails';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export type ConnectivityStatus = 'online' | 'unstable' | 'offline';

export interface ConnectivityResult {
  /** Overall connectivity status. */
  readonly status: ConnectivityStatus;
  /** Whether DNS resolution succeeded. */
  readonly dnsOk: boolean;
  /** Whether HTTPS request succeeded. */
  readonly httpsOk: boolean;
  /** Response time in ms (HTTPS request). -1 if failed. */
  readonly latencyMs: number;
  /** Human-readable message for Claude to relay. */
  readonly message: string;
}

// ============================================================================
// SECTION 2: CHECKS
// ============================================================================

/** Threshold for "unstable" classification in ms. */
const LATENCY_THRESHOLD_MS = 5000;

/** DNS hosts to check (one must resolve). */
const DNS_HOSTS = ['api.figma.com', 'api.gumroad.com'] as const;

/**
 * Check DNS resolution.
 *
 * Tries to resolve known hosts. If at least one resolves, DNS is working.
 */
export function checkDns(): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;
    let remaining = DNS_HOSTS.length;

    for (const host of DNS_HOSTS) {
      dns.resolve(host, (err) => {
        remaining--;
        if (!err && !resolved) {
          resolved = true;
          resolve(true);
        }
        if (remaining === 0 && !resolved) {
          resolve(false);
        }
      });
    }

    // Timeout after 5 seconds
    setTimeout(() => {
      if (!resolved) resolve(false);
    }, 5000);
  });
}

/**
 * Check HTTPS connectivity by making a lightweight request.
 *
 * Returns latency in ms, or -1 if the request fails.
 *
 * @param url - The HTTPS URL to check (e.g., health endpoint).
 * @param timeoutMs - Request timeout in ms (default: 5000).
 */
export function checkHttps(
  url: string,
  timeoutMs: number = 5000
): Promise<{ ok: boolean; latencyMs: number }> {
  return new Promise((resolve) => {
    const start = Date.now();

    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      // Consume response to free socket
      res.resume();
      const latencyMs = Date.now() - start;
      resolve({ ok: res.statusCode !== undefined && res.statusCode < 500, latencyMs });
    });

    req.on('error', () => {
      resolve({ ok: false, latencyMs: -1 });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, latencyMs: -1 });
    });
  });
}

/**
 * Run a full connectivity check.
 *
 * Combines DNS resolution and HTTPS request to classify
 * connectivity as online, unstable, or offline.
 *
 * @param healthUrl - HTTPS health endpoint to ping.
 */
export async function checkConnectivity(
  healthUrl: string = 'https://api.gumroad.com'
): Promise<ConnectivityResult> {
  const [dnsOk, httpsResult] = await Promise.all([
    checkDns(),
    checkHttps(healthUrl),
  ]);

  const { ok: httpsOk, latencyMs } = httpsResult;

  // Classify
  if (!dnsOk && !httpsOk) {
    return {
      status: 'offline',
      dnsOk,
      httpsOk,
      latencyMs,
      message: 'Stable internet connection required. Please connect and try again.',
    };
  }

  if (httpsOk && latencyMs > LATENCY_THRESHOLD_MS) {
    return {
      status: 'unstable',
      dnsOk,
      httpsOk,
      latencyMs,
      message: `Connection unstable (${latencyMs}ms latency). Build may fail. Continue anyway?`,
    };
  }

  if (!httpsOk) {
    return {
      status: 'unstable',
      dnsOk,
      httpsOk,
      latencyMs,
      message: 'DNS resolves but HTTPS request failed. Connection may be restricted.',
    };
  }

  return {
    status: 'online',
    dnsOk,
    httpsOk,
    latencyMs,
    message: `Connected (${latencyMs}ms).`,
  };
}
