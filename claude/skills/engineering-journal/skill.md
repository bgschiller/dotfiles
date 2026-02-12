---
name: engineering-journal
description: Create a dated engineering journal entry summarizing recent work, synthesizing insights from GitLab MRs, Slack discussions, and docs into a narrative of project impact.
argument-hint: "[days_back?]"
allowed-tools:
  # File operations
  - Read
  - Write
  - Glob
  - Bash
  # Glean - search internal docs and communications
  - mcp__glean__search
  - mcp__glean__chat
  - mcp__glean__read_document
---

You are creating an engineering journal entry that captures the narrative of recent work - not just a list of artifacts, but the *impact* and *context* of what was accomplished.

## Inputs
- Days back: $ARGUMENTS (optional, defaults to 7 or since last journal entry, whichever is longer)

## Journal location
- Repository: `~/work/engineering-journal`
- Entries: `entries/YYYY-MM-DD.md` (one file per entry, dated by creation date)

## Process

### 1. Determine date range
- Check `~/work/engineering-journal/entries/` for the most recent entry
- If an entry exists, use its date as the start date
- If no entries exist, default to 7 days ago
- End date is always today

### 2. Gather evidence from GitLab (via glab CLI)

Run these commands to find the user's work. Always use `--author=@me` to get the current authenticated user's MRs:

```bash
# MRs authored (use @me for current user)
# Note: glab requires GITLAB_HOST and --repo to be set
GITLAB_HOST=gitlab.grammarly.io glab mr list --author=@me --all --per-page=50 --repo <group/project>

# Check multiple repos where you commonly work:
# - front-end/front-end-web-monorepo
# - client-platform/inkwell
# - (add others as needed)

# For each MR, get details including description and changes
GITLAB_HOST=gitlab.grammarly.io glab mr view <mr_number> --repo=<group/project>
```

For each MR:
- Read the description and diff to understand *what problem it solved*
- Note the project/repo it belongs to
- Look for patterns: is this part of a larger initiative?

### 3. Gather evidence from Glean

Use `mcp__glean__search` and `mcp__glean__chat` to find:
- Slack threads the user participated in (use `from:me` filter and date range)
- Design docs, RFCs, or technical documents authored or commented on (use `owner:me` filter)
- Coda docs created or edited

For Slack threads:
- Look for technical discussions, decisions made, problems solved
- Identify cross-team collaboration
- Note any mentorship or helping others
- **Especially look for feedback and thank-you messages** - these capture real impact that metrics miss (e.g., "this change made my dev experience so much better")

### 4. Synthesize into projects/themes

Group the evidence into coherent narratives:
- What projects did the user actively work on?
- What was the *goal* of each piece of work?
- What decisions were made and why?
- What impact did the work have (or will have)?

### 5. Write the journal entry

Create a new file at `~/work/engineering-journal/entries/YYYY-MM-DD.md` with this structure:

```markdown
# Engineering Journal: YYYY-MM-DD

**Period covered:** <start_date> to <end_date>

## Summary

<2-3 sentence overview of the week's focus areas>

## Projects & Impact

### <Project/Theme Name>

**Context:** <What problem or goal drove this work?>

**What I did:**
- <Narrative description of contributions>
- <Key decisions made and rationale>

**Evidence:**
- [MR Title](link) - <one-line description of what it accomplished>
- [Doc/Thread](link) - <context>

**Impact:**
- <Observable outcomes, unblocked work, improved metrics, etc.>
- <Qualitative feedback from colleagues if available - quote directly>

### <Next Project/Theme>
...

## Collaborations & Discussions

<Notable cross-team work, technical discussions, mentorship moments>

## Notes for Future Reference

<Anything worth remembering: lessons learned, context that might be useful for GROW reviews, interesting technical challenges>
```

### 6. Commit the entry

After writing the entry:
```bash
cd ~/work/engineering-journal
git add entries/YYYY-MM-DD.md
git commit -m "Add journal entry for YYYY-MM-DD"
```

## Quality guidelines

- **Narrative over listing**: Don't just list MRs. Explain what they accomplished together.
- **Impact focus**: Always ask "so what?" - why did this work matter?
- **Be specific**: Include concrete details, not vague statements
- **Capture context**: Future-you doing a GROW review will thank present-you for the context
- **Honest assessment**: Note challenges, blockers, and things that didn't go well too

## Output

After completing the entry:
1. Print the full entry to the terminal
2. Confirm the file location and git commit
