/**
 * Nuclear Wipe — Level 4 tamper response. Removes entire DSB installation.
 *
 * PRESERVES (user's property, never touched):
 *   - workspace/context/   (user's input files)
 *   - workspace/exports/   (user's exported work)
 *   - WIPED.md             (explanation file, created after wipe)
 *
 * DESTROYS (DSB intellectual property):
 *   - packages/            (all code)
 *   - agents/              (all prompts)
 *   - templates/           (all presets)
 *   - installer/           (setup scripts)
 *   - .claude/             (CLAUDE.md)
 *   - docs/                (documentation)
 *   - workspace/specs/     (generated specs)
 *   - workspace/reports/   (QA reports)
 *   - workspace/temp/      (temporary files)
 *   - node_modules/        (dependencies)
 *   - Root config files    (package.json, tsconfig.*, turbo.json, .env)
 *
 * @module nuclear-wipe
 */
import type { CopyDetectionReason } from './copy-detector';
export interface WipeLogEntry {
    readonly timestamp: string;
    readonly reason: CopyDetectionReason;
    readonly detectedPath: string;
    readonly registeredPath: string;
    readonly machineFingerprint: string;
}
/**
 * Execute nuclear wipe — removes DSB installation while preserving user data.
 *
 * WARNING: This permanently deletes all DSB code from the installation folder.
 * Only workspace/context/ and workspace/exports/ survive.
 *
 * @param reason - Why the wipe was triggered.
 * @param registeredPath - The expected installation path.
 * @param machineFingerprint - The machine fingerprint for logging.
 */
export declare function executeNuclearWipe(reason: CopyDetectionReason, registeredPath: string, machineFingerprint: string): void;
//# sourceMappingURL=nuclear-wipe.d.ts.map