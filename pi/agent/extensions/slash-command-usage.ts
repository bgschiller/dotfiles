import { appendFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AutocompleteProvider } from "@earendil-works/pi-tui";

function isCommandPrefix(lines: string[], line: number, col: number, prefix: string): boolean {
  return /^\/[^\s/]*$/.test(prefix) && (lines[line] ?? "").slice(0, col).trimStart() === prefix;
}

function matchPriority(name: string, query: string): number {
  const full = name.toLowerCase();
  const bare = full.startsWith("skill:") ? full.slice(6) : full;
  if (full === query || bare === query) return 0;
  if (full.startsWith(query) || bare.startsWith(query)) return 1;
  return 2;
}

/** Learn from accepted command-name completions, not merely displayed suggestions. */
export function createUsageAutocompleteProvider(
  current: AutocompleteProvider,
  usageFile: string,
  onError: (error: unknown) => void,
): AutocompleteProvider {
  let counts = new Map<string, number>();
  let signature = "";

  function readCounts(): Map<string, number> {
    try {
      const stat = statSync(usageFile);
      const nextSignature = `${stat.size}:${stat.mtimeMs}`;
      if (signature === nextSignature) return counts;
      const next = new Map<string, number>();
      for (const line of readFileSync(usageFile, "utf8").split("\n")) {
        try {
          const name: unknown = JSON.parse(line);
          if (typeof name === "string" && /^[^\s/]+$/.test(name)) {
            next.set(name, (next.get(name) ?? 0) + 1);
          }
        } catch {
          // Ignore incomplete or damaged journal records.
        }
      }
      counts = next;
      signature = nextSignature;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) onError(error);
      counts = new Map();
      signature = "";
    }
    return counts;
  }

  return {
    triggerCharacters: current.triggerCharacters,
    async getSuggestions(lines, cursorLine, cursorCol, options) {
      const suggestions = await current.getSuggestions(lines, cursorLine, cursorCol, options);
      if (!suggestions || options.force || !isCommandPrefix(lines, cursorLine, cursorCol, suggestions.prefix)) {
        return suggestions;
      }
      const usage = readCounts();
      const query = suggestions.prefix.slice(1).toLowerCase();
      return {
        ...suggestions,
        items: [...suggestions.items].sort((a, b) =>
          matchPriority(a.value, query) - matchPriority(b.value, query) ||
          (usage.get(b.value) ?? 0) - (usage.get(a.value) ?? 0),
        ),
      };
    },
    applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
      const result = current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
      if (isCommandPrefix(lines, cursorLine, cursorCol, prefix) && /^[^\s/]+$/.test(item.value)) {
        try {
          mkdirSync(dirname(usageFile), { recursive: true });
          // One append per selection avoids overwriting another Pi session's counts.
          appendFileSync(usageFile, `${JSON.stringify(item.value)}\n`, { mode: 0o600 });
          signature = "";
        } catch (error) {
          onError(error);
        }
      }
      return result;
    },
    shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
      return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
    },
  };
}

export default function (pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;
    let warned = false;
    ctx.ui.addAutocompleteProvider(current => createUsageAutocompleteProvider(
      current,
      join(getAgentDir(), "slash-command-usage.jsonl"),
      error => {
        if (warned) return;
        warned = true;
        ctx.ui.notify(`Command usage could not be saved or loaded: ${String(error)}`, "warning");
      },
    ));
  });
}
