/**
 * Stash extension — ctrl+s
 *
 * Saves the current editor text to a stash and clears the editor.
 * Once the next agent turn finishes (editor is empty again), the stashed
 * text is automatically restored so the user can continue where they left off.
 *
 * Typical flow:
 *   1. You've typed a long prompt but realise you need to change the model first.
 *   2. Press ctrl+s — the prompt is stashed and the editor clears.
 *   3. Type `/model gemini-2.5-pro` and hit enter.
 *   4. After the model switch completes, your original prompt reappears.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  let stash: string | undefined;

  // ── ctrl+s: save & clear ──────────────────────────────────────────────────
  pi.registerShortcut("ctrl+s", {
    description: "Stash editor text (restore after next turn)",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;

      const text = ctx.ui.getEditorText().trim();
      if (!text) {
        ctx.ui.notify("Nothing to stash", "info");
        return;
      }

      stash = ctx.ui.getEditorText(); // preserve exact text incl. whitespace
      ctx.ui.setEditorText("");
      ctx.ui.notify("Stashed! Editor cleared.", "info");
      updateWidget(ctx);
    },
  });

  // ── agent_end: restore if editor is still empty ───────────────────────────
  pi.on("agent_end", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    if (!stash) return;

    const current = ctx.ui.getEditorText().trim();
    if (current !== "") return; // user already typed something — don't clobber it

    const saved = stash;
    stash = undefined;
    ctx.ui.setEditorText(saved);
    ctx.ui.notify("Stash restored to editor", "info");
    updateWidget(ctx);
  });

  // ── helper: show/hide the stash indicator widget ──────────────────────────
  function updateWidget(ctx: Parameters<Parameters<typeof pi.registerShortcut>[1]["handler"]>[0]) {
    if (stash !== undefined) {
      const preview = stash.length > 60 ? stash.slice(0, 57) + "…" : stash;
      // Replace newlines so the preview fits on one line
      const oneLiner = preview.replace(/\n/g, " ↵ ");
      ctx.ui.setWidget("stash", [`📋 stashed: ${oneLiner}`]);
    } else {
      ctx.ui.setWidget("stash", undefined);
    }
  }
}
