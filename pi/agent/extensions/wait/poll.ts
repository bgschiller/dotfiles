import { setTimeout as delay } from 'node:timers/promises';

type State = 'pending' | 'success' | 'failure' | 'error' | 'superseded';
export type Check = { state: State; summary: string; url?: string };
type CommandResult = { stdout: string; stderr: string; code: number; killed: boolean };
export type Outcome = Check | { state: 'expired'; summary: string };

export function parseCheck(result: CommandResult): Check {
  if (result.killed || result.code !== 0) {
    throw new Error(`Check exited ${result.code}${result.killed ? ' (killed)' : ''}: ${result.stderr.slice(-2000)}`);
  }
  if (result.stdout.length > 16384) throw new Error('Check output exceeds 16 KiB');
  const value: unknown = JSON.parse(result.stdout);
  if (!value || typeof value !== 'object' || !('state' in value) ||
      !('summary' in value) || typeof value.summary !== 'string' ||
      value.summary.length > 4000 ||
      !['pending', 'success', 'failure', 'error', 'superseded'].includes(String(value.state))) {
    throw new Error('Expected JSON with state and summary (at most 4000 characters)');
  }
  if ('url' in value && (typeof value.url !== 'string' || value.url.length > 2000)) {
    throw new Error('url must be a string of at most 2000 characters');
  }
  return { state: value.state as State, summary: value.summary,
    ...('url' in value ? { url: value.url as string } : {}) };
}

export async function poll(
  options: { intervalMs: number; deadlineMs: number },
  execute: (signal: AbortSignal, timeoutMs: number) => Promise<CommandResult>,
  signal?: AbortSignal,
  update?: (check: Check) => void,
): Promise<Outcome> {
  const deadline = Date.now() + options.deadlineMs;
  const deadlineSignal = AbortSignal.timeout(options.deadlineMs);
  const combined = AbortSignal.any([deadlineSignal, ...(signal ? [signal] : [])]);
  let errors = 0;
  let last = 'No successful check yet';
  while (true) {
    signal?.throwIfAborted();
    if (Date.now() >= deadline) return { state: 'expired', summary: last };
    let check: Check;
    try {
      check = parseCheck(await execute(combined, Math.max(1, Math.min(60000, deadline - Date.now()))));
    } catch (error) {
      check = { state: 'error', summary: String(error).slice(-4000) };
    }
    signal?.throwIfAborted();
    if (deadlineSignal.aborted || Date.now() >= deadline) return { state: 'expired', summary: last };
    last = check.summary;
    update?.(check);
    if (check.state === 'error') {
      if (++errors >= 3) return check;
    } else {
      errors = 0;
      if (check.state !== 'pending') return check;
    }
    try {
      await delay(Math.min(options.intervalMs, Math.max(1, deadline - Date.now())), undefined, { signal: combined });
    } catch (error) {
      signal?.throwIfAborted();
      if (deadlineSignal.aborted) return { state: 'expired', summary: last };
      throw error;
    }
  }
}
