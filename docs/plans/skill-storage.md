# Curate skills, then consolidate storage

## Goal

Keep a small, intentional collection for the tools Brian actually uses. Do not preserve the existing collection merely because it exists. Claude compatibility is not required. No migration framework, baseline preservation exercise, or filesystem regression suite is needed.

## Implementation status

Implemented on `chore/curate-skills`:

- Retired the rejected personal skills, migrated command wrappers, Claude skill aliases, and `pi-skills` submodule registration/gitlink.
- Replaced `agents/skills/` with one `../skills` alias; retained Pi's existing alias.
- Selected exactly six package skills using explicit allowlists and removed the nonexistent Claude plugin-cache package reference. Preserved unrelated Pi resources/settings.
- Reviewed retained instructions and key helper entrypoints. Simplified `check-pipeline` and `create-mr`, corrected helper paths, removed blanket empty-commit retry and squash advice, encoded branch query parameters, and fixed quote handling in the review editor helper.
- Added the approved inventory, ownership policy, prerequisites, and upstream caveats in `skills/README.md`. Package-managed files were not edited.

Validation: a fresh Pi resource-loader instance discovered exactly the approved 13 skills with no skill diagnostics; `create-mr` remains manual-only. Shell syntax checks, helper help commands, and temporary mocked smoke checks for editor filename quoting and pipeline branch encoding/filtering passed. No network/CI mutations, browser launch, live editor review, or model call was used for validation. Codex is not on PATH, so its runtime discovery was not tested; the shared symlink resolves correctly.

Limitations: no end-to-end credential-dependent workflow validation or exhaustive audit of third-party extensions. Upstream tmux socket-flag inconsistencies and native-web-search's older module lookup remain documented, not patched. `gh extension list` showed no installed extensions; verify `gh-stack` availability before using it.

## Storage policy

- `dotfiles/skills/`: personally maintained global skills that survive review.
- `dotfiles/agents/skills -> ../skills`: shared discovery interface for Codex/Pi.
- `dotfiles/pi/agent/skills -> ../../skills`: retain the existing Pi interface.
- Package skills stay package-managed, with an explicit approved selection in `pi/agent/settings.json`. No copies from `node_modules`.
- Project-only skills stay in their project. Prefer that over exposing work-specific instructions globally.
- Delete retired skills from the working tree; Git history is the archive. Do not build an inactive skill archive that loaders may rediscover.
- Remove `claude/skills` and `claude-personal/skills` aliases. Broader removal of Claude configuration is outside this task, except dependencies that affect Pi skill loading.

## What the audit established

Most apparent directories already alias `skills/`. The exception is `agents/skills/`, containing two real migrated command skills and ten redundant per-skill aliases. All inspected global home-directory aliases resolve into this checkout; there is no `~/.codex` on this machine.

Commit `5b84658` records Codex creating duplicate skills and a previous cleanup. That problem was real, but there is no need to retain its resulting directory structure.

`skills/pi-skills` is an empty checkout of a tracked submodule, not a normal empty directory. Inspect `.gitmodules` and remove its registration as well as the gitlink if retired; do not initialize it just to add more skills.

Pi also gets skills from Mitsupi and Pi Subagents packages. Its settings reference a Claude plugin cache as a local package, so abandoning Claude does not automatically eliminate that dependency. Review its contribution to Pi before removing it.

## Usage evidence: a guide, not a deletion rule

A lightweight scan of 71 available local Pi session logs found sessions containing direct `read` or `bash` references to a skill's `SKILL.md`:

| Currently available skill | Sessions with references |
| --- | ---: |
| github | 22 |
| human-review | 13 |
| create-mr | 4 |
| tmux | 3 |
| check-pipeline | 3 |
| native-web-search | 2 |
| get-user-attention | 2 |
| librarian | 2 |
| pi-subagents | 2 |
| source-command-implementation-plan | 1 |

Limitations: the scan includes this planning conversation, counts inspection as well as operational use, misses reads embedded in codemode and other indirect invocation, and covers neither all history nor other clients. A zero is not proof of disuse. The implementation-plan reference is from this cleanup and is not evidence that Brian wants that workflow.

Historical references also include skills not in the current global collection, such as `readout-style`, `go-fe-coding`, and `mirage-debugging`. Do not resurrect them automatically; they may be project/package-specific or retired.

## Vetting shortlist

Brian approved the final selection below. The original usage evidence is retained as decision history, not as a reason to re-enable retired skills. The review covered instructions and key helpers, not an exhaustive security audit of package implementations.

### Approved keepers: recognizable use evidence

Brian approved all nine skills below.

