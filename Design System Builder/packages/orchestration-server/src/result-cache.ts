/**
 * Result Cache — TTL + size-aware cache for command results.
 *
 * Problem: deep_extract results can be 5-10MB. The CommandQueue's results
 * Map caps at 1000 entries by count but is blind to data size. A few
 * giant extraction payloads can consume hundreds of MB if the user
 * leaves work midway.
 *
 * Solution:
 *   - TTL eviction: large results (>100KB) expire after 30 minutes
 *   - Small results expire after 2 hours (for debugging/audit trail)
 *   - Byte budget: total cached data capped at 50MB
 *   - Periodic sweep every 60 seconds cleans expired entries
 *
 * @module orchestration-server/result-cache
 */

import type { CommandResult } from './command-queue';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

interface CachedEntry {
  readonly result: CommandResult;
  readonly cachedAt: number;
  readonly sizeBytes: number;
  readonly ttlMs: number;
}

export interface ResultCacheConfig {
  /** TTL for large results (>sizeThreshold). Default: 30 minutes. */
  readonly largeTtlMs?: number;
  /** TTL for small results. Default: 2 hours. */
  readonly smallTtlMs?: number;
  /** Size threshold in bytes. Results above this use largeTtlMs. Default: 100KB. */
  readonly sizeThresholdBytes?: number;
  /** Maximum total cached bytes. Default: 50MB. */
  readonly maxTotalBytes?: number;
  /** Sweep interval in ms. Default: 60 seconds. */
  readonly sweepIntervalMs?: number;
}

export interface CacheStats {
  readonly entries: number;
  readonly totalBytes: number;
  readonly largeEntries: number;
  readonly oldestEntryAge: number | null;
}

// ============================================================================
// SECTION 2: RESULT CACHE
// ============================================================================

export class ResultCache {
  private readonly entries = new Map<string, CachedEntry>();
  private totalBytes = 0;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  private readonly largeTtlMs: number;
  private readonly smallTtlMs: number;
  private readonly sizeThresholdBytes: number;
  private readonly maxTotalBytes: number;

  constructor(config?: ResultCacheConfig) {
    this.largeTtlMs = config?.largeTtlMs ?? 30 * 60 * 1000;       // 30 min
    this.smallTtlMs = config?.smallTtlMs ?? 2 * 60 * 60 * 1000;    // 2 hours
    this.sizeThresholdBytes = config?.sizeThresholdBytes ?? 100_000; // 100KB
    this.maxTotalBytes = config?.maxTotalBytes ?? 50 * 1024 * 1024;  // 50MB

    const sweepMs = config?.sweepIntervalMs ?? 60_000;
    this.sweepTimer = setInterval(() => this.sweep(), sweepMs);
    // Don't block process exit
    if (this.sweepTimer && typeof this.sweepTimer === 'object' && 'unref' in this.sweepTimer) {
      this.sweepTimer.unref();
    }
  }

  /** Store a command result. Evicts over-budget entries if needed. */
  set(commandId: string, result: CommandResult): void {
    this.delete(commandId);

    const sizeBytes = estimateSize(result);
    const isLarge = sizeBytes > this.sizeThresholdBytes;
    const ttlMs = isLarge ? this.largeTtlMs : this.smallTtlMs;

    const entry: CachedEntry = { result, cachedAt: Date.now(), sizeBytes, ttlMs };
    this.entries.set(commandId, entry);
    this.totalBytes += sizeBytes;

    this.evictOverBudget();
  }

  /** Get a cached result (returns undefined if expired or missing). */
  get(commandId: string): CommandResult | undefined {
    const entry = this.entries.get(commandId);
    if (!entry) return undefined;

    if (Date.now() - entry.cachedAt > entry.ttlMs) {
      this.delete(commandId);
      return undefined;
    }
    return entry.result;
  }

  /** Delete a specific entry. */
  delete(commandId: string): boolean {
    const entry = this.entries.get(commandId);
    if (!entry) return false;
    this.totalBytes -= entry.sizeBytes;
    this.entries.delete(commandId);
    return true;
  }

  /** Get cache statistics. */
  getStats(): CacheStats {
    let largeEntries = 0;
    let oldestAge: number | null = null;
    const now = Date.now();

    for (const entry of this.entries.values()) {
      if (entry.sizeBytes > this.sizeThresholdBytes) largeEntries++;
      const age = now - entry.cachedAt;
      if (oldestAge === null || age > oldestAge) oldestAge = age;
    }

    return { entries: this.entries.size, totalBytes: this.totalBytes, largeEntries, oldestEntryAge: oldestAge };
  }

  /** Clear all entries. */
  clear(): void {
    this.entries.clear();
    this.totalBytes = 0;
  }

  /** Stop the sweep timer. Call on server shutdown. */
  destroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    this.clear();
  }

  /** Remove expired entries. */
  private sweep(): void {
    const now = Date.now();
    for (const [id, entry] of this.entries) {
      if (now - entry.cachedAt > entry.ttlMs) {
        this.totalBytes -= entry.sizeBytes;
        this.entries.delete(id);
      }
    }
  }

  /** Evict oldest large entries first until under byte budget. */
  private evictOverBudget(): void {
    if (this.totalBytes <= this.maxTotalBytes) return;

    const sorted = [...this.entries.entries()]
      .sort((a, b) => b[1].sizeBytes - a[1].sizeBytes);

    for (const [id, entry] of sorted) {
      if (this.totalBytes <= this.maxTotalBytes) break;
      this.totalBytes -= entry.sizeBytes;
      this.entries.delete(id);
    }
  }
}

// ============================================================================
// SECTION 3: HELPERS
// ============================================================================

/** Estimate JSON byte size of a result (fast approximation). */
function estimateSize(result: CommandResult): number {
  try {
    const str = JSON.stringify(result.data ?? '');
    return str.length * 2; // UTF-16 rough upper bound
  } catch {
    return 1024;
  }
}
