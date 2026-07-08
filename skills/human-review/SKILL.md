---
name: human-review
description: Open a document for human review and editing. Use when a document needs Brian's input, review, or approval before proceeding.
allowed-tools:
  - Bash(/Users/brian/.pi/agent/skills/human-review/scripts/open-editor.sh:*)
  - Bash(/Users/brian/dotfiles/skills/human-review/scripts/open-editor.sh:*)
  - Bash(mktemp:*)
  - Bash(cp:*)
  - Bash(diff:*)
  - Bash(rm:*)
  - Bash(test:*)
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

### Step 1: Save a baseline copy

Before opening the document, save a temporary baseline so you can compare Brian's edits without rereading the whole file.

```bash
REVIEW_BASELINE="$(mktemp "${TMPDIR:-/tmp}/human-review.XXXXXX")"
cp "$DOCUMENT" "$REVIEW_BASELINE"
```

If the document has not been written to disk yet, write it first, then create the baseline copy.

### Step 2: Open the document for review

```bash
/Users/brian/.pi/agent/skills/human-review/scripts/open-editor.sh "$DOCUMENT"
```

The script detects the environment and opens the editor appropriately:
- **Inside tmux**: opens a vertical split with `$EDITOR`, blocks until Brian quits
- **Outside tmux**: opens with `code --wait`, blocks until Brian closes the file

### Step 3: Compare against the baseline

After the editor closes, compare the reviewed document to the temporary baseline.

```bash
diff -u "$REVIEW_BASELINE" "$DOCUMENT" || true
```

Use the diff output to determine what changed. If there is no diff, continue without rereading the document. For small edits, rely on the diff; only read the full document if the diff is too large, ambiguous, or the next workflow step requires the complete current content.

If Brian deletes all content, treat that as "abort this review."

### Step 4: Clean up the baseline

After comparing, remove the temporary baseline copy unless there is a specific debugging reason to keep it.

```bash
rm -f "$REVIEW_BASELINE"
```

If you intentionally keep a temporary file, tell Brian its path and why.

## Notes

- Always tell Brian what you're opening and why before launching the editor.
- Always use the absolute helper path above; don't assume the target repo has a `scripts/` directory.
- If the installed helper is unexpectedly missing, use the dotfiles source path shown above before falling back to `code --wait "$DOCUMENT"`.
- After comparing Brian's edits, acknowledge what changed and proceed accordingly.
- Prefer the diff over rereading the full document; reread only when needed.
- Temporary baseline files should usually be deleted after comparison.
- If Brian deletes all content, treat that as "abort this review."
