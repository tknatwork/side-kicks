/**
 * Write governor — adaptive rate limiter + circuit breaker
 * for pipeline writes to the Figma plugin via bridge client.
 *
 * Sits between pipeline tools and bridge-client.ts.
 * Controls throughput, verifies dependencies, and breaks
 * the circuit on consecutive failures.
 *
 * @module pipeline/write-governor
 */

import type { BridgeClient } from '../bridge-client';
import type {
  GovernorCommand,
  BatchPlan,
  BatchResult,
  GovernorResult,
  CommandGroup,
} from './types';

/** Command group execution order. */
const GROUP_ORDER: readonly CommandGroup[] = [
  'variable-additions',
  'node-additions',
  'property-changes',
  'node-deletions',
  'variable-deletions',
];

/** Governor configuration with adaptive defaults. */
interface GovernorConfig {
  initialBatchSize: number;
  maxBatchSize: number;
  minBatchSize: number;
  batchDelayMs: number;
  circuitBreakerThreshold: number;
  circuitBreakerCooldownMs: number;
}

const DEFAULT_CONFIG: GovernorConfig = {
  initialBatchSize: 5,
  maxBatchSize: 10,
  minBatchSize: 1,
  batchDelayMs: 200,
  circuitBreakerThreshold: 3,
  circuitBreakerCooldownMs: 5000,
};

export class WriteGovernor {
  private readonly bridge: BridgeClient;
  private readonly config: GovernorConfig;
  private batchSize: number;
  private consecutiveFailures = 0;
  private circuitBroken = false;

  constructor(bridge: BridgeClient, config?: Partial<GovernorConfig>) {
    this.bridge = bridge;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.batchSize = this.config.initialBatchSize;
  }

  /** Adapt batch size based on last batch response time. */
  private adaptBatchSize(durationMs: number): void {
    if (durationMs < 1000) {
      this.batchSize = Math.min(this.batchSize + 1, this.config.maxBatchSize);
    } else if (durationMs > 10000) {
      this.batchSize = this.config.minBatchSize;
    } else if (durationMs > 5000) {
      this.batchSize = Math.max(Math.floor(this.batchSize / 2), this.config.minBatchSize);
    }
  }

  /** Check circuit breaker and attempt recovery if tripped. */
  private async checkCircuitBreaker(): Promise<boolean> {
    if (!this.circuitBroken) return true;

    await this.delay(this.config.circuitBreakerCooldownMs);
    const status = await this.bridge.getStatus();
    if (status) {
      this.circuitBroken = false;
      this.consecutiveFailures = 0;
      this.batchSize = this.config.minBatchSize;
      return true;
    }
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** Execute a single batch of commands via bridge. */
  private async executeBatch(
    commands: readonly GovernorCommand[],
    batchIndex: number,
    group: CommandGroup,
  ): Promise<BatchResult> {
    const start = Date.now();
    const errors: string[] = [];
    let successCount = 0;

    for (const cmd of commands) {
      try {
        const result = await this.bridge.sendCommand({
          type: cmd.type,
          payload: cmd.payload,
        });
        if (result.success) {
          successCount++;
        } else {
          errors.push(result.error ?? `${cmd.type} failed`);
        }
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }

    const durationMs = Date.now() - start;
    this.adaptBatchSize(durationMs);

    if (errors.length === commands.length) {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.config.circuitBreakerThreshold) {
        this.circuitBroken = true;
      }
    } else {
      this.consecutiveFailures = 0;
    }

    return {
      batchIndex,
      group,
      commandCount: commands.length,
      successCount,
      failureCount: errors.length,
      durationMs,
      errors,
    };
  }

  /** Group commands by ordering group. */
  private groupCommands(
    commands: readonly GovernorCommand[],
  ): Map<CommandGroup, GovernorCommand[]> {
    const groups = new Map<CommandGroup, GovernorCommand[]>();
    for (const cmd of commands) {
      const list = groups.get(cmd.group) ?? [];
      list.push(cmd);
      groups.set(cmd.group, list);
    }
    return groups;
  }

  /** Execute all commands with adaptive batching and circuit breaking. */
  async execute(commands: readonly GovernorCommand[]): Promise<GovernorResult> {
    const startTime = Date.now();
    const grouped = this.groupCommands(commands);
    const allResults: BatchResult[] = [];
    let totalApplied = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let batchIndex = 0;

    for (const group of GROUP_ORDER) {
      const cmds = grouped.get(group);
      if (!cmds?.length) continue;

      for (let i = 0; i < cmds.length; i += this.batchSize) {
        if (this.circuitBroken) {
          const recovered = await this.checkCircuitBreaker();
          if (!recovered) {
            totalSkipped += cmds.length - i;
            break;
          }
        }

        const batch = cmds.slice(i, i + this.batchSize);
        const result = await this.executeBatch(batch, batchIndex++, group);
        allResults.push(result);
        totalApplied += result.successCount;
        totalFailed += result.failureCount;

        if (i + this.batchSize < cmds.length) {
          await this.delay(this.config.batchDelayMs);
        }
      }
    }

    return {
      totalCommands: commands.length,
      totalApplied,
      totalFailed,
      totalSkipped,
      batches: allResults,
      circuitBroken: this.circuitBroken,
      durationMs: Date.now() - startTime,
    };
  }
}
