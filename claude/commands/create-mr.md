---
allowed_tools:
  - Bash(git rev-parse:*)
  - Bash(git branch:*)
  - Bash(git push:*)
  - Bash(git merge-target:*)
  - Bash(git log:*)
  - Bash(git show:*)
  - Bash(git diff:*)
  - Bash(glab mr create:*)
  - Bash(glab repo view:*)
  - Bash(glab api:*)
  - Bash(sed:*)
  - Bash(xargs git rev-parse:*)
---

# Create Merge Request

Create a GitLab merge request using the context already present in this Claude session.

## Context

You have access to the following git information via the Claude Code session context:

- Current branch `!git branch --show-current`
- Recent commits from `git status`
- You can check if branch is pushed by running `!git branch --show-current | sed 's|^|origin/|g' | xargs git rev-parse --verify`
- You can get target branch by running `git merge-target`, or fall back to main: `!git merge-target || echo 'main'`
- You can get commits via `git log` and diffs via `git diff`

## Usage

When the user invokes this command (e.g., `/create-mr`), follow these steps to create a merge request:

## Steps

### 1. Check if branch is pushed to origin

Check if the current branch exists on origin. If not, push it with `-u` to set up tracking.

### 2. Determine target branch

Use `git merge-target` if available, otherwise fall back to `main`:

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

Get commit information from the target branch to current branch using `git log` and `git show` to see commit messages, bodies, and diffs. Also review the full diff between target and current branch using `git diff`.

**Important**: Use the conversation context in this Claude session to inform the MR description. The commits and changes have likely been discussed, and that context should be incorporated into the description.

### 4. Open MR content in editor

Write the generated title and description to a temporary file **in the current working directory** (not `/tmp`) in this format:

```
# Title here

Description starts here
and continues...
```

Example filename: `mr-<branch-name>.md` where `<branch-name>` is sanitized (e.g., `mr-assistant-ui-kit-coverage.md`)

Open the file using `code --wait`. After Brian saves and closes the editor:

- Parse the title from the first line (the line starting with `#`)
- Parse the description from everything after the first line
- If the file is empty or contains only whitespace, abort MR creation
- Delete the temporary MR file after successfully parsing it
- Otherwise proceed to step 5 with the edited title and description

### 5. Create the merge request

Create the MR using `glab mr create` with the edited title, description, target branch, and `--remove-source-branch --yes` flags.

Extract the MR URL and MR number from the output for use in the next steps.

### 6. Create dependency on parent MR (if applicable)

If the target branch is not `main`, look for a parent MR:

- Get the project ID using `glab repo view`
- Find any open MR where the source branch matches our target branch using `glab api`
- If found, create a blocking relationship where the parent MR blocks this MR using `glab api -X POST projects/$PROJECT_ID/merge_requests/$MR_NUMBER/blocks?blocking_merge_request_id=$PARENT_MR_ID`

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
