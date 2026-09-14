/**
 * Scope Guard Extension
 *
 * Blocks overly broad filesystem searches (e.g. `find /`, `find /home`,
 * `grep -r /`) before they run, and suggests narrowing the search scope
 * instead of scanning huge portions of the filesystem.
 *
 * Escape hatch: if the agent is genuinely sure it needs to scan a broad
 * path, it can prefix the command with a `SCOPE_GUARD_OVERRIDE="<reason>"`
 * env-var assignment. This is valid shell syntax (bash just sets an env var
 * for that command, which is harmless/no-op for `find`/`grep`), so the
 * command still runs correctly once allowed through. The reason must be a
 * substantive justification (not a placeholder) - short/empty reasons are
 * rejected and the command stays blocked. Overrides are logged via
 * ctx.ui.notify so a human watching the session can see when/why the guard
 * was bypassed.
 */

import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const OVERRIDE_VAR = "SCOPE_GUARD_OVERRIDE";
const MIN_REASON_LENGTH = 12;

// Paths that are considered "broad" roots. Matches "/", "~", "$HOME", and
// any absolute path with zero or one path segment (e.g. "/home", "/Users",
// "/usr", "/etc"), since scanning an entire top-level directory is almost
// always unnecessarily expensive.
function isBroadPath(rawPath: string): boolean {
	let p = rawPath.trim();

	// Strip surrounding quotes.
	if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
		p = p.slice(1, -1);
	}

	if (p === "") return false;

	// Home directory roots.
	if (p === "~" || p === "$HOME" || p === "${HOME}") return true;

	// Not an absolute path (relative searches are usually fine).
	if (!p.startsWith("/")) return false;

	// Strip trailing slash for consistent segment counting.
	const trimmed = p.endsWith("/") && p.length > 1 ? p.slice(0, -1) : p;

	if (trimmed === "/") return true;

	const segments = trimmed.split("/").filter(Boolean);
	// "/home", "/Users", "/usr", "/etc", "/var", etc. - a single top-level segment.
	return segments.length <= 1;
}

// Split a shell command into naive subcommands on common separators so we
// can inspect each piece independently (handles "a && find / ...; b").
function splitSubcommands(command: string): string[] {
	return command
		.split(/&&|\|\||[;|\n]/g)
		.map((s) => s.trim())
		.filter(Boolean);
}

interface OverrideStrip {
	reason: string | null;
	rest: string;
}

// Detect and strip a leading `SCOPE_GUARD_OVERRIDE="reason"` (or unquoted
// `SCOPE_GUARD_OVERRIDE=reason`) env-var prefix from a subcommand. Returns
// the extracted reason (or null if no valid prefix present) plus the
// remaining command text to run the normal broad-search checks against.
function stripOverride(sub: string): OverrideStrip {
	const re = new RegExp(`^${OVERRIDE_VAR}\\s*=\\s*(".*?"|'.*?'|\\S+)\\s+(.*)$`, "s");
	const match = sub.match(re);
	if (!match) return { reason: null, rest: sub };

	let reason = match[1].trim();
	if ((reason.startsWith('"') && reason.endsWith('"')) || (reason.startsWith("'") && reason.endsWith("'"))) {
		reason = reason.slice(1, -1);
	}

	return { reason, rest: match[2] };
}

interface BroadSearchMatch {
	tool: string;
	path: string;
}

// Maximum -maxdepth value we'll accept as "sufficiently bounded" for a given
// broad root. The true filesystem root ("/") fans out into many top-level
// dirs (Users, System, Library, Applications, opt, private, Volumes, ...),
// so even a modest depth like 6 still amounts to a near-full-disk scan.
// Single-segment roots (e.g. "/Users", "/home") are narrower, so a larger
// depth is tolerable there.
function maxAllowedDepth(pathToken: string): number {
	return pathToken === "/" ? 2 : 4;
}

function findBroadFindCommand(sub: string): BroadSearchMatch | null {
	const match = sub.match(/(?:^|\s)find\s+(.+)/);
	if (!match) return null;

	const rest = match[1].trim();
	// First whitespace-separated token that isn't an option is the path.
	const tokens = rest.split(/\s+/);
	const pathToken = tokens[0];
	if (!pathToken || pathToken.startsWith("-")) return null;

	if (!isBroadPath(pathToken)) return null;

	// If the command already scopes itself with a sufficiently small
	// -maxdepth, allow it through - the user has explicitly bounded the
	// traversal. A large maxdepth (or one applied to the true root "/") is
	// still effectively a full-filesystem scan, so it stays blocked.
	const maxdepthMatch = rest.match(/-maxdepth\s+(\d+)/);
	if (maxdepthMatch && Number(maxdepthMatch[1]) <= maxAllowedDepth(pathToken)) return null;

	return { tool: "find", path: pathToken };
}

