# Slash-command usage ranking

`pi/agent/extensions/slash-command-usage.ts` wraps Pi's autocomplete provider.
Run `/reload` after adding or changing it.

Accepting a slash-command completion with Tab or Enter increments its count.
Merely displaying a suggestion does not count. Manually typed commands that
bypass completion do not count; accepting a completion and then abandoning the
prompt still counts. Existing command history is not imported.

Exact matches come first, then prefix matches, then fuzzy matches. Within each
group, more frequently selected commands come first. Equal counts preserve Pi's
original ordering. File and argument completions are unchanged.

Counts are shared across Pi sessions in `~/.pi/agent/slash-command-usage.jsonl`
(or the configured Pi agent directory). Only command names are stored, not
arguments or prompts. The journal is gitignored. Delete it to reset ranking.

Run the tests against the locally installed managed Pi version:

```sh
node --test pi/tests/slash-command-usage.test.mjs
```

The tests include Pi's real extension loader and editor Tab-completion path.
