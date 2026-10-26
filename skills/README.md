# Skills

## One home, two discovery aliases

Personally maintained global skills live **only in this directory**:

```text
dotfiles/skills/                 # real files
  ↑ agents/skills -> ../skills  # ~/.agents/skills: shared discovery (Pi/Codex)
  ↑ pi/agent/skills -> ../../skills  # ~/.pi/agent/skills: Pi discovery alias
```

Dotbot links `~/.agents` and `~/.pi` to their corresponding repository directories. No separate skill-copy/install step is needed. Pi deduplicates these aliases by real path. The aliases are interfaces, not additional storage locations.

## Approved collection

### Personal (7)

| Skill | Purpose |
| --- | --- |
| check-pipeline | Investigate GitLab CI failures. |
| create-mr | Draft, review, and create GitHub PRs / GitLab MRs; explicit invocation only. |
| get-user-attention | Notify when a requested background watcher finishes or needs input. |
| gh-stack | Manage GitHub stacks with `gh stack`. |
| grill-me | Stress-test a design through one-question-at-a-time interviews. |
| human-review | Open a document for Brian to review/edit. |
| stacked-branches | Manage git-branchless stacks. |

### Package-managed (6, exposed to Pi)

| Package | Enabled skills |
| --- | --- |
| Mitsupi | github, tmux, native-web-search, librarian, web-browser |
| Pi Subagents | pi-subagents |

Package files remain in Pi's managed npm installation, not copied here or linked into Codex. **`pi/agent/settings.json` is the explicit package-skill allowlist.** Installing/updating a package is not permission to expose all its skills. Unselected skills can remain installed but disabled; unrelated package extensions/prompts/themes are independent.

## Rules for future additions

1. Identify a current use and check whether an existing skill already covers it.
2. Put personal global skills here as `<name>/SKILL.md`, with scripts/references alongside.
3. Keep project-specific skills in that project's `.agents/skills/`, not the global collection.
4. Prefer upstream ownership for third-party skills; select approved skills in Pi settings rather than vendoring copies or editing `node_modules`.
5. Delete retired personal skills. Git history is the archive; do not create an automatically discoverable archive directory.
6. Resolve bundled scripts relative to the skill, never the project being worked on. Review prerequisites, side effects, and triggers before enabling.

## Runtime prerequisites and upstream caveats

- `gh-stack` requires authenticated `gh` and the `gh-stack` extension; `stacked-branches` requires git-branchless and the dotfiles Git helpers. Do not install tools or change repository Git config implicitly.
- `human-review` needs tmux plus `$EDITOR` in a tmux pane, or `code --wait` outside tmux.
- `check-pipeline` and the GitLab `create-mr` helper require authenticated `glab` and `jq`. Pipeline/job list responses are limited to 100 entries; branch pipeline lists omit `external` sources.
- Mitsupi 1.6.0 `tmux` mixes `-L` (socket name) with `-S` (socket path). When using a socket path, use `-S` consistently. Resolve its helper scripts relative to its installed skill directory.
- Mitsupi 1.6.0 `native-web-search` searches for the older `@mariozechner/pi-ai` package. With this Pi installation, if automatic resolution fails, pass `PI_AI_MODULE_PATH` and `PI_AI_OAUTH_MODULE_PATH` pointing to the running Pi release's `@earendil-works/pi-ai/dist/index.js` and `dist/oauth.js`. Its search can refresh/write Pi OAuth credentials; avoid concurrent credential-refresh operations. Never print credentials.
- `web-browser` starts/reuses Chrome's local CDP endpoint, logs network activity under `~/.cache/agent-web/logs/`, and can copy authenticated browser state with `--profile`. Treat logs/profile data as sensitive; do not copy the logged-in profile or accept consent dialogs without appropriate authorization.
- `librarian` clones/fetches and can fast-forward cached checkouts. It is not a read-only operation; use trusted repository URLs and a separate worktree for edits.

These upstream caveats are not patched in package-managed files. Recheck them when updating packages.
