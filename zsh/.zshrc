ENABLE_CORRECTION="false"
HIST_STAMPS="mm/dd/yyyy"

export ZSH="$HOME/.oh-my-zsh"
plugins=(git)
ZSH_THEME="robbyrussell"
source "$ZSH/oh-my-zsh.sh"

export LANG=en_US.UTF-8
export EDITOR="code --wait"
export ARCHFLAGS="-arch $(uname -m)"

# Resolve repo root from ~/.zshrc symlink target (works wherever cloned)
_zshrc_path="${(%):-%N}"
[[ -L "$_zshrc_path" ]] && _zshrc_path="$(readlink "$_zshrc_path")"
export DOTFILES_DIR="$(cd "$(dirname "$_zshrc_path")/.." && pwd)"
unset _zshrc_path
export DEV_DIRECTORY="${DEV_DIRECTORY:-$HOME/Documents/dev}"

[ -f ~/.secrets ] && source ~/.secrets

touch "$HOME/.gemini/GEMINI.md"

alias zshconfig="$EDITOR $HOME/.zshrc"
alias ohmyzsh="$EDITOR $HOME/.oh-my-zsh"
alias please="make"
alias ls='ls -fla'
alias c='clear'
alias ducks='du -cks * | sort -rn | head -11'
alias top=vtop
alias gitconfig='git config --list --show-origin'
alias gitme="git config user.email"
alias docs="cd ~/Documents"
alias dev="cd $DEV_DIRECTORY"
alias repos="$DOTFILES_DIR/install/repos.sh"
alias software="$DOTFILES_DIR/install/software.sh"
alias acode="antigravity-ide"

export PATH="$HOME/.antigravity-ide/antigravity-ide/bin:$PATH"

eval "$(mise activate zsh)"

# Shell completions
() {
  local completions_dir="$DOTFILES_DIR/completions"
  [ -f "${completions_dir}/.mise" ] && source "${completions_dir}/.mise"
  [ -f "${completions_dir}/.bsw" ] && source "${completions_dir}/.bsw"
  [ -f "${completions_dir}/.wk" ] && source "${completions_dir}/.wk"
  if command -v terraform &>/dev/null; then
    autoload -U +X bashcompinit && bashcompinit
    complete -o nospace -C "$(command -v terraform)" terraform
  fi
}

check-port() {
  echo "checking port $1"
  lsof -i:"$1"
}

kill-port() {
  echo "killing process on port $1"
  { kill -9 "$(lsof -ti tcp:"$1")" && echo "done" } || echo "no process running"
}

# Machine-specific overrides (gitignored)
[ -f ~/.local.zsh ] && source ~/.local.zsh

# mise / uv / other local tool env
[ -f "$HOME/.local/bin/env" ] && . "$HOME/.local/bin/env"

# Hugging Face download tuning
export HF_XET_HIGH_PERFORMANCE=1
export HF_XET_NUM_CONCURRENT_RANGE_GETS=64
    
export PATH="/Users/worthington/Documents/dev/archlens/app/dist:$PATH"

# Sonar
export SONARQUBE_ORG='mzworthington'

export CLAUDE_CODE_ENABLE_TELEMETRY="1"
export OTEL_METRICS_EXPORTER="otlp"
export OTEL_LOGS_EXPORTER="otlp"
export OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
export SIGNOZ_URL="${SIGNOZ_URL:-http://localhost:8080}"

# After mise/homebrew PATH mutations so these win over brew `docker`.
export PATH="$DOTFILES_DIR/bin:$PATH"
