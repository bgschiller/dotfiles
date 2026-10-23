import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import os from "node:os";
import path from "node:path";

export default function (pi: ExtensionAPI) {
  const command = path.join(os.homedir(), "bin", "get-user-attention");
  pi.on("agent_start", async (_event, ctx) => {
    // hasUI includes RPC clients; only the interactive owner should report status.
    // In-process subagents bind their extensions in print mode.
    if (ctx.mode !== "tui") return;
    try {
      await pi.exec(command, ["--state", "working", "--app", "pi", "--quiet", "Pi is working"]);
    } catch { /* Notification failures must not interrupt Pi. */ }
  });
  pi.on("agent_settled", async (_event, ctx) => {
    if (ctx.mode !== "tui") return;
    // Unlike agent_end, settlement waits for retries and automatic continuations.
    try {
      await pi.exec(command, ["--state", "done", "--app", "pi", "Pi is ready for your attention"]);
    } catch { /* Notification failures must not interrupt Pi. */ }
  });
}
