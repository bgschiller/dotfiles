# If you come from bash you might have to change your $PATH.
# export PATH=$HOME/bin:/usr/local/bin:$PATH

# Path to your oh-my-zsh installation.
export ZSH=$HOME/.oh-my-zsh

# Set name of the theme to load. Optionally, if you set this to "random"
# it'll load a random theme each time that oh-my-zsh is loaded.
# See https://github.com/robbyrussell/oh-my-zsh/wiki/jThemes
ZSH_THEME="robbyrussell"

# Which plugins would you like to load? (plugins can be found in ~/.oh-my-zsh/plugins/*)
# Custom plugins may be added to ~/.oh-my-zsh/custom/plugins/
# Example format: plugins=(rails git textmate ruby lighthouse)
# Add wisely, as too many plugins slow down shell startup.
plugins=(git pass command-not-found)

source $ZSH/oh-my-zsh.sh


# add nvm to path, set nvm env vars
export NVM_DIR="$HOME/.nvm"
[[ -s "$NVM_DIR/nvm.sh" ]] && \. "$NVM_DIR/nvm.sh"
[[ -r "$NVM_DIR/bash_completion" ]] && . "$NVM_DIR/bash_completion"

# add $HOME/bin to path if not present
[[ ":$PATH:" != *":$HOME/bin:"* ]] && export PATH="$HOME/bin:$PATH"

# add $HOME/.local/bin to path if not present
[[ ":$PATH:" != *":$HOME/.local/bin:"* ]] && export PATH="$HOME/.local/bin:$PATH"

# add /usr/local/bin to path if not present
[[ ":$PATH:" != *":/usr/local/bin:"* ]] && export PATH="/usr/local/bin:$PATH"

# add /usr/local/sbin to path if not present
[[ ":$PATH:" != *":/usr/local/sbin:"* ]] && export PATH="/usr/local/sbin:$PATH"

# add yarn and yarn modules to path if not present
[[ ":$PATH:" != *":$HOME/.yarn/bin:"* ]] && export PATH="$HOME/.yarn/bin:$PATH:$HOME/.config/yarn/global/node_modules/.bin/"

[[ ":$PATH:" != *":$HOME/.composer/vendor/bin:"* ]] && export PATH=":$HOME/.composer/vendor/bin:$PATH"

[[ ":$PATH:" != *":$HOME/.cargo/bin:"* ]] && export PATH=":$HOME/.cargo/bin:$PATH"

[[ -d /usr/local/go/bin ]] && [[ ":$PATH:" != *":/usr/local/go/bin:"* ]] && export PATH="$PATH:/usr/local/go/bin"

if which xclip 2>&1 > /dev/null; then
  function pbcopy() {
    xclip -i -selection clipboard
  }
  function pbpaste() {
    xclip -o
  }
fi

[ -f /usr/local/Cellar/fzf/0.17.5/shell/key-bindings.zsh ] && source /usr/local/Cellar/fzf/0.17.5/shell/key-bindings.zsh
[ -f /usr/share/fzf/shell/key-bindings.zsh ] && source /usr/share/fzf/shell/key-bindings.zsh
[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh

alias jl='jq . -C | less -R'

export EDITOR=vim

function csvheader() {
  head -n1 $1 | tr ',' '\n'
}

if [ -f ~/.zshrc-sensitive ]; then
  source ~/.zshrc-sensitive
fi

export CLIPBOX_AWS_S3_BUCKET=brianschiller-clipbox
export CLIPBOX_URL_PREFIX=https://clip.brianschiller.com/

# Add RVM to PATH for scripting. Make sure this is the last PATH variable change.
export PATH="$PATH:$HOME/.rvm/bin"

eval "$(direnv hook zsh)"

alias vim="nvim"
