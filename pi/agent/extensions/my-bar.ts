/**
 * my-bar — a custom footer extension based on pi-bar with parent + subagent costs.
 *
 * Segments (left to right):
 *   <model>  ❯  think:<level>  ❯  <context% / window>  ❯  $<session cost>  ❯  <branch>  ❯  <worktree?>  ❯  <extension statuses>
 *
 * Example:
 *   claude-sonnet-4-6  ❯  think:off  ❯  2.6% / 200k  ❯  $0.0142  ❯  ⎇ main  ❯  𖠰 dotfiles  ❯  stash:3 items
 *
 * Drop-in replacement for pi-bar. Disable pi-bar in settings.json and load this instead.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";
import path from "node:path";
import { truncateToWidth } from "@earendil-works/pi-tui";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatModelName(id: string | undefined): string {
  if (!id) return "no-model";
  const base = id.includes("/") ? (id.split("/").pop() ?? id) : id;
  return base.replace(/-\d{8}$/, "").replace(/-\d{4}-\d{2}-\d{2}$/, "");
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return v >= 10 ? `${Math.round(v)}M` : `${v.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return v >= 10 ? `${Math.round(v)}k` : `${v.toFixed(1)}k`;
  }
  return `${n}`;
}

function formatCost(dollars: number): string {
  if (dollars === 0) return "$0.00";
  if (dollars < 0.0001) return `$${dollars.toExponential(1)}`;
  if (dollars < 0.01) return `$${dollars.toFixed(4)}`;
  if (dollars < 1) return `$${dollars.toFixed(3)}`;
  return `$${dollars.toFixed(2)}`;
}

type ThemeColor =
  | "accent" | "dim" | "text" | "muted" | "success" | "warning" | "error"
  | "thinkingOff" | "thinkingMinimal" | "thinkingLow" | "thinkingMedium"
  | "thinkingHigh" | "thinkingXhigh" | "thinkingText";

function thinkingColor(level: string): ThemeColor {
  switch (level) {
    case "off": return "thinkingOff";
    case "minimal": case "min": return "thinkingMinimal";
    case "low": return "thinkingLow";
    case "medium": case "med": return "thinkingMedium";
    case "high": return "thinkingHigh";
    case "xhigh": case "extra-high": return "thinkingXhigh";
    default: return "thinkingText";
  }
}

function contextColor(
  percent: number | null | undefined,
  warningThreshold = 70,
  errorThreshold = 90,
): ThemeColor {
  if (percent == null) return "muted";
  if (percent >= errorThreshold) return "error";
  if (percent >= warningThreshold) return "warning";
  return "success";
}

/** Sum parent assistant and compaction costs in the current branch. */
function computeSessionCost(ctx: ExtensionContext): number {
  let total = 0;
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "compaction") {
      total += entry.usage?.cost.total ?? 0;
      continue;
    }
    if (entry.type !== "message") continue;
    const msg = (entry as unknown as { message: unknown }).message as Record<string, unknown>;
    if (msg.role !== "assistant") continue;
    const usage = msg.usage as Record<string, unknown> | undefined;
    const cost = usage?.cost as Record<string, unknown> | undefined;
    if (typeof cost?.total === "number") total += cost.total;
  }
  return total;
}

const SEP = "❯";
const ANSI_PATTERN = /\x1B\[[0-?]*[ -/]*[@-~]/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, "");
}

