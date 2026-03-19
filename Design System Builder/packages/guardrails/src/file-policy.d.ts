/**
 * File Policy — Determines which files are allowed/blocked based on extension and content.
 *
 * Enforces file type restrictions for workspace/context/ input and
 * prevents accidental processing of secrets, executables, or archives.
 *
 * @module file-policy
 */
import { Result } from './result';
export type FilePolicyVerdict = 'allowed' | 'blocked' | 'warning';
export interface FilePolicyResult {
    readonly verdict: FilePolicyVerdict;
    readonly reason: string;
    readonly extension: string;
    readonly sizeBytes: number;
}
/**
 * Check if a file is allowed to be processed based on its extension and size.
 *
 * @param filePath - Absolute path to the file (already validated by path-validator).
 * @returns The policy verdict with reason.
 */
export declare function checkFilePolicy(filePath: string): Result<FilePolicyResult, string>;
/**
 * Check if the total size of a directory is within limits.
 *
 * @param dirPath - Absolute path to the directory.
 * @param maxSize - Maximum allowed total size in bytes.
 */
export declare function checkDirectorySize(dirPath: string, maxSize?: number): Result<number, string>;
//# sourceMappingURL=file-policy.d.ts.map