import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
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
  pi.on("agent_end", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    runClaudeAttention();
  });
}
