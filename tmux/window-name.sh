#!/bin/bash
# Determine tmux window name based on git context
# Priority: 1) non-default branch, 2) worktree name, 3) directory name

dir="$1"
cd "$dir" 2>/dev/null || exit 1

# Check if we're in a git repo
if ! git rev-parse --git-dir &>/dev/null; then
    basename "$dir"
    exit 0
fi

# Get the branch name
branch=$(git symbolic-ref --short HEAD 2>/dev/null)

# Get the main/default branch name
default_branch=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
if [ -z "$default_branch" ]; then
    # Fallback: check for common default branch names
    if git show-ref --verify --quiet refs/heads/main 2>/dev/null; then
        default_branch="main"
    elif git show-ref --verify --quiet refs/heads/master 2>/dev/null; then
        default_branch="master"
    fi
fi

# If on a non-default branch, use the branch name
if [ -n "$branch" ] && [ "$branch" != "$default_branch" ]; then
    echo "$branch"
    exit 0
fi

# Check if we're in a worktree (not the main working tree)
git_common_dir=$(git rev-parse --git-common-dir 2>/dev/null)
git_dir=$(git rev-parse --git-dir 2>/dev/null)

if [ "$git_common_dir" != "$git_dir" ] && [ "$git_common_dir" != "." ]; then
    # We're in a worktree - use the worktree directory name
    basename "$dir"
    exit 0
fi

# Default: use the directory name
basename "$dir"
