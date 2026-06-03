---
name: stacked-branches
description: Guide for managing stacked MRs with git-branchless. Use when working with stacked branches, restacking commits, or pushing multiple related branches.
allowed-tools:
  - Bash(git sl:*)
  - Bash(git smartlog:*)
  - Bash(git restack:*)
  - Bash(git move:*)
  - Bash(git move-branches:*)
  - Bash(git submit:*)
  - Bash(git query:*)
  - Bash(git merge-target:*)
  - Bash(git undo:*)
  - Bash(git record:*)
  - Bash(git sw:*)
  - Bash(git prev:*)
  - Bash(git next:*)
  - Read
---

# Stacked Branches with git-branchless

Manage stacked merge requests using git-branchless.

## Key Concepts

A **stack** is a chain of branches where each depends on the previous one. Instead of one large MR, you create multiple small, focused MRs that build on each other:

```
main
  └── feature-part-1 (MR !1 → main)
        └── feature-part-2 (MR !2 → feature-part-1, blocks on !1)
              └── feature-part-3 (MR !3 → feature-part-2, blocks on !2)
```

Benefits:
- Smaller, easier-to-review MRs
- Parallel work while waiting for reviews
- Logical grouping of related changes

## Orientation: See Your Stack

```bash
# Show commits in the current stack
git sl                    # Short alias
git smartlog 'stack()'    # Full command

# Show all branches in the stack
git query -b 'stack()'
```

## Navigation

```bash
git sw <branch>    # Switch to a branch
git prev           # Move to parent commit
git next           # Move to child commit (prompts if multiple)
```

## Adding Commits Mid-Stack

When you need to add a commit somewhere in the middle of a stack:

### Preferred: `git record --insert`

```bash
# Navigate to where you want the commit
git sw feature-part-1

# Stage changes and create commit
# --insert automatically restacks all descendants
git record --insert -m "Add missing validation"
```

### Alternative: Amend + Restack

```bash
# Navigate and amend
git sw feature-part-1
git commit --amend

# Manually rebase descendants onto the amended commit
git restack
```

## Moving Commits

```bash
# Move a commit (or range) to a different location
git move --source <commit> --dest <commit>

# Move entire stack to updated main
git move --source 'stack()' --dest main --merge
```

### Fix Branches After `git move --merge`

After `git move --merge`, branches may point to old commits instead of the rebased ones:

```bash
git move-branches        # Detect and fix misplaced branches
git move-branches -n     # Dry run: show what would change
```

This script finds duplicate commit messages in the stack (old vs rebased) and moves branches to the newer commits.

## Pushing the Stack

```bash
# Push all changed branches with --force-with-lease
git submit
```

This pushes every branch in the stack that has local changes, using force-with-lease for safety.

## Creating Stacked MRs

When creating MRs for stacked branches, use `git merge-target` to find the correct target:

```bash
git merge-target
# Returns: the parent branch name, or "main" if at stack root
```

**Blocking relationships**: When an MR targets a branch other than `main`, set up a blocking dependency so the parent MR must merge first. See the `create-mr` skill for details.

## Useful Query Patterns

```bash
# All commits in the stack
git query 'stack()'

# Branches in the stack
git query -b 'stack()'

# Ancestors of HEAD that are also in the stack's parent
git query 'ancestors(HEAD) & parents(stack())'
```

## Undo Mistakes

```bash
git undo              # Undo the last git-branchless operation
git undo --interactive # Choose what to undo
```

## Tips

- **Delete branch on merge**: Configure GitLab to delete source branches after merge. This keeps the stack clean.
- **Avoid squashing**: Squash-on-merge can confuse git-branchless. Prefer regular merge commits or rebase-merge.
- **Keep commits atomic**: Each commit should be a logical unit. This makes restacking and moving commits easier.
- **Push often**: Use `git submit` frequently to keep remote branches in sync.
