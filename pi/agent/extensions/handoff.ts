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

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

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

If the details are extensive, feel free to save the fuller notes to a
scratch file (e.g. HANDOFF.md) and reference its path, but your reply here
still needs to stand on its own as the next agent's first instruction.

Do not perform any new work beyond what's needed to reach a clean stopping
point. Reply with ONLY the handoff message itself — no preamble like "Here's
the handoff" and no sign-off — since it will be sent verbatim to the next
agent as its first instruction.`;

type TextLikeContent = { type: string; text?: string };

function extractText(content: TextLikeContent[]): string {
	return content
		.filter((part): part is { type: "text"; text: string } => part.type === "text" && typeof part.text === "string")
		.map((part) => part.text)
		.join("\n\n")
		.trim();
}

/** Find the last assistant message's text within a set of messages from a single agent run. */
function getLastAssistantText(messages: AgentMessage[]): string | undefined {
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i] as { role?: string; content?: unknown };
		if (message.role === "assistant" && Array.isArray(message.content)) {
			const text = extractText(message.content as TextLikeContent[]);
			if (text) return text;
		}
	}
	return undefined;
}

export default function (pi: ExtensionAPI): void {
	// Armed while a /handoff command is waiting on the agent's reply to the
	// handoff-request prompt it just sent. We capture the text straight from
	// the agent_end event payload rather than reading it back out of the
	// session afterwards, since ctx.waitForIdle() can resolve immediately if
	// called before the triggered run has actually started (activeRun isn't
	// set yet), which would otherwise hand us the *previous* assistant
	// message instead of the fresh handoff reply.
	let pendingHandoff: ((text: string | undefined) => void) | undefined;

	pi.on("agent_end", (event) => {
		if (!pendingHandoff) return;
		const resolve = pendingHandoff;
		pendingHandoff = undefined;
		resolve(getLastAssistantText(event.messages));
	});

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

			const handoffPromise = new Promise<string | undefined>((resolve) => {
				pendingHandoff = resolve;
			});
			pi.sendUserMessage(prompt);
			const handoffMessage = await handoffPromise;

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
