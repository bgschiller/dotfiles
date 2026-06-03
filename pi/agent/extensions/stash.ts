/**
 * Stash extension — ctrl+s
 *
 * Saves the current editor text to a stash and clears the editor.
 * Press ctrl+s again to restore it immediately. If you submit a prompt or run a
 * settings slash-command like `/model`, the stashed text is put back right away.
 *
 * Typical flow:
 *   1. You've typed a long prompt but realise you need to change the model first.
 *   2. Press ctrl+s — the prompt is stashed and the editor clears.
 *   3. Type `/model gemini-2.5-pro` and hit enter.
 *   4. As soon as the command is submitted, your original prompt reappears.
 *
 * You can also press ctrl+s again before submitting anything to restore manually.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  let stash: string | undefined;

  // ── ctrl+s: save & clear ──────────────────────────────────────────────────
  pi.registerShortcut("ctrl+s", {
    description: "Stash editor text (press again to restore)",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;

      const currentText = ctx.ui.getEditorText();
      const text = currentText.trim();

      if (!text) {
        if (!stash) {
          ctx.ui.notify("Nothing to stash", "info");
          return;
        }

        const saved = stash;
        stash = undefined;
        ctx.ui.setEditorText(saved);
        ctx.ui.notify("Stash restored to editor", "info");
        updateWidget(ctx);
        return;
      }

      stash = currentText; // preserve exact text incl. whitespace
      ctx.ui.setEditorText("");
      ctx.ui.notify("Stashed! Press ctrl+s again to restore, or submit a prompt/command and it will come back immediately.", "info");
      updateWidget(ctx);
    },
  });
  // ── restore helpers ───────────────────────────────────────────────────────
  function restoreStash(
    ctx: Parameters<Parameters<typeof pi.registerShortcut>[1]["handler"]>[0],
  ) {
    if (!ctx.hasUI) return;
    if (!stash) return;

    const saved = stash;
    stash = undefined;
    ctx.ui.setEditorText(saved);
    ctx.ui.notify("Stash restored to editor", "info");
    updateWidget(ctx);
  }

  function restoreIfEditorEmpty(
    ctx: Parameters<Parameters<typeof pi.registerShortcut>[1]["handler"]>[0],
  ) {
    if (!ctx.hasUI) return;
    if (!stash) return;
    if (ctx.ui.getEditorText().trim() !== "") return;
    restoreStash(ctx);
  }

  // ── prompt submit: restore immediately after the user message starts ──────
  pi.on("message_start", async (event, ctx) => {
    if (event.message.role !== "user") return;
    restoreStash(ctx);
  });

  // ── slash-command settings changes: restore immediately after submit ──────
  pi.on("model_select", async (_event, ctx) => {
    restoreStash(ctx);
  });

  pi.on("thinking_level_select", async (_event, ctx) => {
    restoreStash(ctx);
  });

  // ── fallback: if anything else leaves the editor empty, restore later ─────
  pi.on("agent_end", async (_event, ctx) => {
    restoreIfEditorEmpty(ctx);
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
