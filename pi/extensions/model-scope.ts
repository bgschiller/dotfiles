import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type Scope = "personal" | "work" | "unscoped";

const HOME = process.env.HOME ?? "";
const WORK_ROOT = path.join(HOME, "work");
const DOTFILES_ROOT = path.join(HOME, "dotfiles");

const DEFAULTS: Record<Exclude<Scope, "unscoped">, { provider: string; model: string }> = {
  personal: { provider: "deepseek", model: "deepseek-v4-pro" },
  work: { provider: "openai-codex", model: "gpt-5.5" },
};

const ALLOWED_PROVIDERS: Record<Exclude<Scope, "unscoped">, Set<string>> = {
  personal: new Set(["deepseek"]),
  work: new Set([
    "anthropic",
    "openai",
    "openai-codex",
    "azure-openai-responses",
  ]),
};

function isInside(parent: string, candidate: string): boolean {
  const rel = path.relative(parent, candidate);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function scopeFor(cwd: string): Scope {
  const resolved = path.resolve(cwd);
  if (HOME && isInside(WORK_ROOT, resolved)) return "work";
  if (HOME && isInside(DOTFILES_ROOT, resolved)) return "work";
  return "personal";
}

function modelName(model: { provider?: string; id?: string } | undefined): string {
  if (!model) return "<none>";
  return `${model.provider ?? "<unknown>"}/${model.id ?? "<unknown>"}`;
}

function isAllowed(scope: Scope, model: { provider?: string } | undefined): boolean {
  if (scope === "unscoped" || !model?.provider) return true;
  return ALLOWED_PROVIDERS[scope].has(model.provider);
}

function explain(scope: Scope, cwd: string, model: { provider?: string; id?: string } | undefined): string {
  const allowed = scope === "unscoped"
    ? "any provider"
    : Array.from(ALLOWED_PROVIDERS[scope]).sort().join(", ");
  return `Model ${modelName(model)} is not allowed in ${cwd} (scope: ${scope}; allowed providers: ${allowed}).`;
}

export default function modelScope(pi: ExtensionAPI) {
  let correcting = false;

  async function switchToDefault(scope: Scope, ctx: any) {
    if (scope === "unscoped" || correcting) return;
    const fallback = DEFAULTS[scope];
    const model = ctx.modelRegistry.find(fallback.provider, fallback.model);
    if (!model) {
      ctx.ui.notify(
        `Pi model scope: default ${fallback.provider}/${fallback.model} was not found.`,
        "error",
      );
      return;
    }

    correcting = true;
    try {
      const ok = await pi.setModel(model);
      ctx.ui.notify(
        ok
          ? `Pi model scope: switched to ${fallback.provider}/${fallback.model}.`
          : `Pi model scope: no API key for ${fallback.provider}/${fallback.model}.`,
        ok ? "info" : "error",
      );
    } finally {
      correcting = false;
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    const scope = scopeFor(ctx.cwd);
    if (!isAllowed(scope, ctx.model)) {
      ctx.ui.notify(explain(scope, ctx.cwd, ctx.model), "error");
      await switchToDefault(scope, ctx);
    }
  });

  pi.on("model_select", async (event, ctx) => {
    const scope = scopeFor(ctx.cwd);
    if (!isAllowed(scope, event.model)) {
      ctx.ui.notify(explain(scope, ctx.cwd, event.model), "error");
      await switchToDefault(scope, ctx);
    }
  });

  pi.on("input", (event, ctx) => {
    const scope = scopeFor(ctx.cwd);
    if (!isAllowed(scope, ctx.model)) {
      const message = explain(scope, ctx.cwd, ctx.model);
      ctx.ui.notify(message, "error");
      if (ctx.mode === "print" || ctx.mode === "json") console.error(message);
      return { action: "handled" as const };
    }
  });

  pi.on("before_provider_request", (_event, ctx) => {
    const scope = scopeFor(ctx.cwd);
    if (!isAllowed(scope, ctx.model)) {
      throw new Error(explain(scope, ctx.cwd, ctx.model));
    }
  });

  pi.registerCommand("model-scope", {
    description: "Show the active personal/work model scope policy",
    handler: async (_args, ctx) => {
      const scope = scopeFor(ctx.cwd);
      const allowed = scope === "unscoped"
        ? "any provider"
        : Array.from(ALLOWED_PROVIDERS[scope]).sort().join(", ");
      ctx.ui.notify(
        `Pi model scope: ${scope}; cwd: ${ctx.cwd}; current: ${modelName(ctx.model)}; allowed providers: ${allowed}`,
        "info",
      );
    },
  });
}
