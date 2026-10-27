import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

export default function (pi: ExtensionAPI) {
  const command = path.join(os.homedir(), "bin", "get-user-attention");
  let subagentsReady = false;
  pi.events.on("subagents:rpc:v1:ready", () => { subagentsReady = true; });

  async function childrenFinished() {
    if (!subagentsReady) return true;
    // Query current-session state, including runs restored after /reload or /resume.
    const requestId = `attention-${randomUUID()}`;
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => { unsubscribe(); resolve(false); }, 1000);
      const unsubscribe = pi.events.on(`subagents:rpc:v1:reply:${requestId}`, (reply: unknown) => {
        clearTimeout(timer);
        unsubscribe();
        if (!reply || typeof reply !== "object" || !("success" in reply) || reply.success !== true ||
            !("data" in reply) || !reply.data || typeof reply.data !== "object" ||
            !("fleet" in reply.data) || !reply.data.fleet || typeof reply.data.fleet !== "object") {
          resolve(false);
          return;
        }
        const fleet = reply.data.fleet;
        resolve("version" in fleet && fleet.version === 1 && "totalActive" in fleet && fleet.totalActive === 0);
      });
      pi.events.emit("subagents:rpc:v1:request", { version: 1, requestId, method: "status" });
    });
  }

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
    // Parent settlement can follow a supervisor reply while children keep working.
    if (!await childrenFinished()) return;
    try {
      await pi.exec(command, ["--state", "done", "--app", "pi", "Pi is ready for your attention"]);
    } catch { /* Notification failures must not interrupt Pi. */ }
  });
}
