/**
 * Handoff extension — /handoff
 *
 * Asks the current agent to wrap up its work and write a handoff message for
 * a fresh agent with no memory of this conversation, then starts a brand new
 * session and immediately prompts it with that handoff message.
 *
 * Usage:
 *   /handoff                       — ask for a standard handoff, then continue fresh
 *   /handoff focus on the API bug  — extra instructions appended to the handoff ask
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

const HANDOFF_PROMPT = `You're about to be handed off to a fresh agent with no memory of this
conversation. Wrap up any work that's safe to conclude now, then write a
handoff message for that next agent.

The handoff message should be self-contained and should include, as
relevant:
- What the overall task/goal is
- What you've done so far and the current state of the work
- Any important decisions made and why (especially non-obvious ones)
- What's left to do, and a concrete suggested next step
- Any gotchas, dead ends, or things that didn't work
- Relevant file paths, commands, URLs, or other pointers

Do not perform any new work beyond what's needed to reach a clean stopping
point. Reply with ONLY the handoff message itself — no preamble like "Here's
the handoff" and no sign-off — since it will be sent verbatim to the next
agent as its first instruction.`;

function extractText(content: { type: string; text?: string }[]): string {
	return content
		.filter((part): part is { type: "text"; text: string } => part.type === "text" && typeof part.text === "string")
		.map((part) => part.text)
		.join("\n\n")
		.trim();
}

function getLastAssistantText(ctx: ExtensionCommandContext): string | undefined {
	const branch = ctx.sessionManager.getBranch();
	for (let i = branch.length - 1; i >= 0; i--) {
		const entry = branch[i];
		if (entry.type === "message" && entry.message.role === "assistant") {
			const text = extractText(entry.message.content as { type: string; text?: string }[]);
			if (text) return text;
		}
	}
	return undefined;
}

export default function (pi: ExtensionAPI): void {
	pi.registerCommand("handoff", {
		description: "Wrap up, write a handoff message, then start a fresh session with that message. Usage: /handoff [extra instructions]",
		handler: async (args, ctx) => {
			if (!ctx.isIdle()) {
				ctx.ui.notify("/handoff: agent is busy, wait for it to finish first.", "warning");
				return;
			}

			const extra = args.trim();
			const prompt = extra ? `${HANDOFF_PROMPT}\n\nAdditional instructions: ${extra}` : HANDOFF_PROMPT;

			ctx.ui.notify("Asking the agent to wrap up and write a handoff message...", "info");
			pi.sendUserMessage(prompt);
			await ctx.waitForIdle();

			const handoffMessage = getLastAssistantText(ctx);
			if (!handoffMessage) {
				ctx.ui.notify("/handoff: didn't get a handoff message back, aborting before clearing context.", "error");
				return;
			}

			ctx.ui.notify("Starting a fresh session with the handoff message...", "info");
			const result = await ctx.newSession({
				withSession: async (newCtx) => {
					await newCtx.sendUserMessage(handoffMessage);
				},
			});

			if (result.cancelled) {
				ctx.ui.notify("/handoff: new session was cancelled.", "warning");
			}
		},
	});
}
