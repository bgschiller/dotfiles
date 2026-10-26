#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || ! -f "$1" ]]; then
  printf 'Usage: %s <existing-document>\n' "$0" >&2
  exit 1
fi

# Make paths absolute so leading dashes are not interpreted as editor flags.
DOCUMENT="$(cd -- "$(dirname -- "$1")" && pwd)/$(basename -- "$1")"
# tmux executes its command through a shell. Escape embedded single quotes.
QUOTED_DOCUMENT=${DOCUMENT//\'/\'\\\'\'}

if [ -n "${TMUX_PANE:-}" ]; then
  # Use a unique channel per invocation. tmux wait-for channels are counting
  # semaphores that persist on the server, so a shared name here means a
  # signal from an abandoned/interrupted review (tool cancelled, timeout,
  # etc.) can be silently consumed by the next unrelated review, causing it
  # to return instantly without ever blocking.
  CHANNEL="human-review-$$-$RANDOM"
  tmux split-window -h -t "$TMUX_PANE" "${EDITOR:-vi} '$QUOTED_DOCUMENT'; tmux wait-for -S '$CHANNEL'"
  tmux wait-for "$CHANNEL"
else
  code --wait "$DOCUMENT"
fi
