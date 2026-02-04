---
name: mr-threads
description: List unresolved discussion threads on a GitLab merge request. Use when user asks about MR feedback, unresolved comments, or review threads.
allowed-tools:
  - Bash(~/.claude/skills/mr-threads/scripts/glab-mr-threads.sh:*)
  - Bash(glab mr list:*)
  - Bash(glab mr view:*)
  - Bash(git rev-parse:*)
  - Bash(git branch:*)
  - Read
  - Grep
---

# List GitLab MR Discussion Threads

Retrieve and display unresolved discussion threads on merge requests.

## Helper Script

Use the allowlisted helper script for all API calls:

```bash
~/.claude/skills/mr-threads/scripts/glab-mr-threads.sh <command> [args]
```

Commands:
- `unresolved <mr-number>` - List unresolved threads (the main use case)
- `all <mr-number>` - List all discussion threads
- `thread <mr-number> <note-id>` - Get a specific thread by note ID

## Workflow

### Step 1: Find the MR Number

If the user provides an MR number, use it directly. Otherwise, find the MR for the current branch:

```bash
glab mr list --source-branch $(git rev-parse --abbrev-ref HEAD)
```

### Step 2: Get Unresolved Threads

```bash
~/.claude/skills/mr-threads/scripts/glab-mr-threads.sh unresolved <mr-number>
```

This returns JSON with all unresolved threads, including:
- `discussion_id` - The thread ID
- `notes` - Array of unresolved notes with:
  - `note_id` - Unique note identifier
  - `author` - Username of commenter
  - `body` - Full comment text
  - `file` - File path (for diff comments)
  - `line` - Line number (for diff comments)
  - `created_at` - Timestamp

### Step 3: Present Results

Format the unresolved threads for the user. Group by file when applicable, and summarize the key points of each thread.

## Output Format

When presenting results to the user, format each thread like:

```
### Thread Title/Summary
**File:** `path/to/file.ts:line`
**Author:** username

Comment body...
```

## Example Session

```
User: "What are the unresolved comments on my MR?"

Claude:
# Find MR
glab mr list --source-branch $(git rev-parse --abbrev-ref HEAD)
# Output: !1562 cheetah-web-integration-rebased

# Get unresolved threads
~/.claude/skills/mr-threads/scripts/glab-mr-threads.sh unresolved 1562

# Format and present results to user
```

## Notes

- The script uses `per_page=100` which should cover most MRs
- For MRs with more than 100 discussions, pagination may be needed (rare)
- The `thread` command is useful for getting the full context of a specific comment when you have the note ID from a URL
