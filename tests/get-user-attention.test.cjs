const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { oscStatus, passthrough } = require('../bin/get-user-attention');

test('OSC 7501 encodes single-line text and respects the UTF-8 byte limit', () => {
  const osc = oscStatus('done', 'ci', '✅\n\x1b\u0085' + 'é'.repeat(2000));
  assert.ok(osc.startsWith('\x1b]7501;state=done:app=ci:msg='));
  const text = Buffer.from(osc.split('msg=')[1].slice(0, -2), 'base64').toString();
  assert.ok(Buffer.byteLength(text) <= 2048);
  assert.ok(text.startsWith('✅   '));
  assert.ok(!text.includes('\ufffd'));
  assert.equal(passthrough(osc, false), osc);
  assert.equal(passthrough(osc, true), `\x1bPtmux;${osc.replace(/\x1b/g, '\x1b\x1b')}\x1b\\`);
});

function invoke(args, env = {}, platform = 'darwin') {
  const calls = [], writes = [];
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../bin/get-user-attention'), 'utf8'), {
    module,
    require: (id) => id === 'node:child_process' ? {
      execFileSync: (...args) => calls.push(args),
    } : {
      openSync: () => 42, closeSync: () => {},
      writeSync: (fd, data) => writes.push([fd, data]),
    },
    process: { env, platform, stdout: { isTTY: false } }, Buffer, console,
  });
  module.exports.main(args);
  return { calls, writes };
}

test('default notification sets tmux and plays the local chime', () => {
  const { calls, writes } = invoke(['CI passed'], { TMUX: 'socket', TMUX_PANE: '%7' });
  assert.equal(JSON.stringify(calls[0][1]), JSON.stringify(['set-window-option', '-t', '%7', '@user_attention', '1']));
  assert.equal(calls[1][0], 'afplay');
  assert.ok(writes[0][1].startsWith('\x1bPtmux;'));
});

test('working is quiet, SSH rings the local terminal instead of remote afplay', () => {
  const working = invoke(['--state', 'working'], { TMUX_PANE: '%7' });
  assert.equal(working.calls.length, 1);
  assert.equal(working.calls[0][1].at(-1), '0');
  const remote = invoke(['--state', 'error'], { SSH_CONNECTION: 'remote' });
  assert.equal(remote.calls.length, 0);
  assert.equal(remote.writes[1][1], '\x07');
  assert.equal(invoke(['--quiet'], { SSH_TTY: '/dev/pts/1' }).writes.length, 1);
});

test('all states emit only program status, never desktop notifications', () => {
  for (const state of ['done', 'blocked', 'error', 'working', 'idle', 'clear']) {
    const { writes } = invoke(['--state', state, '--app', 'ci', 'CI passed'], { TMUX: 'socket' });
    assert.equal(writes.length, 1);
    assert.equal(writes[0][1], passthrough(oscStatus(state, 'ci', 'CI passed'), true));
  }
});

test('rejects invalid protocol fields and options', () => {
  for (const args of [['--state', 'bogus'], ['--app', 'x:state=error'], ['--tty'], ['--bogus']]) {
    assert.throws(() => invoke(args));
  }
});

test('Pi only reports interactive starts and final settlement, never agent_end', async () => {
  // Strip the type-only import; the remaining extension is plain JavaScript.
  const source = fs.readFileSync(path.join(__dirname, '../pi/agent/extensions/get-user-attention.ts'), 'utf8')
    .replace(/^import type .*;\n/m, '')
    .replace('import os from "node:os";', 'const os = require("node:os");')
    .replace('import path from "node:path";', 'const path = require("node:path");')
    .replace('export default function (pi: ExtensionAPI)', 'module.exports = function (pi)');
  const module = { exports: {} }, handlers = {}, calls = [];
  vm.runInNewContext(source, { module, require });
  module.exports({ on: (name, handler) => { handlers[name] = handler; }, exec: async (...args) => { calls.push(args); } });
  assert.equal(handlers.agent_end, undefined);
  for (const mode of ['print', 'rpc', 'json']) {
    await handlers.agent_start({}, { mode, hasUI: true });
    await handlers.agent_settled({}, { mode, hasUI: true });
  }
  assert.equal(calls.length, 0);
  await handlers.agent_start({}, { mode: 'tui' });
  await handlers.agent_settled({}, { mode: 'tui' });
  assert.equal(calls[0][1][1], 'working');
  assert.equal(calls[1][1][1], 'done');
});
