---
name: human-review
description: Open a document for human review and editing. Use when a document needs Brian's input, review, or approval before proceeding.
allowed-tools:
  - Bash(scripts/open-editor.sh:*)
  - Read
  - Write
---

# Human Review

Open a document for Brian to review and edit, then continue after he's done.

## Arguments

- `$0` - Path to the document to open for review

If no path is provided, ask Brian what document to open.

## Workflow

### Step 1: Open the document for review

```bash
scripts/open-editor.sh "$DOCUMENT"
```

The script detects the environment and opens the editor appropriately:
- **Inside tmux**: opens a vertical split with `$EDITOR`, blocks until Brian quits
- **Outside tmux**: opens with `code --wait`, blocks until Brian closes the file

### Step 2: Read the result

After the editor closes, read the document to see what Brian changed, then continue with whatever workflow prompted the review.

## Notes

- Always tell Brian what you're opening and why before launching the editor.
- After reading Brian's edits, acknowledge what changed and proceed accordingly.
- If Brian deletes all content, treat that as "abort this review."
