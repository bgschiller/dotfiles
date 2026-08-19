import type { AgentEndEvent, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

function runClaudeAttention() {
  const command = path.join(os.homedir(), "bin", "claude-attention");
  const child = spawn(command, [], {
    detached: true,
    stdio: "ignore",
  });

  child.on("error", () => {
    // Swallow spawn errors so the extension never crashes pi.
  });

  child.unref();
}

export default function (pi: ExtensionAPI) {
  pi.on("agent_end", async (event, ctx) => {
    if (!ctx.hasUI) return;
    // pi adds a `willRetry` flag to agent_end when it stopped on a retryable
    // error (e.g. a transient connection error) and is going to retry
    // automatically. Skip the chime in that case so we don't get pestered for
    // every blip. When retries are exhausted (or the turn ended normally),
    // willRetry is false and we still chime.
    if ((event as AgentEndEvent & { willRetry?: boolean }).willRetry) return;
    runClaudeAttention();
  });
}
