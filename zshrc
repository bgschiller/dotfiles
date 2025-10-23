# Add deno completions to search path
if [[ ":$FPATH:" != *":/Users/brian/.zsh/completions:"* ]]; then export FPATH="/Users/brian/.zsh/completions:$FPATH"; fi
# If you come from bash you might have to change your $PATH.
# export PATH=$HOME/bin:/usr/local/bin:$PATH

# Path to your oh-my-zsh installation.
export ZSH=$HOME/.oh-my-zsh

# Set name of the theme to load. Optionally, if you set this to "random"
# it'll load a random theme each time that oh-my-zsh is loaded.
# See https://github.com/robbyrussell/oh-my-zsh/wiki/jThemes
ZSH_THEME="robbyrussell"
BAT_THEME="OneHalfDark"

# Which plugins would you like to load? (plugins can be found in ~/.oh-my-zsh/plugins/*)
# Custom plugins may be added to ~/.oh-my-zsh/custom/plugins/
# Example format: plugins=(rails git textmate ruby lighthouse)
# Add wisely, as too many plugins slow down shell startup.
plugins=(git pass command-not-found) 

source $ZSH/oh-my-zsh.sh

# extended_glob makes ^ a special character, which interferes with git reset HEAD^
unsetopt extended_glob


# add $HOME/bin to path if not present
[[ ":$PATH:" != *":$HOME/bin:"* ]] && export PATH="$HOME/bin:$PATH"

# add $HOME/.local/bin to path if not present
[[ ":$PATH:" != *":$HOME/.local/bin:"* ]] && export PATH="$HOME/.local/bin:$PATH"

# add /usr/local/bin to path if not present
[[ ":$PATH:" != *":/usr/local/bin:"* ]] && export PATH="/usr/local/bin:$PATH"

# add /usr/local/sbin to path if not present
[[ ":$PATH:" != *":/usr/local/sbin:"* ]] && export PATH="/usr/local/sbin:$PATH"

[[ ":$PATH:" != *":$HOME/flutter/bin:"* ]] && [[ -d "$HOME/flutter/bin" ]] && export PATH="$HOME/flutter/bin:$PATH"
[[ ":$PATH:" != *":$HOME/android-studio/bin:"* ]] && [[ -d "$HOME/android-studio/bin" ]] && export PATH="$HOME/android-studio/bin:$PATH"

[[ ":$PATH:" != *":/Applications/CMake.app/Contents/bin:"* ]] && [[ -d "/Applications/CMake.app/Contents/bin" ]] && export PATH="/Applications/CMake.app/Contents/bin:$PATH"

# add yarn and yarn modules to path if not present
[[ ":$PATH:" != *":$HOME/.yarn/bin:"* ]] && export PATH="$HOME/.yarn/bin:$PATH:$HOME/.config/yarn/global/node_modules/.bin/"

[[ ":$PATH:" != *":$HOME/.composer/vendor/bin:"* ]] && export PATH=":$HOME/.composer/vendor/bin:$PATH"

[[ ":$PATH:" != *":$HOME/.cargo/bin:"* ]] && export PATH=":$HOME/.cargo/bin:$PATH"

[[ -d /usr/share/elasticsearch/bin/ ]] && [[ ":$PATH:" != *":/usr/share/elasticsearch/bin/:"* ]] && export PATH=":/usr/share/elasticsearch/bin/:$PATH"

[[ -d /usr/local/go/bin ]] && [[ ":$PATH:" != *":/usr/local/go/bin:"* ]] && export PATH="$PATH:/usr/local/go/bin"

if which xclip 2>&1 > /dev/null; then
  function pbcopy() {
    xclip -i -selection clipboard
  }
  function pbpaste() {
    xclip -o -selection clipboard
  }
fi

function mkcd() {
  \mkdir -p "$1"
  cd "$1"
}

function boop () {
  local last="$?"
  if [[ "$last" == '0' ]]; then
    sfx good
  else
    sfx bad
  fi
  $(exit "$last")
}

[ -f /usr/local/Cellar/fzf/0.17.5/shell/key-bindings.zsh ] && source /usr/local/Cellar/fzf/0.17.5/shell/key-bindings.zsh
[ -f /usr/share/fzf/shell/key-bindings.zsh ] && source /usr/share/fzf/shell/key-bindings.zsh
[ -f /usr/share/doc/fzf/examples/key-bindings.zsh ] && source /usr/share/doc/fzf/examples/key-bindings.zsh
[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh

alias jl='jq . -C | less -R'

export EDITOR=nvim

function csvheader() {
  head -n1 $1 | tr ',' '\n'
}

if [ -f ~/.zshrc-sensitive ]; then
  source ~/.zshrc-sensitive
fi

export CLIPBOX_AWS_S3_BUCKET=brianschiller-clipbox
export CLIPBOX_URL_PREFIX=https://clip.brianschiller.com/

export N_PREFIX=$HOME/.n

# Add RVM to PATH for scripting. Make sure this is the last PATH variable change.
export PATH="$PATH:$HOME/.rvm/bin"
[[ -s "$HOME/.rvm/scripts/rvm" ]] && source "$HOME/.rvm/scripts/rvm"

eval "$(direnv hook zsh)"


function __choose_node_package_manager__() {
  if [ -f "package-lock.json" ]; then
    npm $*
  elif [ -f "yarn.lock" ]; then
    yarn $*
  else
    pnpm $*
  fi
}
alias pm="__choose_node_package_manager__"

function clipbox() {
  local old_LC_ALL=$LC_ALL
  export LC_ALL=C
  local UPLOAD_NAME=$(cat /dev/urandom | tr -dc '[:alpha:]' | fold -w 7 | head -n 1)-$(date -Idate).${1#*.}

  export LC_ALL=$old_LC_ALL
  local URL="https://clip.brianschiller.com/$UPLOAD_NAME"
  echo -n  $URL | pbcopy
  echo "Copied '$URL' to clipboard"
  aws --profile clipbox-writer s3 cp $1 s3://brianschiller-clipbox/$UPLOAD_NAME --metadata-directive REPLACE --content-type $(file --mime-type $1 | cut -f2 -d:) --acl public-read
}


# pnpm
export PNPM_HOME="/Users/brian/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
# pnpm end

# add $HOME/bin to path if not present
[[ ":$PATH:" != *":$HOME/bin:"* ]] && export PATH="$HOME/bin:$PATH"
#

export PATH="$N_PREFIX/bin:$PATH"

[[ -s "$HOME/.sdkman/bin/sdkman-init.sh" ]] && source "$HOME/.sdkman/bin/sdkman-init.sh"
eval "$(pyenv init -)"

#eval "$(starship init zsh)"

eval "$(mcfly init zsh)"


# Awesome Claude Code initialization
AWESOME_CLAUDE_CODE_DIR="/Users/brian/.awesome-claude-code/repo"
if [ -f "$AWESOME_CLAUDE_CODE_DIR/scripts/shell-init.sh" ]; then
    source "$AWESOME_CLAUDE_CODE_DIR/scripts/shell-init.sh" "$AWESOME_CLAUDE_CODE_DIR"
fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
