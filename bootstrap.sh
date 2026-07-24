#!/usr/bin/env bash
# Fresh-machine bootstrap: prerequisites → clone/update → link → software → companion repos.
set -euo pipefail

DOTFILES_REPO="${DOTFILES_REPO:-https://github.com/mzworthington/dotfiles.git}"
DOTFILES_DIR="${DOTFILES_DIR:-$HOME/.dotfiles}"
INSTALL_APPS="${INSTALL_APPS:-1}"
INSTALL_AI="${INSTALL_AI:-1}"

echo "==> Dotfiles bootstrap"
echo "    repo: ${DOTFILES_REPO}"
echo "    dir:  ${DOTFILES_DIR}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "ERROR: This bootstrap currently supports macOS only."
  exit 1
fi

if ! xcode-select -p &>/dev/null; then
  echo "==> Installing Xcode Command Line Tools…"
  xcode-select --install
  echo "    Complete the installer, then re-run bootstrap.sh"
  exit 1
fi

if ! command -v brew &>/dev/null; then
  echo "==> Installing Homebrew…"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

if [[ -x /opt/homebrew/bin/brew ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [[ -x /usr/local/bin/brew ]]; then
  eval "$(/usr/local/bin/brew shellenv)"
fi

if [[ -d "${DOTFILES_DIR}/.git" ]]; then
  echo "==> Updating dotfiles…"
  git -C "${DOTFILES_DIR}" pull --ff-only
else
  echo "==> Cloning dotfiles…"
  mkdir -p "$(dirname "${DOTFILES_DIR}")"
  git clone "${DOTFILES_REPO}" "${DOTFILES_DIR}"
fi

if [[ ! -d "${HOME}/.oh-my-zsh" ]]; then
  echo "==> Installing Oh My Zsh…"
  RUNZSH=no CHSH=no KEEP_ZSHRC=yes \
    sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
fi

"${DOTFILES_DIR}/install/link.sh"
INSTALL_APPS="${INSTALL_APPS}" INSTALL_AI="${INSTALL_AI}" "${DOTFILES_DIR}/install/software.sh"
"${DOTFILES_DIR}/install/repos.sh"

echo ""
echo "==> Bootstrap complete."
echo "    Open a new terminal or run: exec zsh -l"
