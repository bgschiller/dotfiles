---
name: get-user-attention
description: Notify the user when requested background work finishes or needs input, including CI pipeline or deployment watchers. Use the get-user-attention command for a chime, tmux highlight, and terminal program status.
---

# Get user attention

`~/bin/get-user-attention "CI for feature-x passed"` requests user attention.
It plays a local chime (terminal bell over SSH/on Linux), highlights the tmux
window, and emits OSC 7501 program status. It does not send desktop notifications.
Requires Node.js on the executing host.

- Default state is `done`. Use `--state error` for failure or `--state blocked`
  when a human must act. `--state working --quiet` reports progress without a chime
  or highlight. `--state idle --quiet` clears the tmux highlight and reports idle.
- `--app ci-watch` supplies a stable identifier (1–32 letters, digits, `_.+-`).
- `--quiet` suppresses the script's sound, not status or the tmux highlight.
- Messages are single-line text; never include credentials or sensitive logs.
- Notify once on the requested terminal condition, not on every poll. Pin the
  exact branch/commit/pipeline; report pass/fail/cancelled truthfully. Bound polling
  with a timeout; distinguish API errors from completed jobs. Use the relevant CI
  skill to discover the correct API/CLI rather than guessing commands.
- Pi already notifies when the interactive agent settles. Don't add duplicate
  notifications for ordinary replies or subagent completion: notify the parent,
  not the human. Explicitly requested independent watchers are appropriate.

Example structure (replace the watcher with a real bounded CI watcher):

```sh
if watch-specific-pipeline; then
  ~/bin/get-user-attention --app ci-watch "CI for feature-x passed"
else
  ~/bin/get-user-attention --app ci-watch --state error "CI watch failed; check the result"
fi
```

## Terminal transport, SSH, and detached watchers

Output goes directly to the controlling terminal, even when stdout is captured.
For a watcher that will detach, capture `tty` **before detaching** and pass that
path with `--tty "$notify_tty"`. Preserve `TMUX`/`TMUX_PANE` when launching it so
it targets the originating tmux window. Never guess another user's terminal.

Over SSH, install the command/Node.js on the remote host and use an allocated
PTY (`ssh -t host`). OSC and BEL travel back to the local terminal. Audible bell
and status presentation depend on the local terminal's settings/support; remote
`afplay` cannot play a sound on your laptop. With no live SSH connection there
is no notification transport: keep a remote tmux session attached, or use a
separately configured push service for disconnected delivery.

Inside tmux, reload `~/.tmux.conf` for `allow-passthrough all` (tmux 3.3+).
This permits passthrough even from hidden panes; it also lets pane programs emit
other terminal escape sequences, so use trusted workloads. The script wraps one
tmux layer. Nested tmux (including local tmux around remote tmux) needs additional
wrapping/configuration; it is not handled automatically. A terminal without OSC
7501 support ignores it; tmux highlighting and existing sound remain available.

Protocol: https://www.superlogical.com/rex/docs/build/program-status