| Skill | Owner | Review focus |
| --- | --- | --- |
| human-review | Personal | Editor workflow; remove unnecessary client-specific paths. |
| get-user-attention | Personal | Notification workflow and available helper command. |
| check-pipeline | Personal | GitLab workflow; global versus work-project scope. |
| create-mr | Personal | Used despite manual-only invocation. Fix project-relative helper paths and Claude-specific wording. |
| github | Mitsupi | Keep upstream-owned; check overlap with personal PR instructions. |
| tmux | Mitsupi | Interactive CLI workflow. |
| native-web-search | Mitsupi | Search provider availability. |
| librarian | Mitsupi | Repository checkout workflow. |
| pi-subagents | Pi Subagents | Keep if delegation is still used; instructions are part of operating the package. |

### Approved retirements

| Skill | Reason |
| --- | --- |
| source-command-brainstorm | Brian confirmed it is unused; remove. |
| source-command-implementation-plan | Brian confirmed it is unused; remove. |
| pi-skills submodule | Brian approved removal; remove the gitlink and submodule registration. |

### Brian's decisions: specialized personal workflows

- Keep `gh-stack` and `stacked-branches`: both are actively used and cover distinct tools.
- Keep `grill-me`: Brian confirmed it is actively used.
- Keep package skill `web-browser`: Brian confirmed it is actively used.
- Disable package skills `frontend-design`, `mermaid`, `pi-share`, and `summarize`: Brian uses only `web-browser` from that group. Leave their package files untouched.
- Disable package skills `uv` and `council-mode`: Brian approved dropping both. This does not remove the `uv` executable or the Pi Subagents extension, and does not add a replacement standing instruction.
- Remove `source-command-brainstorm` and `source-command-implementation-plan`: Brian confirmed neither is used.
- Remove `mr-threads`, `victoriametrics`, `grow-review`, and `webkit-localstorage`: Brian identified only the two stack skills as still used from this group. These are removal decisions for the planned cleanup, not changes already applied.

### Approved final collection

Personal (7): `human-review`, `get-user-attention`, `check-pipeline`, `create-mr`, `gh-stack`, `stacked-branches`, `grill-me`.

Package-managed (6): `github`, `tmux`, `native-web-search`, `librarian`, `pi-subagents`, `web-browser`.

All keep/remove selections are approved, including removal of the `pi-skills` submodule. Cleanup and targeted vetting are implemented; see the implementation status and limitations above.

### Already disabled: leave disabled unless explicitly requested

Mitsupi: `anachb`, `apple-mail`, `commit`, `ghidra`, `google-workspace`, `oebb-scotty`, `openscad`, `sentry`, `update-changelog`.

Installed package files can remain on disk without being exposed to the model. Do not manually prune package contents.

## Execution plan

1. **Collection selection complete.** Brian approved the 13-skill collection above and retirement of the other reviewed skills/submodule. Use that selection for cleanup; do not re-enable skills merely because they have historical usage.
2. **Vet only the keepers deeply.** Read instructions/scripts; check executable prerequisites, stale paths, side effects, scope, overlapping triggers, and client assumptions. Remove unnecessary boilerplate. Do not rewrite a retired skill first.
3. **Prune.** Delete rejected personal skills and their supporting assets. Remove the unused submodule properly if approved. Disable rejected package skills without removing extensions that still need the package. Inspect Pi's Claude-plugin package reference and remove it only if its actual contribution is unwanted.
4. **Consolidate.** Move any surviving `source-command-*` directories into `skills/`; otherwise delete them. Replace `agents/skills/` with the single `../skills` alias. Keep Pi's existing alias. Remove the two Claude skill aliases. Existing whole-directory Dotbot links for `~/.agents` and `~/.pi` can remain unchanged.
5. **Make package exposure deliberate.** Replace package skill exclusion lists/default-all behavior with explicit approved selections. Preserve unrelated extension/theme settings. Use the installed Pi version's supported resource selectors.
6. **Document briefly.** Add `skills/README.md`: canonical location, retained skills and purpose, package selections, project-local policy, and the rule that installing a package is not permission to enable all its skills.
7. **Smoke-check and commit.** Review Git status/diff for accidental loss of untracked files. Start a fresh Pi session, verify the intended skill list and absence of collision warnings, check the shared discovery path with Codex if used, and exercise a retained script-backed skill harmlessly. No automated filesystem regression framework. Commit the cleanup in a few coherent chunks.

## Done means

Every exposed skill has an intentional current use; personal skills have one physical home; retired skills are gone rather than rediscoverable; packages expose only the approved skills; Claude imposes no compatibility burden.
