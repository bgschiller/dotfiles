---
description: Review current branch changes or a GitHub/GitLab MR/PR URL using the Superhuman review skills
argument-hint: "[MR/PR URL or review instructions]"
---
Use the installed `review@superhuman-aidev` Pi skills to review code.

Arguments: $ARGUMENTS

If the arguments contain a GitHub pull request URL or GitLab merge request URL, load and follow the `review-url` skill with these exact arguments.

Otherwise, review the current branch's local changes. Prefer the `pre-review-medium` skill for a thorough bounded review; use any extra arguments above as `$ADDITIONAL_INSTRUCTIONS`. Detect the base ref and head ref from git, scope findings only to changed lines, and return actionable findings with severity, confidence, file/line, impact, and suggested fix.
