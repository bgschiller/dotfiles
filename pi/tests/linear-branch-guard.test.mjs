import assert from 'node:assert/strict';
import { test } from 'node:test';
import { homedir } from 'node:os';
import extension from '../agent/extensions/linear-branch-guard.ts';

function check(command, cwd = `${homedir()}/work/product`) {
  let handler;
  const notices = [];
  extension({ on(name, fn) { assert.equal(name, 'tool_call'); handler = fn; } });
  const event = { toolName: 'bash', input: { command } };
  const result = handler(event, { cwd, hasUI: true, ui: { notify: (...args) => notices.push(args) } });
  return { result, command: event.input.command, notices };
}

for (const command of [
  'git checkout -b fix', 'git checkout -B fix main', 'git switch -c fix',
  'git switch --create=fix', 'git branch fix', 'git branch -f fix main',
  'git worktree add -b fix ../tree', 'git worktree add ../new-tree',
  'git checkout --orphan fix', 'git switch -C fix',
  'git switch -qc fix', 'git branch --copy main fix',
  'git branch -m fix', 'git branch -m old fix',
  'git switch -c "$BRANCH"', 'git -c core.hooksPath=/tmp checkout -b fix',
]) test(`blocks ${command}`, () => {
  const { result } = check(command);
  assert.equal(result?.block, true);
  assert.match(result.reason, /Fix Chromatic log level coverage/);
  assert.match(result.reason, /GOSURF-1234/);
});

for (const command of [
  'git switch -c GOSURF-123-fix', 'git checkout -b gosurf-123/fix',
  'git branch GOSURF-123', 'git worktree add -b GOSURF-123-fix ../tree',
  'git worktree add ../GOSURF-123-fix', 'git branch -m old GOSURF-123-fix',
  'git branch', 'git branch --list fix', 'git branch -d fix', 'git branch -vv',
  'git branch --show-current', 'git checkout main', 'git switch main',
  'git checkout -- file', 'git worktree add --detach ../tree',
  'git worktree add ../tree main', 'echo "git switch -c fix"',
  "printf '%s' 'git branch fix'", 'git branch --contains HEAD',
]) test(`allows unchanged ${command}`, () => {
  const output = check(command);
  assert.equal(output.result, undefined);
  assert.equal(output.command, command);
});

test('scopes by effective directory', () => {
  assert.equal(check('git switch -c fix', `${homedir()}/dotfiles`).result, undefined);
  assert.equal(check('git switch -c fix', `${homedir()}/work-personal`).result, undefined);
  assert.equal(check('cd ~/dotfiles && git switch -c fix').result, undefined);
  assert.equal(check('git -C ~/dotfiles switch -c fix').result, undefined);
  assert.equal(check('cd ~/work/product && git switch -c fix', homedir()).result?.block, true);
  assert.equal(check('git -C "$HOME/work/product" switch -c fix', homedir()).result?.block, true);
});

test('checks every command without splitting quoted separators', () => {
  assert.equal(check('git switch -c GOSURF-123-ok && git branch nope').result?.block, true);
  assert.equal(check('echo "a; b"; git switch -c fix').result?.block, true);
  assert.equal(check('git switch -c "GOSURF-123-a;b"').result, undefined);
});

test('override requires a reason and notifies without rewriting the command', () => {
  const command = 'LINEAR_BRANCH_GUARD_OVERRIDE="User requested a throwaway experiment" git switch -c fix';
  const output = check(command);
  assert.equal(output.result, undefined);
  assert.equal(output.command, command);
  assert.equal(output.notices.length, 1);
  assert.equal(check('LINEAR_BRANCH_GUARD_OVERRIDE="skip" git switch -c fix').result?.block, true);
  assert.equal(check('echo LINEAR_BRANCH_GUARD_OVERRIDE="a sufficiently long reason"; git branch fix').result?.block, true);
});
