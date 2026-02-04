# Dotfiles Repository

Brian's dotfiles, managed with [dotbot](https://github.com/anishathalye/dotbot).

## Structure

Configuration files live at the repo root or in subdirectories by tool name:
- Single files: `tmux.conf`, `zshrc`, `gitconfig`
- Directories: `nvim/`, `kitty/`, `claude/`, `tmux/`, `vscode/`

## Adding New Dotfiles

1. Add the config file or directory to this repo
2. Add a symlink entry in `install.conf.yaml`
3. Run `./install` to create the symlink

### install.conf.yaml Syntax

```yaml
# Simple: target path matches source filename
~/.zshrc:           # links to ./zshrc

# Directory: links entire directory
~/.config/nvim:     # links to ./nvim/

# Explicit source path
~/.config/jj/config.toml:
  path: jj-config.toml

# Platform-specific (skip on other platforms)
"C:\\Users\\...\\nvim":
  if: "ver"         # Windows only ('ver' command exists)
~/.gitconfig:
  if:               # Empty = all platforms (mac/linux/windows)
```

The `if:` condition runs a shell command - if it succeeds, the link is created.
- `if: "uname"` - mac/linux only (default)
- `if: "ver"` - Windows only
- `if:` (empty) - all platforms

## Applying Changes

```bash
./install          # Run dotbot to create/update symlinks
```

Dotbot will create parent directories as needed and overwrite existing symlinks.
