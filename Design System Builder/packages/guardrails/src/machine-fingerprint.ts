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

import * as os from 'node:os';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Result } from './result';

// ============================================================================
// SECTION 1: PUBLIC API
// ============================================================================

/**
 * Generate a deterministic machine fingerprint.
 *
 * @returns SHA-256 hash of platform ID + username.
 */
export function getMachineFingerprint(): Result<string, string> {
  const platformIdResult = getPlatformId();
  if (!platformIdResult.ok) return platformIdResult;

  const username = os.userInfo().username;
  const combined = `${platformIdResult.value}:${username}`;
  const fingerprint = crypto.createHash('sha256').update(combined).digest('hex');

  return Result.ok(fingerprint);
}

// ============================================================================
// SECTION 2: PLATFORM-SPECIFIC ID RETRIEVAL
// ============================================================================

function getPlatformId(): Result<string, string> {
  const platform = os.platform();

  switch (platform) {
    case 'darwin':
      return getMacOsId();
    case 'win32':
      return getWindowsId();
    case 'linux':
      return getLinuxId();
    default:
      return Result.err(`Unsupported platform: ${platform}. DSB supports macOS, Windows, and Linux.`);
  }
}

/**
 * macOS: Read IOPlatformSerialNumber via ioreg.
 * Uses execFileSync (no shell) to avoid injection risks.
 */
function getMacOsId(): Result<string, string> {
  try {
    // ioreg with fixed arguments — no user input, safe to exec
    const output = execFileSync('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], {
      encoding: 'utf-8',
      timeout: 5000,
    });

    const match = output.match(/"IOPlatformSerialNumber"\s*=\s*"([^"]+)"/);
    if (match && match[1]) {
      return Result.ok(match[1]);
    }

    // Fallback: hardware UUID via system_profiler
    const uuidOutput = execFileSync('system_profiler', ['SPHardwareDataType'], {
      encoding: 'utf-8',
      timeout: 5000,
    });
    const uuidMatch = uuidOutput.match(/Hardware UUID:\s*(.+)/);
    if (uuidMatch && uuidMatch[1]) {
      return Result.ok(uuidMatch[1].trim());
    }

    return Result.err('Could not determine macOS machine ID. Please contact support.');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Result.err(`Failed to read macOS machine ID: ${message}`);
  }
}

/**
 * Windows: Read MachineGuid from registry.
 * Uses execFileSync (no shell) to avoid injection risks.
 */
function getWindowsId(): Result<string, string> {
  try {
    const output = execFileSync(
      'reg',
      ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'],
      { encoding: 'utf-8', timeout: 5000 }
    );

    const match = output.match(/MachineGuid\s+REG_SZ\s+(.+)/);
    if (match && match[1]) {
      return Result.ok(match[1].trim());
    }

    return Result.err('Could not read Windows MachineGuid from registry.');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Result.err(`Failed to read Windows machine ID: ${message}`);
  }
}

/**
 * Linux: Read /etc/machine-id.
 * Pure file read — no process execution needed.
 */
function getLinuxId(): Result<string, string> {
  try {
    // Primary: /etc/machine-id (systemd)
    if (fs.existsSync('/etc/machine-id')) {
      const id = fs.readFileSync('/etc/machine-id', 'utf-8').trim();
      if (id.length > 0) return Result.ok(id);
    }

    // Fallback: /var/lib/dbus/machine-id
    if (fs.existsSync('/var/lib/dbus/machine-id')) {
      const id = fs.readFileSync('/var/lib/dbus/machine-id', 'utf-8').trim();
      if (id.length > 0) return Result.ok(id);
    }

    return Result.err('Could not find /etc/machine-id or /var/lib/dbus/machine-id.');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Result.err(`Failed to read Linux machine ID: ${message}`);
  }
}
