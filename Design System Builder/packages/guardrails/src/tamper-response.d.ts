/**
 * Tamper Response — Escalating response to integrity violations.
 *
 * 4 levels of response:
 *   Level 1 (WARNING):  Single file mismatch, likely corruption → warn + allow read-only
 *   Level 2 (LOCKOUT):  Repeated issues or 24h after L1 → block all write operations
 *   Level 3 (SCRAMBLE): Deliberate bypass detected → overwrite IP with placeholders
 *   Level 4 (NUCLEAR):  Copy/redistribution detected → delete entire installation
 *
 * @module tamper-response
 */
import type { IntegrityCheckResult } from './integrity';
export type TamperLevel = 1 | 2 | 3 | 4;
export interface TamperEvent {
    readonly level: TamperLevel;
    readonly timestamp: string;
    readonly reason: string;
    readonly modifiedFiles: readonly string[];
}
export interface TamperState {
    readonly events: readonly TamperEvent[];
    readonly currentLevel: TamperLevel;
    readonly lockedOut: boolean;
    readonly lastEventAt: string;
}
/**
 * Evaluate an integrity check result and determine the appropriate tamper level.
 *
 * @param checkResult - The result from verifyIntegrity().
 * @returns The tamper level to apply, or null if no tampering detected.
 */
export declare function evaluateTamperLevel(checkResult: IntegrityCheckResult): TamperLevel | null;
/**
 * Record a tamper event and update the persistent state.
 */
export declare function recordTamperEvent(level: TamperLevel, reason: string, modifiedFiles: readonly string[]): TamperState;
/**
 * Check if the system should auto-escalate (24h after Level 1 → Level 2).
 */
export declare function checkAutoEscalation(): TamperLevel | null;
/**
 * Check if the system is currently locked out.
 */
export declare function isLockedOut(): boolean;
/**
 * Get the current tamper level.
 */
export declare function getCurrentTamperLevel(): TamperLevel | null;
/**
 * Execute Level 3 scramble — overwrite intellectual property with placeholders.
 * Preserves workspace/context/ and workspace/exports/ (user data).
 */
export declare function executeScramble(): void;
//# sourceMappingURL=tamper-response.d.ts.map