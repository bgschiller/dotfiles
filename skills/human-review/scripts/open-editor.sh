#!/usr/bin/env bash
set -euo pipefail

DOCUMENT="$1"

if [ -n "${TMUX_PANE:-}" ]; then
  tmux split-window -h -t "$TMUX_PANE" "${EDITOR:-vi} '$DOCUMENT'; tmux wait-for -S human-review"
  tmux wait-for human-review
else
  code --wait "$DOCUMENT"
fi
