# Pi subagent model routing

In Pi, use configured subagent models rather than Cursor model slugs from `.cursor/rules/pstack-models.mdc` or similar Cursor-specific routing files. Omit explicit model arguments so Pi's configured per-agent overrides apply, unless the user explicitly requests a model for that run. Keep the repository's shared Cursor configuration unchanged.

Use `reviewer` for independent reviews, `worker` for implementation, and `scout` for exploration. Before using an unfamiliar agent name, call `subagent({ action: "list" })`; do not assume names from other harnesses, such as `general-purpose`, exist in Pi.

The built-in `reviewer` has no shell/Git access. For committed code reviews, prepare a saved diff outside the repository and provide its absolute path, the base/head SHAs, and relevant source paths in the handoff. Keep the review read-only; do not broaden its tools just to retrieve a diff.
