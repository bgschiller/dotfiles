---
name: create-mr
description: Create a GitHub PR or GitLab MR using conversation context
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash(git:*)
  - Bash(gh pr create:*)
  - Bash(gh repo view:*)
  - Bash(glab mr create:*)
  - Bash(glab repo view:*)
  - Bash(~/.claude/skills/create-mr/scripts/glab-mr-helper.sh:*)
  - Bash(~/.claude/skills/human-review/scripts/open-editor.sh:*)
---

# Create Merge Request / Pull Request

Create a GitHub pull request or GitLab merge request using the context already
present in this Claude session. Detect the platform from the origin URL and use
the matching CLI.

## Detect platform

```bash
ORIGIN_URL=$(git remote get-url origin)
if [[ "$ORIGIN_URL" =~ github\.com ]]; then
  REPO_TYPE=github  # use gh
elif [[ "$ORIGIN_URL" =~ gitlab ]]; then
  REPO_TYPE=gitlab  # use glab
fi
```

## CLI reference

GitHub (`gh`):

```bash
# Create PR
gh pr create --title "Title" --body "Body" --base main

# View repo info
gh repo view
```

GitLab (`glab`):

```bash
# Create MR
glab mr create --title "Title" --description "Body" --target-branch main --remove-source-branch --squash-before-merge --yes

# View project info (includes project ID)
glab repo view

# List open MRs (useful for finding parent MRs)
glab mr list --state opened
```

For GitLab-specific API operations (finding parent MRs, creating blocking
relationships), use the helper script at
`~/.claude/skills/create-mr/scripts/glab-mr-helper.sh`. There is no GitHub
equivalent — see step 6.

## Steps

### 1. Check if branch is pushed to origin

```bash
git branch --show-current | sed 's|^|origin/|g' | xargs git rev-parse --verify
```

If this fails, push the branch:

```bash
git push -u origin $(git branch --show-current)
```

### 2. Determine target branch

```bash
git merge-target || echo 'main'
```

### 3. Generate title and description

Review the commits and diffs:

```bash
# Get target branch
TARGET=$(git merge-target || echo 'main')

# See all commits
git log --oneline $TARGET..HEAD

# See full commit messages
git log $TARGET..HEAD

# See the complete diff
git diff $TARGET...HEAD
```

#### Title Guidelines

- Max 80 characters
- Imperative mood ("Add feature" not "Added feature")
- Concise but descriptive

#### Description Guidelines

Brian's preferred description format:

1. **Context first**: Explain the problem or need that motivated this change
2. **Approach**: Describe what you did and why you chose this approach
3. **Testing**: How was this tested? Include manual testing steps if applicable
4. **Conversation context**: Reference relevant discussion from this Claude session

Check for templates:
- GitLab: `.gitlab/merge_request_templates/Default.md` or `.gitlab/merge_request_templates/default.md`
- GitHub: `.github/pull_request_template.md` or `.github/PULL_REQUEST_TEMPLATE.md`

If a template exists, follow its structure.

### 4. Open content in editor

Write the draft to a file in the current directory:

```bash
# Filename: mr-<sanitized-branch-name>.md
# Format:
# Title here
#
# Description starts here
# and continues...
```

Open the file for Brian to review and edit:

```bash
~/.claude/skills/human-review/scripts/open-editor.sh mr-branch-name.md
```

After Brian saves and closes:
- Parse title from first line (strip leading `#` if present)
- Parse description from remaining content
- If file is empty/whitespace only, abort
- Delete the temp file after parsing

### 5. Create the MR or PR

Use the invocation that matches `REPO_TYPE`.

GitHub:

```bash
gh pr create \
  --title "Title from editor" \
  --body "Description from editor" \
  --base "$TARGET"
```

GitLab:

```bash
glab mr create \
  --title "Title from editor" \
  --description "Description from editor" \
  --target-branch "$TARGET" \
  --remove-source-branch \
  --squash-before-merge \
  --yes
```

Extract the URL and number from the output (the URL ends in the number).

### 6. Handle stacked MRs (GitLab only)

**When the target branch is not `main`**, this is a stacked change.

On **GitLab**, set up a blocking dependency so the parent must merge first:

```bash
~/.claude/skills/create-mr/scripts/glab-mr-helper.sh set-blocking <this-mr-number> <target-branch>
```

The helper:
1. Finds the open MR where source branch = our target branch (the parent MR)
2. Creates a blocking relationship so the parent must merge first

If the parent MR can't be found or the blocking setup fails, warn but don't fail the whole operation.

On **GitHub**, skip this step. GitHub has no blocking-PR API. The PR is created
against the chosen target branch and that's it.

### 7. Generate Slack review request

Output for Brian to copy. Use "MR" for GitLab, "PR" for GitHub:

```
Please review my MR to [$TITLE]($URL)
Please review my PR to [$TITLE]($URL)
```

## Key Points

- Leverage conversation context from this Claude session
- The description should reflect the reasoning and discussion, not just commits
- Always confirm with Brian before creating the MR/PR
- Handle errors gracefully and report them clearly

## Example Workflow

```
Claude: "I see you're on branch feature/add-validation in a GitHub repo. Let me check if it's pushed..."
Claude: "Branch is pushed. Target branch is 'develop'."
Claude: "Based on our work, here's the proposed PR:

Title: Add input validation to user registration

Description:
## Summary
Implement comprehensive input validation...

Does this look good? Should I proceed?"

Brian: "yes"

Claude: [creates PR via gh, shows Slack message]
```
