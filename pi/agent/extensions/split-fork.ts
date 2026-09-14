import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { existsSync, promises as fs } from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

function shellQuote(value: string): string {
	if (value.length === 0) return "''";
	return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function getPiInvocationParts(): string[] {
	const currentScript = process.argv[1];
	if (currentScript && existsSync(currentScript)) {
		return [process.execPath, currentScript];
	}

	const execName = path.basename(process.execPath).toLowerCase();
	const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
	if (!isGenericRuntime) {
		return [process.execPath];
	}

	return ["pi"];
}

function buildPiCommand(sessionFile: string | undefined, prompt: string): string {
	const commandParts = [...getPiInvocationParts()];

	if (sessionFile) {
		commandParts.push("--session", sessionFile);
	}

	if (prompt.length > 0) {
		commandParts.push("--", prompt);
	}

	return commandParts.map(shellQuote).join(" ");
}

async function createForkedSession(ctx: ExtensionCommandContext): Promise<string | undefined> {
	const sessionFile = ctx.sessionManager.getSessionFile();
	if (!sessionFile) {
		return undefined;
	}

	const sessionDir = path.dirname(sessionFile);
	const branchEntries = ctx.sessionManager.getBranch();
	const currentHeader = ctx.sessionManager.getHeader();

	const timestamp = new Date().toISOString();
	const fileTimestamp = timestamp.replace(/[:.]/g, "-");
	const newSessionId = randomUUID();
	const newSessionFile = path.join(sessionDir, `${fileTimestamp}_${newSessionId}.jsonl`);

	const newHeader = {
		type: "session",
		version: currentHeader?.version ?? 3,
		id: newSessionId,
		timestamp,
		cwd: currentHeader?.cwd ?? ctx.cwd,
		parentSession: sessionFile,
	};

	const lines = [JSON.stringify(newHeader), ...branchEntries.map((entry) => JSON.stringify(entry))].join("\n") + "\n";

	await fs.mkdir(sessionDir, { recursive: true });
	await fs.writeFile(newSessionFile, lines, "utf8");

	return newSessionFile;
}

export default function (pi: ExtensionAPI): void {
	pi.registerCommand("split-fork", {
		description: "Fork this session into a new pi process in a right-hand tmux split. Usage: /split-fork [optional prompt]",
		handler: async (args, ctx) => {
			if (!process.env.TMUX) {
				ctx.ui.notify("/split-fork requires running inside a tmux session.", "warning");
				return;
			}

			const wasBusy = !ctx.isIdle();
			const prompt = args.trim();
			const forkedSessionFile = await createForkedSession(ctx);
			const piCommand = buildPiCommand(forkedSessionFile, prompt);

			// tmux spawns panes from the tmux *server* environment, not this pi
			// process's env, so PI_CODING_AGENT_DIR (which selects the agent dir +
			// auth) would be lost. Re-export the PI_* vars explicitly.
			const envExports = Object.entries(process.env)
				.filter(([key, value]) => key.startsWith("PI_") && value !== undefined)
				.map(([key, value]) => `export ${key}=${shellQuote(value as string)}`)
				.join("; ");

			// Keep the pane alive on exit so any error output stays visible.
			const prefix = envExports ? `${envExports}; ` : "";
			const paneCommand = `${prefix}${piCommand}; echo; echo '[split-fork pane exited]'; exec ${process.env.SHELL || "/bin/sh"}`;

			const result = await pi.exec("tmux", [
				"split-window",
				"-h",
				"-c",
				ctx.cwd,
				paneCommand,
			]);

			if (result.code !== 0) {
				const reason = result.stderr?.trim() || result.stdout?.trim() || "unknown tmux error";
				ctx.ui.notify(`Failed to launch tmux split: ${reason}`, "error");
				if (forkedSessionFile) {
					ctx.ui.notify(`Forked session was created: ${forkedSessionFile}`, "info");
				}
				return;
			}

			if (forkedSessionFile) {
				const fileName = path.basename(forkedSessionFile);
				const suffix = prompt ? " and sent prompt" : "";
				ctx.ui.notify(`Forked to ${fileName} in a new tmux split${suffix}.`, "info");
				if (wasBusy) {
					ctx.ui.notify("Forked from current committed state (in-flight turn continues in original session).", "info");
				}
			} else {
				ctx.ui.notify("Opened a new tmux split (no persisted session to fork).", "warning");
			}
		},
	});
}
