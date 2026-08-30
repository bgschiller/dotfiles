import type {
  ExtensionAPI,
  ExtensionContext,
  MessageUpdateEvent,
} from "@earendil-works/pi-coding-agent";
import { appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Stall detector: watches the LLM request/response lifecycle and, when no
 * progress has been made for a while, shows a plain-English widget describing
 * exactly which phase we're stuck in and why. Diagnostic-only: it never aborts
 * or retries. You still decide when to hit Esc.
 *
 * Phases:
 *   A "connecting"  before_provider_request -> after_provider_response
 *                   (uploading context + waiting for the server's first byte)
 *   B "waiting"     after_provider_response -> first message_update
 *                   (server accepted the request but has produced no tokens)
 *   C "streaming"   between message_update events (stream started then stalled)
 */

// ---- Tunable thresholds (seconds). Adjust freely. --------------------------
const CONFIG = {
  // Per-phase seconds-without-progress before we flag a stall.
  thresholdConnecting: 10,
  thresholdWaiting: 20,
  thresholdStreaming: 15,
  // How often the widget re-renders while stalled (live ticking).
  tickSeconds: 1,
  // Append each stall episode (start + resolution) here for pattern analysis.
  logFile: join(homedir(), ".pi", "stall-log.jsonl"),
};

type Phase = "connecting" | "waiting" | "streaming" | "idle";

const PHASE_LABEL: Record<Phase, string> = {
  connecting:
    "Sending the request — uploading context and waiting for the server's first byte",
  waiting:
    "Server accepted the request but has sent no tokens yet — likely server-side prefill or a stalled/dead stream",
  streaming: "Stream started then went quiet mid-response",
  idle: "Idle",
};

const WIDGET_KEY = "stall-detector";
const STATUS_KEY = "stall-detector";

export default function (pi: ExtensionAPI) {
  // Per-request lifecycle state.
  let phase: Phase = "idle";
  let requestStart = 0; // ms, when before_provider_request fired
  let responseAt: number | null = null; // ms, when after_provider_response fired
  let lastProgress = 0; // ms, last moment we saw forward progress
  let httpStatus: number | null = null;
  let headers: Record<string, string> = {};
  let uploadTokens: number | null = null;
  const counts = { thinking: 0, text: 0, toolcall: 0 };

  let flagged = false; // are we currently showing a stall warning?
  let flaggedAt = 0; // ms, when we first flagged the current episode
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastCtx: ExtensionContext | undefined;

  const now = () => Date.now();
  const secs = (fromMs: number) => Math.floor((now() - fromMs) / 1000);
  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  function thresholdFor(p: Phase): number {
    if (p === "connecting") return CONFIG.thresholdConnecting;
    if (p === "waiting") return CONFIG.thresholdWaiting;
    if (p === "streaming") return CONFIG.thresholdStreaming;
    return Number.POSITIVE_INFINITY;
  }

  function logEpisode(kind: "stall" | "resolved") {
    try {
      const record = {
        ts: new Date().toISOString(),
        event: kind,
        phase,
        model: modelName(),
        stalledForSec: kind === "resolved" ? secs(flaggedAt) : secs(lastProgress),
        requestAgeSec: requestStart ? secs(requestStart) : null,
        httpStatus,
        retryAfter: headers["retry-after"] ?? null,
        uploadTokens,
        streamCounts: { ...counts },
      };
      appendFileSync(CONFIG.logFile, JSON.stringify(record) + "\n");
    } catch {
      // Never let logging break the session.
    }
  }

  function modelName(): string {
    const m = lastCtx?.model as { provider?: string; id?: string } | undefined;
    if (!m) return "unknown model";
    return `${m.provider ?? "?"}/${m.id ?? "?"}`;
  }

  function renderWidget(ctx: ExtensionContext) {
    const sinceProgress = secs(lastProgress);
    const lines: string[] = [];

    lines.push(`\u26A0 LLM appears stalled \u2014 no progress for ${fmt(sinceProgress)}`);
    lines.push(`What: ${PHASE_LABEL[phase]}`);
    lines.push(`Model: ${modelName()}`);

    // Timeline
    const reqAge = requestStart ? `${fmt(secs(requestStart))} ago` : "n/a";
    const respAge =
      responseAt === null
        ? "no HTTP response observed yet"
        : `${fmt(secs(responseAt))} ago`;
    const tokenAge =
      counts.thinking + counts.text + counts.toolcall === 0
        ? "none received"
        : `${fmt(sinceProgress)} ago`;
    lines.push(
      `Timeline: request sent ${reqAge} | HTTP response ${respAge} | last token ${tokenAge}`,
    );

    // HTTP status + notable headers
    if (httpStatus !== null) {
      const notable: string[] = [];
      if (headers["retry-after"]) notable.push(`retry-after=${headers["retry-after"]}`);
      for (const h of Object.keys(headers)) {
        if (/ratelimit/i.test(h)) notable.push(`${h}=${headers[h]}`);
      }
      lines.push(
        `HTTP: ${httpStatus}${notable.length ? " | " + notable.join(" ") : ""}`,
      );
    } else {
      lines.push(
        `HTTP: no response yet (Phase A: connecting/uploading or waiting for first byte)`,
      );
    }

    // Stream tallies
    lines.push(
      `Stream activity: ${counts.thinking} thinking, ${counts.text} text, ${counts.toolcall} tool-call deltas`,
    );

    // Context size
    if (uploadTokens !== null) {
      lines.push(`Context uploaded: ~${uploadTokens.toLocaleString()} tokens`);
    }

    lines.push(`Hint: Esc to cancel, then "please continue". Log: ${CONFIG.logFile}`);

    ctx.ui.setWidget(WIDGET_KEY, lines);
    ctx.ui.setStatus(STATUS_KEY, `\u26A0 LLM stalled ${fmt(sinceProgress)} \u2014 see widget`);
  }

  function clearWidget(ctx: ExtensionContext | undefined) {
    ctx?.ui.setWidget(WIDGET_KEY, undefined);
    ctx?.ui.setStatus(STATUS_KEY, undefined);
    if (flagged) {
      logEpisode("resolved");
      flagged = false;
    }
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
  }

  function startTimer(ctx: ExtensionContext) {
    lastCtx = ctx;
    if (timer) return;
    timer = setInterval(() => {
      if (phase === "idle" || !lastCtx) return;
      const sinceProgress = secs(lastProgress);
      if (sinceProgress >= thresholdFor(phase)) {
        if (!flagged) {
          flagged = true;
          flaggedAt = now();
          logEpisode("stall");
        }
        renderWidget(lastCtx);
      }
    }, CONFIG.tickSeconds * 1000);
    // Don't keep the event loop alive just for this.
    (timer as unknown as { unref?: () => void }).unref?.();
  }

  function markProgress(ctx: ExtensionContext) {
    lastProgress = now();
    if (flagged) clearWidget(ctx); // resumed after a warning
  }

  // ---- Lifecycle wiring ----------------------------------------------------

  pi.on("before_provider_request", (_event, ctx) => {
    phase = "connecting";
    requestStart = now();
    responseAt = null;
    lastProgress = now();
    httpStatus = null;
    headers = {};
    counts.thinking = 0;
    counts.text = 0;
    counts.toolcall = 0;
    const usage = ctx.getContextUsage?.();
    uploadTokens = usage?.tokens ?? null;
    if (flagged) clearWidget(ctx);
    startTimer(ctx);
  });

  pi.on("after_provider_response", (event, ctx) => {
    phase = "waiting";
    responseAt = now();
    httpStatus = event.status;
    headers = event.headers ?? {};
    markProgress(ctx);
    // A non-2xx with no stream is its own diagnostic; surface immediately.
    if (event.status >= 400) {
      flagged = true;
      flaggedAt = now();
      logEpisode("stall");
      renderWidget(ctx);
    }
  });

  pi.on("message_update", (event: MessageUpdateEvent, ctx) => {
    const t = event.assistantMessageEvent?.type;
    // Stream finished: the provider request is complete. Go idle so tool
    // execution (e.g. a long bash command) isn't misread as a stalled stream.
    if (t === "done" || t === "error") {
      endTurn(ctx);
      return;
    }
    phase = "streaming";
    if (t === "thinking_delta" || t === "thinking_start") counts.thinking++;
    else if (t === "text_delta" || t === "text_start") counts.text++;
    else if (t === "toolcall_delta" || t === "toolcall_start") counts.toolcall++;
    markProgress(ctx);
  });

  // Tool execution is not an LLM wait; stop watching until the next request.
  pi.on("tool_execution_start", (_event, ctx) => endTurn(ctx));

  function endTurn(ctx: ExtensionContext | undefined) {
    phase = "idle";
    clearWidget(ctx);
  }

  pi.on("turn_end", (_event, ctx) => endTurn(ctx));
  pi.on("agent_end", (_event, ctx) => {
    endTurn(ctx);
    stopTimer();
  });
  pi.on("session_shutdown", (_event, ctx) => {
    stopTimer();
    clearWidget(ctx);
  });
}