function getGitBranch(cwd: string): string | null {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    if (branch === "HEAD") {
      return execSync("git rev-parse --short HEAD", {
        cwd,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
    }

    return branch;
  } catch {
    return null;
  }
}

function getWorktreeName(projectDir: string): string | null {
  try {
    const worktreeOutput = execSync("git worktree list", {
      cwd: projectDir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const worktreeCount = worktreeOutput.trim().split("\n").length;

    if (worktreeCount > 1) {
      const repoRoot = execSync("git rev-parse --show-toplevel", {
        cwd: projectDir,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      return path.basename(repoRoot);
    }

    return null;
  } catch {
    return null;
  }
}

// ── extension ─────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  let requestRender: (() => void) | undefined;
  const refresh = () => requestRender?.();
  let childCost = 0;
  let childCostIncomplete = false;
  let cancelCostRequest: (() => void) | undefined;

  // Use the public pi-subagents RPC, not its internal accounting modules.
  const refreshChildCost = () => {
    if (!requestRender) return;
    cancelCostRequest?.();
    const requestId = crypto.randomUUID();
    const timeout = setTimeout(() => cancel(), 5000);
    const unsubscribe = pi.events.on(`subagents:rpc:v1:reply:${requestId}`, (value: unknown) => {
      cancel();
      const reply = value as {
        version?: number;
        success?: boolean;
        data?: { version?: number; childTotal?: { cost?: number }; unresolvedAsyncChildren?: number };
      } | null;
      const cost = reply?.data?.childTotal?.cost;
      const unresolved = reply?.data?.unresolvedAsyncChildren;
      if (reply?.version !== 1 || reply.success !== true || reply.data?.version !== 1 ||
          typeof cost !== "number" || !Number.isFinite(cost) || cost < 0 ||
          typeof unresolved !== "number" || !Number.isSafeInteger(unresolved) || unresolved < 0) return;
      childCost = cost;
      childCostIncomplete = unresolved > 0;
      refresh();
    });
    const cancel = () => {
      clearTimeout(timeout);
      unsubscribe();
      cancelCostRequest = undefined;
    };
    cancelCostRequest = cancel;
    pi.events.emit("subagents:rpc:v1:request", { version: 1, requestId, method: "cost" });
  };

  pi.events.on("subagents:rpc:v1:ready", refreshChildCost);

  pi.on("session_start", async (_event, ctx) => {
    cancelCostRequest?.();
    childCost = 0;
    childCostIncomplete = false;
    if (!ctx.hasUI) return;

    ctx.ui.setFooter((tui, theme, footerData) => {
      requestRender = () => tui.requestRender();

      return {
        dispose() {
          cancelCostRequest?.();
          requestRender = undefined;
        },
        invalidate() {},
        render(width: number): string[] {
          const modelName = formatModelName(ctx.model?.id);
          const thinkingLevel = String(pi.getThinkingLevel());
          const usage = ctx.getContextUsage();

          const contextText = usage
            ? `${usage.percent != null ? `${usage.percent.toFixed(1)}%` : "—%"} / ${formatTokens(usage.contextWindow)}`
            : "—";

          const sessionCost = computeSessionCost(ctx) + childCost;
          const costText = `${formatCost(sessionCost)}${childCostIncomplete ? "+" : ""}`;
          const branch = getGitBranch(ctx.cwd);
          const worktree = getWorktreeName(ctx.cwd);

          // Extension statuses from other extensions (e.g. stash)
          const extensionStatuses = footerData?.getExtensionStatuses?.() ?? new Map<string, string>();
          const statusParts = Array.from(extensionStatuses.entries())
            .filter(([, text]) => stripAnsi(text).trim().length > 0)
            .map(([key, text]) => `${stripAnsi(key)}:${stripAnsi(text)}`);

          const sep = `  ${theme.fg("dim", SEP)}  `;

          const segments: string[] = [
            theme.fg("accent", modelName),
            theme.fg(thinkingColor(thinkingLevel), `think:${thinkingLevel}`),
            theme.fg(contextColor(usage?.percent), contextText),
            theme.fg(sessionCost > 0 ? "text" : "muted", costText),
            ...(branch ? [theme.fg("text", `⎇ ${branch}`)] : []),
            ...(worktree ? [theme.fg("accent", `𖠰 ${worktree}`)] : []),
            ...statusParts.map((p) => theme.fg("text", p)),
          ];

          const line = segments.join(sep);
          return [truncateToWidth(line, width)];
        },
      };
    });
    refreshChildCost();
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (ctx.hasUI) ctx.ui.setFooter(undefined);
  });

  // Re-render on any state change
  pi.on("model_select", async () => refresh());
  pi.on("thinking_level_select", async () => refresh());
  pi.on("turn_end", async () => { refresh(); refreshChildCost(); });
  pi.on("agent_settled", async () => refreshChildCost());
  pi.on("session_compact", async () => { refresh(); refreshChildCost(); });
  pi.on("session_tree", async () => {
    childCost = 0;
    childCostIncomplete = false;
    refresh();
    refreshChildCost();
  });
  pi.on("message_end", async () => refresh());
  pi.on("agent_end", async () => refresh());
}
