import { describe, it, expect, beforeEach } from 'vitest';
import { CommandQueue } from '../src/command-queue';
import type { QueuedCommand, CommandResult } from '../src/command-queue';

function makeCommand(overrides?: Partial<QueuedCommand>): QueuedCommand {
  return {
    id: 'cmd-' + Math.random().toString(36).slice(2, 8),
    type: 'test_command',
    payload: {},
    enqueuedAt: Date.now(),
    ...overrides,
  };
}

describe('CommandQueue', () => {
  let queue: CommandQueue;

  beforeEach(() => {
    queue = new CommandQueue({ commandTimeoutMs: 2000 });
  });

  describe('enqueue and dequeue', () => {
    it('dequeues commands in FIFO order', () => {
      const cmd1 = makeCommand({ id: 'first' });
      const cmd2 = makeCommand({ id: 'second' });

      queue.enqueueAsync(cmd1);
      queue.enqueueAsync(cmd2);

      const batch = queue.dequeue(10);
      expect(batch).toHaveLength(2);
      expect(batch[0].id).toBe('first');
      expect(batch[1].id).toBe('second');
    });

    it('dequeue respects maxCount limit', () => {
      queue.enqueueAsync(makeCommand());
      queue.enqueueAsync(makeCommand());
      queue.enqueueAsync(makeCommand());

      const batch = queue.dequeue(2);
      expect(batch).toHaveLength(2);

      // One still pending
      const stats = queue.getStats();
      expect(stats.pending).toBe(1);
      expect(stats.processing).toBe(2);
    });

    it('returns empty array when no pending commands', () => {
      const batch = queue.dequeue(10);
      expect(batch).toHaveLength(0);
    });
  });

  describe('enqueue with result waiting', () => {
    it('resolves when result is provided', async () => {
      const cmd = makeCommand({ id: 'wait-cmd' });

      // Start waiting in background
      const resultPromise = queue.enqueue(cmd);

      // Simulate plugin processing
      const dequeued = queue.dequeue(10);
      expect(dequeued).toHaveLength(1);

      queue.resolve({
        commandId: 'wait-cmd',
        success: true,
        data: { value: 42 },
        completedAt: Date.now(),
      });

      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ value: 42 });
    });

    it('times out if no result arrives', async () => {
      const shortQueue = new CommandQueue({ commandTimeoutMs: 100 });
      const cmd = makeCommand({ id: 'timeout-cmd' });

      const result = await shortQueue.enqueue(cmd);
      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });
  });

  describe('resolve', () => {
    it('stores results in history', () => {
      const cmd = makeCommand({ id: 'hist-cmd' });
      queue.enqueueAsync(cmd);
      queue.dequeue(1);

      queue.resolve({
        commandId: 'hist-cmd',
        success: true,
        completedAt: Date.now(),
      });

      const result = queue.getResult('hist-cmd');
      expect(result).toBeDefined();
      expect(result!.success).toBe(true);
    });

    it('evicts old results when exceeding maxResultHistory', () => {
      const smallQueue = new CommandQueue({ maxResultHistory: 3 });

      for (let i = 0; i < 5; i++) {
        const cmd = makeCommand({ id: `evict-${i}` });
        smallQueue.enqueueAsync(cmd);
        smallQueue.dequeue(1);
        smallQueue.resolve({
          commandId: `evict-${i}`,
          success: true,
          completedAt: Date.now(),
        });
      }

      // First two should be evicted
      expect(smallQueue.getResult('evict-0')).toBeUndefined();
      expect(smallQueue.getResult('evict-1')).toBeUndefined();
      // Last three should still be there
      expect(smallQueue.getResult('evict-2')).toBeDefined();
      expect(smallQueue.getResult('evict-3')).toBeDefined();
      expect(smallQueue.getResult('evict-4')).toBeDefined();
    });
  });

  describe('stats', () => {
    it('tracks queue statistics correctly', () => {
      queue.enqueueAsync(makeCommand({ id: 'a' }));
      queue.enqueueAsync(makeCommand({ id: 'b' }));
      queue.enqueueAsync(makeCommand({ id: 'c' }));

      let stats = queue.getStats();
      expect(stats.pending).toBe(3);
      expect(stats.totalEnqueued).toBe(3);

      queue.dequeue(2);

      stats = queue.getStats();
      expect(stats.pending).toBe(1);
      expect(stats.processing).toBe(2);

      queue.resolve({ commandId: 'a', success: true, completedAt: Date.now() });
      queue.resolve({ commandId: 'b', success: false, error: 'fail', completedAt: Date.now() });

      stats = queue.getStats();
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.processing).toBe(0);
    });
  });

  describe('clearPending', () => {
    it('clears only pending commands', () => {
      queue.enqueueAsync(makeCommand({ id: 'pending1' }));
      queue.enqueueAsync(makeCommand({ id: 'pending2' }));
      queue.dequeue(1); // Moves first to processing

      const cleared = queue.clearPending();
      expect(cleared).toBe(1); // Only pending2 was cleared

      const stats = queue.getStats();
      expect(stats.pending).toBe(0);
      expect(stats.processing).toBe(1); // pending1 still processing
    });
  });

  describe('hasWork', () => {
    it('returns false for empty queue', () => {
      expect(queue.hasWork()).toBe(false);
    });

    it('returns true with pending commands', () => {
      queue.enqueueAsync(makeCommand());
      expect(queue.hasWork()).toBe(true);
    });

    it('returns true with processing commands', () => {
      queue.enqueueAsync(makeCommand());
      queue.dequeue(1);
      expect(queue.hasWork()).toBe(true);
    });
  });

  describe('reset', () => {
    it('clears all state and rejects waiters', async () => {
      const cmd = makeCommand({ id: 'reset-cmd' });
      const resultPromise = queue.enqueue(cmd);

      queue.reset();

      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('reset');

      const stats = queue.getStats();
      expect(stats.pending).toBe(0);
      expect(stats.processing).toBe(0);
      expect(stats.totalEnqueued).toBe(0);
    });
  });
});
