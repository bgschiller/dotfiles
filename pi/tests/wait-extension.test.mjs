import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const version = readFileSync(new URL('../agent/install/current-version', import.meta.url), 'utf8').trim();
const { loadExtensions } = await import(`../agent/install/releases/${version}/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/loader.js`);
const { extensions, errors } = await loadExtensions([new URL('../agent/extensions/wait/index.ts', import.meta.url).pathname], process.cwd());
assert.deepEqual(errors, []);
const extension = extensions[0];
const tool = extension.tools.get('wait_for').definition;
function context() {
  const notices = [], statuses = [];
  return { notices, statuses, cwd: process.cwd(), ui: {
    notify: (...args) => notices.push(args), setStatus: (...args) => statuses.push(args),
  } };
}
const params = { label: 'fixture run', kind: 'ci', continuation: 'examine results' };

test('Pi loads /wait and a sequential model-only tool', () => {
  assert.ok(extension.commands.has('wait'));
  assert.equal(tool.exposure, 'model-only');
  assert.equal(tool.executionMode, 'sequential');
});
test('real shell check returns terminal status and continuation', async () => {
  const ctx = context();
  const result = await tool.execute('test', { ...params, command: `printf '%s' '{"state":"success","summary":"green"}'` }, undefined, undefined, ctx);
  assert.equal(result.details.state, 'success');
  assert.equal(JSON.parse(result.content[0].text).continuation, 'examine results');
  assert.equal(result.terminate, undefined);
  assert.deepEqual(ctx.statuses.at(-1), ['wait', undefined]);
});
test('expiry kills an active shell, notifies the user, and terminates follow-up', async () => {
  const ctx = context();
  const result = await tool.execute('test', { ...params, timeoutSeconds: 1, command: 'sleep 30' }, undefined, undefined, ctx);
  assert.equal(result.details.state, 'expired');
  assert.equal(result.terminate, true);
  assert.match(ctx.notices[0][0], /Wait expired/);
});
test('Escape aborts a running command and clears status', async () => {
  const ctx = context();
  const controller = new AbortController();
  const running = tool.execute('test', { ...params, command: 'sleep 30' }, controller.signal, undefined, ctx);
  setTimeout(() => controller.abort(), 30);
  await assert.rejects(running, { name: 'AbortError' });
  assert.deepEqual(ctx.statuses.at(-1), ['wait', undefined]);
});
