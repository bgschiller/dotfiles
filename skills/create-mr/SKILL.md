---
name: create-mr
description: Create a GitHub PR or GitLab MR using conversation context
# Explicit invocation only; this is intentionally not an automatic skill trigger.
disable-model-invocation: true
---

# Create a Pull Request / Merge Request

Use the current conversation, commits, and diff to prepare a PR/MR. Always get Brian's approval of the draft before creating it.

Run Git and platform commands from the target repository. Resolve helper scripts from their skill directories, not the target project's `scripts/` directory:

```bash
MR_HELPER="$HOME/.agents/skills/create-mr/scripts/glab-mr-helper.sh"
REVIEW_HELPER="$HOME/.agents/skills/human-review/scripts/open-editor.sh"
```

If this discovery path is unavailable, resolve each helper against its own skill's `SKILL.md` directory.

## 1. Inspect the branch and platform

```bash
git remote get-url origin
git branch --show-current
git status --short
```

Use `gh` for GitHub and `glab` for GitLab. For an unfamiliar/self-hosted remote, establish the platform rather than guessing. Requires the matching CLI authenticated; the GitLab helper also requires `jq`.

Determine the base from the stack/project conventions. `git merge-target` is available in Brian's dotfiles; use it when appropriate. If that fails, inspect the repository's default branch and stack before choosing a base—do not silently assume `main`.

Check whether the branch exists on the intended remote and whether local commits are pushed. Obtain approval before any push; do not force-push merely to create a PR/MR.

## 2. Draft from context

With the chosen base:

```bash
git log --oneline "$TARGET"..HEAD
git diff "$TARGET"...HEAD
```

Follow the project's PR/MR template if present. Otherwise include:

- **Context:** what problem motivated the change.
- **Approach:** what changed and why.
- **Testing:** actual checks performed, including limitations.

Use a concise, imperative title of at most 80 characters. Incorporate relevant conversation reasoning, not just commit subjects. Never invent test results.

## 3. Review

Write a temporary Markdown file with the title on the first line and description below it. Use the `human-review` skill to open it, compare edits, and clean up afterward. Tell Brian what is being opened. Empty/whitespace-only content means abort.

Parse the approved title and description. Keep the description in a temporary file for safe CLI input. Do not delete unrelated `mr-*.md` files from the project.

## 4. Create the PR/MR

GitHub:

```bash
gh pr create --title "$TITLE" --body-file "$BODY_FILE" --base "$TARGET"
```

GitLab:

```bash
glab mr create --title "$TITLE" --description "$(<"$BODY_FILE")" \
  --target-branch "$TARGET" --remove-source-branch --yes
```

Do not enable squash automatically: it can disrupt git-branchless stacks. Follow the repository's merge policy and the selected stack tool's guidance.

For GitHub stacks managed with `gh stack`, consult `gh-stack` before creating a standalone PR; use the stack workflow if that is how the branches are managed. Do not create duplicate PRs.

## 5. Stacked GitLab MRs

If the chosen base is another feature branch, set a blocking relationship with its parent MR:

```bash
"$MR_HELPER" set-blocking <new-mr-number> "$TARGET"
```

The helper finds the parent's MR and adds the dependency. If the parent cannot be found or this operation fails, warn explicitly; do not claim the stack is configured. A non-`main` base alone does not establish a stack: the project may use another integration branch.

## 6. Report

Return the created URL and a copyable review request:

```text
Please review my PR to [TITLE](URL)
Please review my MR to [TITLE](URL)
```

Use only the line matching the platform. Clean up only the temporary files created for this invocation.
