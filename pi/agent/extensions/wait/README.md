# Blocking waits

Reload Pi with `/reload`, then ask normally or use:

```text
/wait on the CI jobs finishing, then examine the results
/wait for review on this PR, then address feedback
```

The agent identifies a fixed target, prepares an observational shell command, and calls `wait_for`. The tool checks immediately, then polls without model calls. Escape cancels both running checks and polling delays. Nothing persists after the session closes.

Commands run in the session working directory using `/bin/bash -o pipefail`, with existing credentials. They must exit zero and print only JSON:

```json
{"state":"pending","summary":"2 jobs still running","url":"https://example.com/run/123"}
```

States: `pending`, `success`, `failure`, `error`, `superseded`. A terminal result resumes the agent with the recorded continuation instruction. Three consecutive check errors also resume the agent; a valid pending result resets the error count. Commands must detect revision changes when relevant and must not treat missing checks as success. They must not perform mutations; this is an instruction, not a shell sandbox.

Defaults:

| Kind | Poll interval | Deadline |
|---|---|---|
| CI / other | 3 minutes | 2 hours |
| Review | 30 minutes | 24 hours |

Both values can be overridden by the agent. Each command has a 60-second execution limit, bounded by the overall deadline. Expiry displays a notification and returns `terminate: true`, stopping automatic model follow-up. The tool is model-only and must be called alone: Pi only honors termination when every tool in a batch agrees.

Test from the repository root:

```sh
node --test pi/tests/wait*.test.mjs
```

The integration tests load the extension through the locally installed Pi loader and execute real shell commands, including cancellation and expiry. They do not exercise interactive keyboard input or a live CI provider.
