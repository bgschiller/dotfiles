---
name: mr-threads
description: List unresolved discussion threads on a GitLab merge request or GitHub pull request. Use when user asks about MR feedback, unresolved comments, or review threads.
allowed-tools:
  - Bash(~/bin/mr-threads:*)
  - Bash(git rev-parse:*)
  - Bash(git branch:*)
  - Read
  - Grep
---

# List MR/PR Discussion Threads

Retrieve and display unresolved discussion threads on merge requests (GitLab) or pull requests (GitHub).

## Usage

```bash
~/bin/mr-threads [mr-number]
```

The script auto-detects:
- **Platform**: GitLab or GitHub based on git remote URL
- **MR/PR number**: From current branch if not provided

## Workflow

### Step 1: Run the Script

If the user provides an MR/PR number:
```bash
~/bin/mr-threads 123
```

Otherwise, auto-detect from current branch:
```bash
~/bin/mr-threads
```

### Step 2: Present Results

The script outputs markdown with all unresolved threads, including:
- File location and line number (for inline comments)
- Author and date for each comment
- Full conversation (all replies in each thread)
- General discussion threads (not attached to files)

## Output Format

```markdown
## Unresolved Threads (N)

### `src/file.ts:42`
**@reviewer** - 2024-01-15

Comment body here

**@author** - 2024-01-15

Reply body here

---

### General Discussion
**@commenter** - 2024-01-14

Non-file-attached comment here

---
```

## Example Session

```
User: "What are the unresolved comments on my MR?"

Claude:
~/bin/mr-threads
# Output: Markdown formatted threads

# Summarize and present to user
```

## Notes

- Uses `glab` CLI for GitLab, `gh` CLI for GitHub
- Fetches up to 100 discussions (covers most MRs/PRs)
- Shows full thread conversation, not just unresolved notes
