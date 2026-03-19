/**
 * Polling types — shared between code.ts and ui.html.
 *
 * All HTTP networking is handled by the UI iframe (ui.html).
 * The plugin sandbox (QuickJS) has no fetch() — these types
 * define the command/result contract only.
 *
 * @module builder-plugin/polling
 */

export interface PollCommand {
  readonly id: string;
  readonly type: string;
  readonly payload: Record<string, unknown>;
}

export interface PollResponse {
  readonly commands: PollCommand[];
}

export interface CommandResult {
  readonly commandId: string;
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: string;
}
