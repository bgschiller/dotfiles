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
plugins=(git)

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

if which xrandr 2>&1 > /dev/null; then
  function twoscreen() {
    xrandr --dpi 276 --output ${1:-DP-1} --scale 2x2 --right-of eDP-1
    killall polybar 2> /dev/null
    sleep 2
    i3 restart > /dev/null
  }
fi

if which xclip 2>&1 > /dev/null; then
  function pbcopy() {
    xclip -i -selection clipboard
  }
  function pbpaste() {
    xclip -o
  }
fi

if which picocom 2>&1 > /dev/null; then
  alias pico="sudo picocom -b 115200 /dev/ttyUSB0"
fi

[ -f /usr/local/Cellar/fzf/0.17.5/shell/key-bindings.zsh ] && source /usr/local/Cellar/fzf/0.17.5/shell/key-bindings.zsh
[ -f /usr/share/fzf/shell/key-bindings.zsh ] && source /usr/share/fzf/shell/key-bindings.zsh
[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh

if which devboard 2>&1 > /dev/null; then
  eval "$(_DEVBOARD_COMPLETE=source_zsh devboard)"
fi

[ -d ~/flutter/bin ] && [[ ":$PATH:" != *":$HOME/flutter/bin:"* ]] && export PATH=":$HOME/flutter/bin:$PATH"

alias jl='jq . -C | less -R'

export EDITOR=vim

function dlogcut() {
  cat <(head -n1 $1) <(grep -a 'PERIODIC' $1) |
    tr -d '\000' |
    csvcut -c $2
}

function csvheader() {
  head -n1 $1 | tr ',' '\n'
}

alias terumoVPN='sudo openconnect  --protocol=gp usbgw.terumobct.com'

export AUTOMATIONBUILD=/home/brian/terumo/CommonCode/CommonEmbedded/DockerBuild/Automation

if [ -f ~/.sensitive-zshrc ]; then
  source ~/.sensitive-zshrc
fi
