---
name: human-review
description: Open a document for human review and editing. Use when a document needs Brian's input, review, or approval before proceeding.
allowed-tools:
  - Bash(/Users/brian/.pi/agent/skills/human-review/scripts/open-editor.sh:*)
  - Bash(/Users/brian/dotfiles/skills/human-review/scripts/open-editor.sh:*)
  - Read
  - Write
---

# Human Review

Open a document for Brian to review and edit, then continue after he's done.

## Helper script location

The editor helper is part of this skill, not part of the repository being reviewed. Do **not** run `scripts/open-editor.sh` relative to the current project.

Use this installed absolute path:

```bash
/Users/brian/.pi/agent/skills/human-review/scripts/open-editor.sh "$DOCUMENT"
```

The dotfiles source path is also available when working inside Brian's dotfiles checkout:

```bash
/Users/brian/dotfiles/skills/human-review/scripts/open-editor.sh "$DOCUMENT"
```

## Arguments

- `$0` - Path to the document to open for review

If no path is provided, ask Brian what document to open.

## Workflow

### Step 1: Open the document for review

```bash
/Users/brian/.pi/agent/skills/human-review/scripts/open-editor.sh "$DOCUMENT"
```

The script detects the environment and opens the editor appropriately:
- **Inside tmux**: opens a vertical split with `$EDITOR`, blocks until Brian quits
- **Outside tmux**: opens with `code --wait`, blocks until Brian closes the file

### Step 2: Read the result

After the editor closes, read the document to see what Brian changed, then continue with whatever workflow prompted the review.

## Notes

- Always tell Brian what you're opening and why before launching the editor.
- Always use the absolute helper path above; don't assume the target repo has a `scripts/` directory.
- If the installed helper is unexpectedly missing, use the dotfiles source path shown above before falling back to `code --wait "$DOCUMENT"`.
- After reading Brian's edits, acknowledge what changed and proceed accordingly.
- If Brian deletes all content, treat that as "abort this review."