function findBroadGrepCommand(sub: string): BroadSearchMatch | null {
	// Recursive grep/ripgrep/ag/ack variants: grep -r, grep -R, rg, ag, ack
	const match = sub.match(/(?:^|\s)(grep\s+(?:-\w*[rR]\w*|--recursive)\s+.*|rg\s+.*|ag\s+.*|ack\s+.*)/);
	if (!match) return null;

	const full = match[1];
	const tokens = full.split(/\s+/).filter(Boolean);

	// Last non-flag token is typically the path for these tools when scanning
	// a directory tree (pattern usually comes right before it, or is quoted).
	for (let i = tokens.length - 1; i >= 0; i--) {
		const t = tokens[i];
		if (t.startsWith("-")) continue;
		if (isBroadPath(t)) {
			const tool = tokens[0];
			return { tool, path: t };
		}
		break;
	}
	return null;
}

function findBroadSearch(rest: string): BroadSearchMatch | null {
	return findBroadFindCommand(rest) ?? findBroadGrepCommand(rest);
}

type DetectResult =
	| { kind: "blocked"; match: BroadSearchMatch }
	| { kind: "override-accepted"; match: BroadSearchMatch; reason: string }
	| { kind: "override-rejected"; match: BroadSearchMatch; reason: string }
	| { kind: "clear" };

function detectBroadSearch(command: string): DetectResult {
	for (const sub of splitSubcommands(command)) {
		const { reason, rest } = stripOverride(sub);
		const match = findBroadSearch(rest);
		if (!match) continue;

		if (reason === null) {
			return { kind: "blocked", match };
		}
		if (reason.length >= MIN_REASON_LENGTH) {
			return { kind: "override-accepted", match, reason };
		}
		return { kind: "override-rejected", match, reason };
	}
	return { kind: "clear" };
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", (event, ctx) => {
		if (!isToolCallEventType("bash", event)) return;

		const command = event.input.command;
		if (!command) return;

		const result = detectBroadSearch(command);

		switch (result.kind) {
			case "clear":
				return;

			case "override-accepted": {
				if (ctx.hasUI) {
					ctx.ui.notify(
						`scope-guard: allowed broad "${result.match.tool}" over "${result.match.path}" - reason: ${result.reason}`,
						"warning",
					);
				}
				// Strip the SCOPE_GUARD_OVERRIDE=... prefix(es) before execution so
				// the shell doesn't have to deal with them (harmless if left in, but
				// cleaner output/logs without it).
				event.input.command = command.replace(
					new RegExp(`\\b${OVERRIDE_VAR}\\s*=\\s*("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|\\S+)\\s+`, "g"),
					"",
				);
				return;
			}

			case "override-rejected":
				return {
					block: true,
					reason:
						`${OVERRIDE_VAR} was provided but the reason is too short/insubstantial ("${result.reason}"). ` +
						`Give a specific, substantive justification (>= ${MIN_REASON_LENGTH} chars) for why "${result.match.tool}" ` +
						`must scan the broad path "${result.match.path}", e.g. ` +
						`${OVERRIDE_VAR}="need to find config across all user homes, no single subdir known" ${result.match.tool} ${result.match.path} ...`,
				};

			case "blocked":
				return {
					block: true,
					reason:
						`Refusing to run "${result.match.tool}" over an overly broad path ("${result.match.path}"). ` +
						"Scope the search to a specific directory (e.g. add a subdirectory path), " +
						"or narrow it with flags such as -maxdepth, -name, -path, or a glob, " +
						"to avoid scanning the entire filesystem. " +
						`If this broad scan is genuinely necessary, prefix the command with ` +
						`${OVERRIDE_VAR}="<substantive reason>" to override, e.g. ` +
						`${OVERRIDE_VAR}="user's file could be anywhere under /, no candidate dir known" ${result.match.tool} ${result.match.path} ...`,
				};
		}
	});
}
