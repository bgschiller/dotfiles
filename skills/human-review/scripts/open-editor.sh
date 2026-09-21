#!/usr/bin/env bash
set -euo pipefail

DOCUMENT="$1"

if [ -n "${TMUX_PANE:-}" ]; then
  # Use a unique channel per invocation. tmux wait-for channels are counting
  # semaphores that persist on the server, so a shared name here means a
  # signal from an abandoned/interrupted review (tool cancelled, timeout,
  # etc.) can be silently consumed by the next unrelated review, causing it
  # to return instantly without ever blocking.
  CHANNEL="human-review-$$-$RANDOM"
  tmux split-window -h -t "$TMUX_PANE" "${EDITOR:-vi} '$DOCUMENT'; tmux wait-for -S '$CHANNEL'"
  tmux wait-for "$CHANNEL"
else
  code --wait "$DOCUMENT"
fi
