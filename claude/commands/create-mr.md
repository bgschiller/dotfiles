---
allowed_tools:
  - Bash(git rev-parse:*)
  - Bash(git push:*)
  - Bash(git merge-target:*)
  - Bash(git log:*)
  - Bash(git show:*)
  - Bash(git diff:*)
  - Bash(glab mr create:*)
  - Bash(glab repo view:*)
  - Bash(glab api:*)
---

# Create Merge Request

Create a GitLab merge request using the context already present in this Claude session.

## Context

- Current branch: !`git rev-parse --abbrev-ref HEAD`
- Target branch: !`git merge-target 2>/dev/null || echo "main"`
- Branch pushed to origin: !`git rev-parse --verify origin/$(git rev-parse --abbrev-ref HEAD) &>/dev/null && echo "yes" || echo "no"`
- Commits in this branch: !`git log --pretty=format:"%H %s" $(git merge-target 2>/dev/null || echo "main")..HEAD`
- Diff stat: !`git diff --stat $(git merge-target 2>/dev/null || echo "main")...HEAD`

## Usage

When the user invokes this command (e.g., `/create-mr`), follow these steps to create a merge request:

## Steps

### 1. Check if branch is pushed to origin

```bash
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if ! git rev-parse --verify "origin/$CURRENT_BRANCH" &>/dev/null; then
  git push -u origin "$CURRENT_BRANCH"
fi
```

### 2. Determine target branch

Use `git merge-target` if available, otherwise fall back to `main`:

```bash
TARGET_BRANCH=$(git merge-target 2>/dev/null || echo "main")
```

### 3. Generate title and description

Based on all commits since the target branch, generate:

- A concise title (max 80 characters) in imperative mood (e.g., "Add feature" not "Added feature")
- A comprehensive description that:
  - Explains the context and problem being solved
  - Describes the implementation approach
  - Outlines the testing strategy
  - Provides manual testing steps if applicable
  - Adheres to the merge request template if one exists in the repository

To find the merge request template, check these locations:

- `.gitlab/merge_request_templates/Default.md`
- `.gitlab/merge_request_templates/default.md`
- Any other `.md` files in `.gitlab/merge_request_templates/`

To get commit information:

```bash
# Get commit hashes
git log --pretty=format:"%H" "$TARGET_BRANCH".."$CURRENT_BRANCH"

# For each commit, get details:
git log -1 --pretty=format:"%s" "$commit"  # subject
git log -1 --pretty=format:"%b" "$commit"  # body
git show --pretty=format:"" "$commit"       # diff
```

Also consider the full diff:

```bash
git diff --stat "$TARGET_BRANCH"..."$CURRENT_BRANCH"
git diff "$TARGET_BRANCH"..."$CURRENT_BRANCH"
```

**Important**: Use the conversation context in this Claude session to inform the MR description. The commits and changes have likely been discussed, and that context should be incorporated into the description.

### 4. Present MR content for approval

Present the title and description to Brian for approval in a format he can easily review and edit if needed. Ask if he wants to proceed with creating the MR.

### 5. Create the merge request

Once approved, create the MR:

```bash
glab mr create \
  --title "$TITLE" \
  --description "$DESCRIPTION" \
  --target-branch "$TARGET_BRANCH" \
  --remove-source-branch \
  --yes
```

Extract the MR number from the output:

```bash
MR_URL=$(echo "$OUTPUT" | grep -oE 'https://[^ ]+' | head -1)
MR_NUMBER=$(echo "$MR_URL" | grep -oE '[0-9]+$')
```

### 6. Create dependency on parent MR (if applicable)

If the target branch is not `main`, look for a parent MR:

```bash
# Get project ID
PROJECT_ID=$(glab repo view --output json 2>/dev/null | jq -r .id)

# Find MR where source branch is our target branch
PARENT_MR_DATA=$(glab api "projects/$PROJECT_ID/merge_requests?source_branch=$TARGET_BRANCH&state=opened" 2>&1)

# Extract parent MR info
PARENT_MR_FIRST=$(echo "$PARENT_MR_DATA" | jq '.[0]' 2>/dev/null)
PARENT_MR_IID=$(echo "$PARENT_MR_FIRST" | jq -r .iid)
PARENT_MR_ID=$(echo "$PARENT_MR_FIRST" | jq -r .id)

# Create blocking relationship: parent MR blocks this MR
glab api -X POST "projects/$PROJECT_ID/merge_requests/$MR_NUMBER/blocks?blocking_merge_request_id=$PARENT_MR_ID"
```

### 7. Generate Slack review request

Output a Slack message for Brian to copy:

```
Please review my MR to [$TITLE]($MR_URL)
```

## Key Points

- Leverage the conversation context that's already in this Claude session
- The MR description should reflect not just the git commits, but the reasoning and discussion that happened during the work
- If a merge request template exists, follow it closely
- Ask Brian for approval before creating the MR
- Handle errors gracefully and report them clearly
- If the parent MR dependency creation fails, warn but don't fail the whole operation

## Example Workflow

```bash
# Example conversation:
# Claude: "I see you're on branch feature/add-validation. Let me check if it's pushed..."
# Claude: "Branch is pushed. The target branch is 'develop' (from git merge-target)."
# Claude: "Based on our work in this session, here's the proposed MR:"
#
# Title: Add input validation to user registration
#
# Description:
# ## Summary
# Implement comprehensive input validation for user registration form to prevent
# invalid data from being submitted.
#
# ## Changes
# - Add validation schema using Zod
# - Implement client-side validation with real-time feedback
# - Add server-side validation as backup
# ...
#
# Claude: "Does this look good? Should I proceed with creating the MR?"
# Brian: "yes"
# Claude: [creates MR, sets up dependency if needed, shows Slack message]
```

## Notes

- This command is designed to work within an active Claude session where the work context is already established
- Unlike the standalone `create-mr` script, this leverages Claude's understanding of the work done
- The generated description should be informed by the conversation, not just the commits
- Always confirm with Brian before creating the MR
