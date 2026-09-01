/**
 * no-editor extension
 *
 * Prevents the agent from hanging forever on git commands that spawn an
 * interactive editor and wait for a human to save a commit message.
 *
 * The classic offender:
 *
 *   git add pnpm-lock.yaml; git rebase --continue
 *
 * `git rebase --continue` opens $EDITOR to confirm the commit message and
 * blocks until you save + quit. Since the agent has no way to drive an editor,
 * the bash tool hangs indefinitely (we've seen 24000s+ elapsed).
 *
 * Fix: for any bash command that runs a git subcommand known to launch an
 * editor (commit, rebase, merge, revert, cherry-pick, tag, config, notes,
 * am, citool), we prepend:
 *
 *   export GIT_EDITOR=true GIT_SEQUENCE_EDITOR=true
 *
 * `true` exits 0 without modifying the file, so:
 *   - rebase/merge/cherry-pick/revert --continue proceed with the already
 *     prepared commit message instead of blocking.
 *   - a bare `git commit` (no -m) fails fast with "empty commit message"
 *     instead of hanging, so the agent retries with -m.
 *
 * GIT_EDITOR outranks core.editor / VISUAL / EDITOR, so this reliably wins.
 * We deliberately do NOT touch EDITOR / VISUAL globally, to avoid changing the
 * behavior of non-git tools.
 *
 * If the command already sets one of these vars (e.g. a scripted
 * GIT_SEQUENCE_EDITOR for an automated interactive rebase), we leave that one
 * alone and only fill in the ones it didn't set.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

// git subcommands that can open $EDITOR / $GIT_SEQUENCE_EDITOR and block.
const EDITOR_SUBCOMMANDS =
  /\bgit\b[^\n]*?\b(commit|rebase|merge|revert|cherry-pick|tag|config|notes|am|citool)\b/;

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event) => {
    if (!isToolCallEventType("bash", event)) return;

    const command = event.input.command;
    if (!command || !EDITOR_SUBCOMMANDS.test(command)) return;

    // Only set vars the command hasn't already set itself.
    const vars: string[] = [];
    if (!/\bGIT_EDITOR\s*=/.test(command)) vars.push("GIT_EDITOR=true");
    if (!/\bGIT_SEQUENCE_EDITOR\s*=/.test(command))
      vars.push("GIT_SEQUENCE_EDITOR=true");

    if (vars.length === 0) return;

    event.input.command = `export ${vars.join(" ")}\n${command}`;
  });
}
