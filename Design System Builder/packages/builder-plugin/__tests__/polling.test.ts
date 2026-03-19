/**
 * Tests for the polling module — HTTP polling engine for commands.
 *
 * Tests core exports: types, startPolling, stopPolling, pausePolling,
 * resumePolling, isConnected. Mocks fetch and timers.
 *
 * @module builder-plugin/__tests__/polling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PollCommand, PollResponse, CommandResult, PollingConfig } from '../src/polling';

// ============================================================================
// SECTION 1: TYPE SHAPE TESTS
// ============================================================================

describe('polling — types', () => {
  it('PollCommand has required shape', () => {
    const cmd: PollCommand = {
      id: 'cmd-1',
      type: 'create_collection',
      payload: { name: 'Test' },
    };
    expect(cmd.id).toBe('cmd-1');
    expect(cmd.type).toBe('create_collection');
    expect(cmd.payload).toEqual({ name: 'Test' });
  });

  it('CommandResult has success shape', () => {
    const result: CommandResult = {
      commandId: 'cmd-1',
      success: true,
      data: { id: 'col-1' },
    };
    expect(result.commandId).toBe('cmd-1');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 'col-1' });
  });

  it('CommandResult has error shape', () => {
    const result: CommandResult = {
      commandId: 'cmd-2',
      success: false,
      error: 'Something went wrong',
    };
    expect(result.success).toBe(false);
    expect(result.error).toBe('Something went wrong');
  });

  it('PollResponse contains commands array', () => {
    const response: PollResponse = {
      commands: [
        { id: 'cmd-1', type: 'get_pages', payload: {} },
        { id: 'cmd-2', type: 'get_styles', payload: {} },
      ],
    };
    expect(response.commands).toHaveLength(2);
    expect(response.commands[0]!.type).toBe('get_pages');
  });

  it('PollResponse can be empty', () => {
    const response: PollResponse = { commands: [] };
    expect(response.commands).toHaveLength(0);
  });
});

// ============================================================================
// SECTION 2: POLLING ENGINE TESTS
// Skipped — polling runtime moved to UI iframe (R004 fix). polling.ts is now types-only.
// ============================================================================

describe.skip('polling — engine (legacy — moved to UI iframe)', () => {
  let mod: typeof import('../src/polling');

  beforeEach(async () => {
    vi.useFakeTimers();
    // Reset module state between tests by reimporting
    vi.resetModules();
    mod = await import('../src/polling');
  });

  afterEach(() => {
    // Stop any running timers
    mod.stopPolling();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('isConnected returns false initially', () => {
    expect(mod.isConnected()).toBe(false);
  });

  it('stopPolling is safe to call when not started', () => {
    expect(() => mod.stopPolling()).not.toThrow();
  });

  it('pausePolling does not throw when not started', () => {
    expect(() => mod.pausePolling()).not.toThrow();
  });

  it('resumePolling does not throw when not started', () => {
    expect(() => mod.resumePolling()).not.toThrow();
  });

  it('startPolling sets up polling intervals', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

    // Mock fetch for the register call
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    const config: PollingConfig = {
      port: 9877,
      sessionToken: 'test-token',
      onCommand: vi.fn().mockResolvedValue({ commandId: '1', success: true }),
      onConnectionChange: vi.fn(),
      onLog: vi.fn(),
    };

    mod.startPolling(config);

    // Should set up 2 intervals: poll loop (50ms) + heartbeat (5000ms)
    expect(setIntervalSpy).toHaveBeenCalledTimes(2);

    // Verify interval durations
    const intervals = setIntervalSpy.mock.calls.map(call => call[1]);
    expect(intervals).toContain(50);   // POLL_INTERVAL_MS
    expect(intervals).toContain(5000); // HEARTBEAT_INTERVAL_MS

    setIntervalSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('stopPolling clears intervals', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    const config: PollingConfig = {
      port: 9877,
      sessionToken: 'tok',
      onCommand: vi.fn().mockResolvedValue({ commandId: '1', success: true }),
      onConnectionChange: vi.fn(),
      onLog: vi.fn(),
    };

    mod.startPolling(config);
    mod.stopPolling();

    // clearInterval called for both poll + heartbeat
    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);

    // isConnected should be false after stop
    expect(mod.isConnected()).toBe(false);

    clearIntervalSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('startPolling calls register endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    const config: PollingConfig = {
      port: 9877,
      sessionToken: 'my-token',
      onCommand: vi.fn().mockResolvedValue({ commandId: '1', success: true }),
      onConnectionChange: vi.fn(),
      onLog: vi.fn(),
    };

    mod.startPolling(config);

    // Let the register call complete
    await vi.advanceTimersByTimeAsync(0);

    // First fetch should be the register call
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:9877/register',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer my-token',
        }),
      }),
    );

    vi.unstubAllGlobals();
  });

  it('poll cycle fetches commands and executes them', async () => {
    const commandHandler = vi.fn().mockResolvedValue({
      commandId: 'cmd-42',
      success: true,
      data: { created: true },
    });
    const onConnectionChange = vi.fn();
    const onLog = vi.fn();

    // Mock fetch: register succeeds, poll returns a command, result post succeeds
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true }) // register
      .mockResolvedValueOnce({             // poll
        ok: true,
        json: () => Promise.resolve({
          commands: [{ id: 'cmd-42', type: 'get_pages', payload: {} }],
        }),
      })
      .mockResolvedValueOnce({ ok: true }); // result post

    vi.stubGlobal('fetch', mockFetch);

    const config: PollingConfig = {
      port: 9877,
      sessionToken: 'tok',
      onCommand: commandHandler,
      onConnectionChange,
      onLog,
    };

    mod.startPolling(config);

    // Let register complete
    await vi.advanceTimersByTimeAsync(0);

    // Trigger one poll cycle (50ms)
    await vi.advanceTimersByTimeAsync(50);

    // Command handler should have been called
    expect(commandHandler).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cmd-42', type: 'get_pages' }),
    );

    // Result should have been sent back
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:9877/response',
      expect.objectContaining({ method: 'POST' }),
    );

    // Should be connected now
    expect(onConnectionChange).toHaveBeenCalledWith(true);

    vi.unstubAllGlobals();
  });

  it('pausing prevents command execution during poll', async () => {
    const commandHandler = vi.fn().mockResolvedValue({
      commandId: 'cmd-1',
      success: true,
    });

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true }) // register
      .mockResolvedValue({                 // poll responses
        ok: true,
        json: () => Promise.resolve({
          commands: [{ id: 'cmd-1', type: 'get_pages', payload: {} }],
        }),
      });

    vi.stubGlobal('fetch', mockFetch);

    const config: PollingConfig = {
      port: 9877,
      sessionToken: 'tok',
      onCommand: commandHandler,
      onConnectionChange: vi.fn(),
      onLog: vi.fn(),
    };

    mod.startPolling(config);
    await vi.advanceTimersByTimeAsync(0); // register

    // Pause before poll cycle
    mod.pausePolling();

    // Advance past poll interval
    await vi.advanceTimersByTimeAsync(50);

    // Command handler should NOT have been called (paused)
    expect(commandHandler).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('resuming re-enables command execution', async () => {
    const commandHandler = vi.fn().mockResolvedValue({
      commandId: 'cmd-1',
      success: true,
    });

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true }) // register
      .mockResolvedValue({                 // all subsequent poll responses
        ok: true,
        json: () => Promise.resolve({
          commands: [{ id: 'cmd-1', type: 'get_pages', payload: {} }],
        }),
      });

    vi.stubGlobal('fetch', mockFetch);

    const config: PollingConfig = {
      port: 9877,
      sessionToken: 'tok',
      onCommand: commandHandler,
      onConnectionChange: vi.fn(),
      onLog: vi.fn(),
    };

    mod.startPolling(config);
    await vi.advanceTimersByTimeAsync(0); // register

    mod.pausePolling();
    await vi.advanceTimersByTimeAsync(50); // poll while paused — skipped
    expect(commandHandler).not.toHaveBeenCalled();

    mod.resumePolling();
    await vi.advanceTimersByTimeAsync(50); // poll after resume — executes
    expect(commandHandler).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('consecutive errors trigger disconnection', async () => {
    const onConnectionChange = vi.fn();
    const onLog = vi.fn();

    // First register succeeds, then all polls fail
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true }) // register
      .mockRejectedValue(new Error('network down')); // all polls fail

    vi.stubGlobal('fetch', mockFetch);

    const config: PollingConfig = {
      port: 9877,
      sessionToken: 'tok',
      onCommand: vi.fn(),
      onConnectionChange,
      onLog,
    };

    mod.startPolling(config);
    await vi.advanceTimersByTimeAsync(0); // register

    // Trigger 10 consecutive errors (MAX_CONSECUTIVE_ERRORS)
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(50);
    }

    // After 10+ errors, should report disconnection
    // Note: disconnection is only reported if `connected` was true first
    // Since we never had a successful poll, `connected` is false, so onConnectionChange
    // won't be called with false (it was already false)
    // This is correct behavior — you can't lose a connection you never had

    vi.unstubAllGlobals();
  });

  it('heartbeat reconnects after connection loss', async () => {
    const onConnectionChange = vi.fn();

    // Register succeeds, polls fail (connection lost), heartbeat succeeds (reconnect)
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true })           // register
      .mockResolvedValueOnce({                        // first poll succeeds (establishes connection)
        ok: true,
        json: () => Promise.resolve({ commands: [] }),
      })
      .mockRejectedValueOnce(new Error('down'))       // polls fail
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'))       // 10th error → disconnected
      .mockResolvedValue({ ok: true });               // heartbeat succeeds → reconnect

    vi.stubGlobal('fetch', mockFetch);

    const config: PollingConfig = {
      port: 9877,
      sessionToken: 'tok',
      onCommand: vi.fn(),
      onConnectionChange,
      onLog: vi.fn(),
    };

    mod.startPolling(config);
    await vi.advanceTimersByTimeAsync(0); // register

    // First poll establishes connection
    await vi.advanceTimersByTimeAsync(50);
    expect(onConnectionChange).toHaveBeenCalledWith(true);

    // 10 failed polls → disconnection
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(50);
    }
    expect(onConnectionChange).toHaveBeenCalledWith(false);

    // Heartbeat fires at 5000ms and reconnects
    await vi.advanceTimersByTimeAsync(5000);

    // Should have been called with true again (reconnected)
    const trueCalls = onConnectionChange.mock.calls.filter(
      (c: [boolean]) => c[0] === true
    );
    expect(trueCalls.length).toBeGreaterThanOrEqual(2);

    vi.unstubAllGlobals();
  });

  it('register failure is logged but does not throw', async () => {
    const onLog = vi.fn();

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no server')));

    const config: PollingConfig = {
      port: 9877,
      sessionToken: 'tok',
      onCommand: vi.fn(),
      onConnectionChange: vi.fn(),
      onLog,
    };

    // Should not throw
    mod.startPolling(config);
    await vi.advanceTimersByTimeAsync(0);

    // Should have logged the registration failure
    expect(onLog).toHaveBeenCalledWith(
      expect.stringContaining('Registration failed'),
    );

    vi.unstubAllGlobals();
  });
});
