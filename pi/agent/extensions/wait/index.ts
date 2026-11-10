import { Type } from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { poll } from './poll.ts';

export default function (pi: ExtensionAPI) {
  let active: AbortController | undefined;
  pi.on('session_shutdown', () => active?.abort());

  pi.registerCommand('wait', {
    description: 'Wait for an external condition, then continue (natural-language instructions)',
    handler: async (args, ctx) => {
      if (!args.trim()) {
        ctx.ui.notify('Usage: /wait on the CI jobs finishing, then examine the results', 'info');
        return;
      }
      pi.sendUserMessage(`Use the wait_for tool for this request. Identify the exact target and prepare an observational JSON check command first. ${args}`);
    },
  });

  pi.registerTool({
    name: 'wait_for',
    label: 'Wait',
    exposure: 'model-only',
    executionMode: 'sequential',
    description: `Block while waiting for an external condition without model calls between polls. Use when asked to watch CI, wait for review, or resume after a prerequisite. Call this tool ALONE, never with sibling tool calls (expiry must stop the agent loop). Identify and pin the exact repository/run/commit/review target first; do not follow new pushes silently. Check commands must be observational, never retry, push, post, or otherwise mutate. They run in the session working directory with existing credentials. Write a short script if shell quoting becomes complex.
The command must exit 0 and print ONLY JSON: {"state":"pending|success|failure|error|superseded","summary":"brief status","url":"optional link"}. Detect superseded revisions in the command when applicable. Missing/not-yet-created checks are pending, never success. Default: return failure on the first actionable failure; if asked to wait for all, implement that in the command. API/auth/parse problems are error, not CI failure. Three consecutive errors return control to you; pending resets the counter. The first check runs immediately; terminal results return immediately. Escape cancels. Expiry notifies the user and stops automatic continuation. After a terminal result, follow continuation under existing permissions.`,
    parameters: Type.Object({
      label: Type.String({ minLength: 1, maxLength: 200, description: 'Human-readable exact target' }),
      command: Type.String({ minLength: 1, description: 'Observational shell command returning the JSON contract' }),
      kind: Type.Union([Type.Literal('ci'), Type.Literal('review'), Type.Literal('other')]),
      continuation: Type.String({ minLength: 1, description: 'What to do after this wait completes; grants no new permissions' }),
      intervalSeconds: Type.Optional(Type.Integer({ minimum: 1, maximum: 86400, description: 'Default CI/other: 180; review: 1800' })),
      timeoutSeconds: Type.Optional(Type.Integer({ minimum: 1, maximum: 604800, description: 'Default CI/other: 7200; review: 86400. Expiry notifies user only.' })),
    }),
    async execute(_id, params, signal, onUpdate, ctx) {
      if (active) throw new Error('A wait is already active');
      const controller = new AbortController();
      active = controller;
      const combined = AbortSignal.any([controller.signal, ...(signal ? [signal] : [])]);
      const intervalSeconds = params.intervalSeconds ?? (params.kind === 'review' ? 1800 : 180);
      try {
        ctx.ui.setStatus('wait', `Waiting: ${params.label} · Esc to cancel`);
        const outcome = await poll({ intervalMs: intervalSeconds * 1000,
          deadlineMs: (params.timeoutSeconds ?? (params.kind === 'review' ? 86400 : 7200)) * 1000 },
        (checkSignal, timeout) => pi.exec('/bin/bash', ['-o', 'pipefail', '-c', params.command], {
          cwd: ctx.cwd, signal: checkSignal, timeout,
        }), combined, (check) => {
          ctx.ui.setStatus('wait', `Waiting: ${params.label} · ${check.summary.replace(/[\x00-\x1f\x7f]/g, ' ')} · poll every ${intervalSeconds}s · Esc to cancel`);
          onUpdate?.({ content: [{ type: 'text', text: `${params.label}: ${check.summary}` }], details: check });
        });
        if (outcome.state === 'expired') ctx.ui.notify(`Wait expired: ${params.label}. ${outcome.summary}`, 'warning');
        return {
          content: [{ type: 'text', text: JSON.stringify({ target: params.label, ...outcome, continuation: params.continuation }) }],
          details: outcome,
          ...(outcome.state === 'expired' ? { terminate: true } : {}),
        };
      } finally {
        active = undefined;
        ctx.ui.setStatus('wait', undefined);
      }
    },
  });
}
