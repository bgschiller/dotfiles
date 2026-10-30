# Pi subagent model routing

In Pi, use configured subagent models rather than Cursor model slugs from `.cursor/rules/pstack-models.mdc` or similar Cursor-specific routing files. Omit explicit model arguments so Pi's configured per-agent overrides apply, unless the user explicitly requests a model for that run. Keep the repository's shared Cursor configuration unchanged.
