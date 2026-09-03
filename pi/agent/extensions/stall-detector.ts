import type {
  ExtensionAPI,
  ExtensionContext,
  MessageUpdateEvent,
} from "@earendil-works/pi-coding-agent";

type UserMessageContent = Parameters<ExtensionAPI["sendUserMessage"]>[0];
import { appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";

/**
 * Stall detector: watches the LLM request/response lifecycle and, when no
 * progress has been made for a while, shows a plain-English widget describing
 * exactly which phase we're stuck in and why.
 *
 * Phases:
 *   A "connecting"  before_provider_request -> after_provider_response
 *                   (uploading context + waiting for the server's first byte)
 *   B "waiting"     after_provider_response -> first message_update
 *                   (server accepted the request but has produced no tokens)
 *   C "streaming"   between message_update events (stream started then stalled)
 *
 * Known-cause auto-recovery:
 *   Log analysis (2026-08-28 through 09-03, 112+ stall episodes) found that
 *   94% of Anthropic connecting/waiting stalls begin within a few minutes of
 *   a wall-clock :00 or :30 boundary -- consistent with an account-level
 *   quota/metering job on a 30-minute cadence, not a real network problem.
 *   No 429/retry-after is ever returned, so there's nothing to back off on
 *   except time. For that specific signature (phase connecting/waiting,
 *   provider anthropic) we no longer page the human: we silently cancel the
 *   stuck request and resubmit once the boundary window has passed, since
 *   retrying immediately just re-enters the same throttle window. Other
 *   stalls (mid-stream, non-Anthropic) still get the old chime + widget and
 *   are left for the human to handle.
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
  // Command run once per stall to request attention (chime + tmux status).
  attentionCommand: "claude-attention",

  // ---- Known-throttle auto-retry ----
  // Enable silent cancel+resubmit for the diagnosed Anthropic boundary throttle.
  autoRetryEnabled: true,
  // Minutes-of-hour that are safely past the :00/:30 throttle window.
  retryTargetMinutes: [1, 31],
  // Extra cushion added past the target minute, in seconds.
  retryBufferSec: 0,
  // Message sent to resume the agent after the silent cancel+resubmit.
  retryMessage:
    "(auto-resumed after a known Anthropic API throttle stall) Please continue exactly where you left off.",
};

function requestAttention() {
  try {
    execFile(CONFIG.attentionCommand, [], () => {
      // Fire-and-forget; ignore missing binary or errors.
    });
  } catch {
    // Never let attention signaling break the session.
  }
}

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

/** Next wall-clock time (ms) matching one of CONFIG.retryTargetMinutes. */
function nextRetryTarget(fromMs: number): number {
  const minutes = [...CONFIG.retryTargetMinutes].sort((a, b) => a - b);
  // Check this hour and next hour's candidates in order; take the first one
  // strictly in the future. (Two hours is enough margin for any sane buffer.)
  for (let hourOffset = 0; hourOffset <= 1; hourOffset++) {
    for (const m of minutes) {
      const candidate = new Date(fromMs);
      candidate.setHours(candidate.getHours() + hourOffset, m, CONFIG.retryBufferSec, 0);
      if (candidate.getTime() > fromMs) return candidate.getTime();
    }
  }
  // Unreachable in practice (would need retryBufferSec >= 3600s).
  const fallback = new Date(fromMs);
  fallback.setHours(fallback.getHours() + 2, minutes[0], CONFIG.retryBufferSec, 0);
  return fallback.getTime();
}

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

  // Auto-retry state for the known Anthropic boundary throttle.
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTargetMs: number | null = null;
  let abortedByUs = false; // true while our own scheduled abort is in flight
  // If the last committed entry was a plain user message (nothing produced
  // yet for this turn -- no tool call, no thinking/text), resend that exact
  // message instead of a generic "please continue", since there's nothing to
  // continue from. Captured right before abort, since that's the last point
  // the transcript reflects only prior turns.
  let resumeContent: UserMessageContent | null = null;

  const now = () => Date.now();
  const secs = (fromMs: number) => Math.floor((now() - fromMs) / 1000);
  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.max(s, 0) % 60).padStart(2, "0")}`;
  const clockOf = (ms: number) => new Date(ms).toLocaleTimeString([], { hour12: false });

  function thresholdFor(p: Phase): number {
    if (p === "connecting") return CONFIG.thresholdConnecting;
    if (p === "waiting") return CONFIG.thresholdWaiting;
    if (p === "streaming") return CONFIG.thresholdStreaming;
    return Number.POSITIVE_INFINITY;
  }

  function modelName(): string {
    const m = lastCtx?.model as { provider?: string; id?: string } | undefined;
    if (!m) return "unknown model";
    return `${m.provider ?? "?"}/${m.id ?? "?"}`;
  }

  function isAnthropic(): boolean {
    return modelName().startsWith("anthropic/");
  }

  /** Is this stall the diagnosed known-cause pattern we auto-recover from? */
  function isKnownThrottle(): boolean {
    return CONFIG.autoRetryEnabled && isAnthropic() && (phase === "connecting" || phase === "waiting");
  }

  function logEpisode(kind: "stall" | "resolved" | "auto-retry-scheduled" | "auto-retry-fired", extra?: Record<string, unknown>) {
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
        ...extra,
      };
      appendFileSync(CONFIG.logFile, JSON.stringify(record) + "\n");
    } catch {
      // Never let logging break the session.
    }
  }

  // ---- Known-throttle auto-retry scheduling --------------------------------

  function cancelRetry() {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = undefined;
    }
    retryTargetMs = null;
  }

  function scheduleRetry(ctx: ExtensionContext) {
    if (retryTimer) return; // already scheduled for this episode
    retryTargetMs = nextRetryTarget(now());
    const delay = Math.max(0, retryTargetMs - now());
    logEpisode("auto-retry-scheduled", { retryTargetMs, retryTargetClock: clockOf(retryTargetMs) });
    retryTimer = setTimeout(() => performRetry(ctx), delay);
    (retryTimer as unknown as { unref?: () => void }).unref?.();
  }

  function performRetry(ctx: ExtensionContext) {
    retryTimer = undefined;
    resumeContent = null;
    try {
      const leaf = ctx.sessionManager?.getLeafEntry?.();
      if (leaf?.type === "message" && leaf.message?.role === "user") {
        resumeContent = leaf.message.content as UserMessageContent;
      }
    } catch {
      resumeContent = null;
    }
    logEpisode("auto-retry-fired", { resumeMode: resumeContent !== null ? "reprompt" : "continue" });
    abortedByUs = true;
    try {
      ctx.abort();
    } catch {
      abortedByUs = false;
    }
  }

  // ---- Widget rendering -----------------------------------------------------

  function renderWidget(ctx: ExtensionContext) {
    const sinceProgress = secs(lastProgress);
    const lines: string[] = [];
    const throttle = isKnownThrottle();

    if (throttle) {
      lines.push(`\u23F3 Known Anthropic throttle \u2014 no progress for ${fmt(sinceProgress)}`);
      lines.push(
        `What: ${PHASE_LABEL[phase]}. This matches the recurring :00/:30 boundary stall (see stall-log.jsonl analysis) \u2014 not a real error, nothing to act on.`,
      );
    } else {
      lines.push(`\u26A0 LLM appears stalled \u2014 no progress for ${fmt(sinceProgress)}`);
      lines.push(`What: ${PHASE_LABEL[phase]}`);
    }
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

    if (throttle && retryTargetMs !== null) {
      const remaining = Math.max(0, Math.round((retryTargetMs - now()) / 1000));
      lines.push(
        `Auto-retry: will silently cancel and resubmit at ${clockOf(retryTargetMs)} (in ${fmt(remaining)}). No action needed.`,
      );
    } else {
      lines.push(`Hint: Esc to cancel, then "please continue". Log: ${CONFIG.logFile}`);
    }

    ctx.ui.setWidget(WIDGET_KEY, lines);
    const statusPrefix = throttle ? "\u23F3 Anthropic throttle" : "\u26A0 LLM stalled";
    const statusSuffix =
      throttle && retryTargetMs !== null
        ? ` \u2014 retry ${clockOf(retryTargetMs)}`
        : ` ${fmt(sinceProgress)} \u2014 see widget`;
    ctx.ui.setStatus(STATUS_KEY, `${statusPrefix}${statusSuffix}`);
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
          if (isKnownThrottle()) {
            scheduleRetry(lastCtx);
          } else {
            requestAttention();
          }
        }
        renderWidget(lastCtx);
      }
    }, CONFIG.tickSeconds * 1000);
    // Don't keep the event loop alive just for this.
    (timer as unknown as { unref?: () => void }).unref?.();
  }

  function markProgress(ctx: ExtensionContext) {
    lastProgress = now();
    cancelRetry(); // stall resolved on its own; no need to auto-retry anymore
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
    cancelRetry();
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
      requestAttention();
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
    cancelRetry();
    if (abortedByUs) {
      abortedByUs = false;
      const content = resumeContent;
      resumeContent = null;
      if (ctx) {
        try {
          // We can't be sure the agent has fully settled to idle right
          // after our own abort (agent_end can fire slightly before that),
          // so always specify deliverAs to avoid the "Agent is already
          // processing" error and let it queue if needed.
          pi.sendUserMessage(content ?? CONFIG.retryMessage, { deliverAs: "followUp" });
        } catch {
          // Never let the resubmit break the session; user can retry manually.
        }
      }
    }
  }

  pi.on("turn_end", (_event, ctx) => endTurn(ctx));
  pi.on("agent_end", (_event, ctx) => {
    endTurn(ctx);
    stopTimer();
  });
  pi.on("session_shutdown", (_event, ctx) => {
    cancelRetry();
    stopTimer();
    clearWidget(ctx);
  });
}
