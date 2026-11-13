import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, isAbsolute, relative, resolve } from "node:path";

const OVERRIDE = "LINEAR_BRANCH_GUARD_OVERRIDE";
const guidance = `We're helping the user document the work they do in Linear. Please create a branch with a Linear ticket prefix, e.g. GOSURF-1234-fix-chromatic. If no ticket exists, find or create one with the MCP server. The user's workspace in Linear is GOSURF.

Much work ends up being side-quests and yak-shaving. That's okay—we just want to document it and try to associate it with something else. For example, we might make a ticket that says:

# Fix Chromatic log level coverage
When chromatic detects a diff in storybook, it fails the job but also spools out the thousands of files that differ between this branch and the tip of main. These logs are unhelpful and can hide the link we need for approving chromatic changes.
This change adds \`--log-level warn\` to silence the changed files output.
A side-quest in service of GOSURF-1234.

If it's not clear why we're doing this side-quest, ask the user for clarification. Do not invent a goal connection. If the MCP server is unavailable, ask the user rather than inventing a ticket number.

If the user says to skip this check, or you're confident this work doesn't need a ticket, retry with ${OVERRIDE}="<substantive reason, at least 12 characters>" at the start of the bash command. Explain why no ticket is needed; convenience alone isn't a reason. This bypass is per tool call, not session-wide.`;

// A reminder, not a shell security boundary: inspect literal Git invocations,
// not aliases, scripts, eval, substitutions, or commands inside shell wrappers.
function commands(source: string): string[][] {
	const result: string[][] = [];
	let words: string[] = [], word = "", started = false;
	let quote: string | null = null;
	const flushWord = () => { if (started) words.push(word); word = ""; started = false; };
	for (let i = 0; i < source.length; i++) {
		const c = source[i];
		if (c === "\\" && quote !== "'") {
			const next = source[++i];
			if (next !== "\n" && next !== undefined) { word += next; started = true; }
		} else if (quote) {
			if (c === quote) quote = null;
			else word += c;
		} else if (c === "'" || c === '"') { quote = c; started = true; }
		else if (c === "#" && !started) {
			while (i < source.length && source[i] !== "\n") i++;
			flushWord(); result.push(words); words = [];
		} else if (/[;&|\n()]/.test(c)) { flushWord(); result.push(words); words = []; }
		else if (/\s/.test(c)) flushWord();
		else { word += c; started = true; }
	}
	flushWord(); result.push(words);
	return result.filter(words => words.length > 0);
}

function expandPath(path: string, cwd: string): string {
	return resolve(cwd, path.replace(/^~(?=\/|$)|^\$HOME(?=\/|$)|^\$\{HOME\}(?=\/|$)/, homedir()));
}

function canonical(path: string): string {
	try { return realpathSync(path); } catch { return resolve(path); }
}

function inWork(path: string): boolean {
	const part = relative(canonical(resolve(homedir(), "work")), canonical(path));
	return part === "" || (part !== ".." && !part.startsWith("../") && !isAbsolute(part));
}

function branchTarget(args: string[]): string | undefined {
	const [verb, ...rest] = args;
	if (verb === "switch" || verb === "checkout") {
		for (let i = 0; i < rest.length && rest[i] !== "--"; i++) {
			const arg = rest[i];
			if (/^--(?:create|force-create|orphan)(?:=|$)/.test(arg)) return arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : (rest[i + 1] ?? "");
			const short = arg.match(verb === "switch" ? /^-[^D-]*[cC](.*)$/ : /^-[^-]*[bB](.*)$/);
			if (short) return short[1] || rest[i + 1] || "";
		}
	}
	if (verb === "branch") {
		if (rest.some(a => /^--(?:list|delete|show-current|contains|no-contains|merged|no-merged|points-at)(?:=|$)/.test(a) || /^-[^-]*[dDlavr]/.test(a))) return;
		const positional = rest.filter(a => !a.startsWith("-"));
		const renameOrCopy = rest.some(a => /^--(?:move|copy)$/.test(a) || /^-[^-]*[mMcC]/.test(a));
		return renameOrCopy ? positional.at(-1) : positional[0];
	}
	if (verb === "worktree" && rest[0] === "add") {
		const options = rest.slice(1);
		if (options.includes("--detach") || options.includes("-d")) return;
		for (let i = 0; i < options.length; i++) {
			const match = options[i].match(/^-[bB](.*)$/);
			if (match) return match[1] || options[i + 1] || "";
		}
		const positional: string[] = [];
		for (let i = 0; i < options.length; i++) {
			if (options[i] === "--reason") { i++; continue; }
			if (!options[i].startsWith("-")) positional.push(options[i]);
		}
		// Without an explicit commit-ish Git may create a branch named after the path.
		if (positional.length === 1) return basename(positional[0].replace(/\/+$/, ""));
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", (event, ctx) => {
		if (event.toolName !== "bash" || typeof event.input.command !== "string") return;
		const parsed = commands(event.input.command);
		const leadingAssignments: string[] = [];
		for (const word of parsed[0] ?? []) {
			if (!/^[A-Za-z_][A-Za-z_0-9]*=/.test(word)) break;
			leadingAssignments.push(word);
		}
		const override = leadingAssignments.find(word => word.startsWith(`${OVERRIDE}=`))?.slice(OVERRIDE.length + 1).trim();
		let cwd = ctx.cwd;
		for (const original of parsed) {
			const words = [...original];
			while (/^[A-Za-z_][A-Za-z_0-9]*=/.test(words[0] ?? "")) words.shift();
			if (words[0] === "env" || words[0] === "command") words.shift();
			while (/^[A-Za-z_][A-Za-z_0-9]*=/.test(words[0] ?? "")) words.shift();
			if (words[0] === "cd" && words[1]) { cwd = expandPath(words[1], cwd); continue; }
			if (basename(words[0] ?? "") !== "git") continue;
			let directory = cwd;
			let i = 1;
			for (; i < words.length; i++) {
				const arg = words[i];
				if (arg === "-C") { directory = expandPath(words[++i] ?? ".", directory); continue; }
				if (arg.startsWith("-C")) { directory = expandPath(arg.slice(2), directory); continue; }
				if (arg === "-c" || arg === "--git-dir" || arg === "--namespace") { i++; continue; }
				if (arg === "--work-tree") { directory = expandPath(words[++i] ?? ".", directory); continue; }
				if (arg.startsWith("--work-tree=")) { directory = expandPath(arg.slice(12), directory); continue; }
				if (!arg.startsWith("-")) break;
			}
			if (!inWork(directory)) continue;
			const branch = branchTarget(words.slice(i));
			if (branch === undefined || /^GOSURF-[1-9]\d*(?:[-/_.]|$)/i.test(branch)) continue;
			if (override && override.length >= 12) {
				if (ctx.hasUI) ctx.ui.notify(`linear-branch-guard: allowed "${branch}" — ${override}`, "warning");
				continue;
			}
			return { block: true, reason: `Branch "${branch}" needs a Linear ticket prefix.${override !== undefined ? ` ${OVERRIDE} reason must be at least 12 characters.` : ""}\n\n${guidance}` };
		}
	});
}
