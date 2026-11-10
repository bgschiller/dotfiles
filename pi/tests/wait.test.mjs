import { test } from 'node:test';
import assert from 'node:assert/strict';
import { poll, parseCheck } from '../agent/extensions/wait/poll.ts';

const options = { command: 'check', intervalMs: 1, deadlineMs: 1000 };
const result = (state) => ({ stdout: JSON.stringify({ state, summary: state }), stderr: '', code: 0, killed: false });

test('validates the command protocol', () => {
  assert.equal(parseCheck(result('superseded')).state, 'superseded');
  for (const value of ['garbage', '{}', '{"state":"success"}', '{"state":"unknown","summary":"x"}']) {
    assert.throws(() => parseCheck({ ...result('success'), stdout: value }));
  }
  assert.throws(() => parseCheck({ ...result('success'), code: 1 }));
});
test('checks immediately and returns first terminal result', async () => {
  const states = ['pending', 'failure'];
  const outcome = await poll(options, async () => result(states.shift()));
  assert.equal(outcome.state, 'failure');
  assert.equal(states.length, 0);
});
test('three consecutive errors stop polling; pending resets the counter', async () => {
  const states = ['error', 'error', 'pending', 'error', 'error', 'error'];
  const outcome = await poll(options, async () => result(states.shift()));
  assert.equal(outcome.state, 'error');
  assert.equal(states.length, 0);
});
test('expiry preserves last status', async () => {
  const outcome = await poll({ ...options, intervalMs: 100, deadlineMs: 10 }, async () => result('pending'));
  assert.equal(outcome.state, 'expired');
  assert.match(outcome.summary, /pending/);
});
test('Escape-style cancellation interrupts the polling delay', async () => {
  const controller = new AbortController();
  const pending = poll({ ...options, intervalMs: 10000 }, async () => result('pending'), controller.signal);
  setTimeout(() => controller.abort(), 10);
  await assert.rejects(pending, { name: 'AbortError' });
});
test('running checks receive cancellation and deadline signals', async () => {
  const outcome = await poll({ ...options, deadlineMs: 10 }, async (signal) => {
    await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
    return result('success');
  });
  assert.equal(outcome.state, 'expired');
});
