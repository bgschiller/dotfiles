/**
 * my-bar — a custom footer extension based on pi-bar that adds a session cost segment.
 *
 * Segments (left to right):
 *   <model>  ❯  think:<level>  ❯  <context% / window>  ❯  $<session cost>  ❯  <extension statuses>
 *
 * Example:
 *   claude-sonnet-4-6  ❯  think:off  ❯  2.6% / 200k  ❯  $0.0142  ❯  stash:3 items
 *
 * Drop-in replacement for pi-bar. Disable pi-bar in settings.json and load this instead.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
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

/** Sum cost.total across all assistant messages in the current branch. */
function computeSessionCost(ctx: ExtensionContext): number {
  let total = 0;
  for (const entry of ctx.sessionManager.getBranch()) {
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

// ── extension ─────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  let requestRender: (() => void) | undefined;
  const refresh = () => requestRender?.();

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    ctx.ui.setFooter((tui, theme, footerData) => {
      requestRender = () => tui.requestRender();

      return {
        dispose() {
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

          const sessionCost = computeSessionCost(ctx);
          const costText = formatCost(sessionCost);

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
            ...statusParts.map((p) => theme.fg("text", p)),
          ];

          const line = segments.join(sep);
          return [truncateToWidth(line, width)];
        },
      };
    });
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (ctx.hasUI) ctx.ui.setFooter(undefined);
  });

  // Re-render on any state change
  pi.on("model_select", async () => refresh());
  pi.on("thinking_level_select", async () => refresh());
  pi.on("turn_end", async () => refresh());
  pi.on("message_end", async () => refresh());
  pi.on("agent_end", async () => refresh());
}
