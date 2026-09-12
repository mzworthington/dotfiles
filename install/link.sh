#!/usr/bin/env bash
# Create symlinks from home → dotfiles repo. Safe to re-run.
set -euo pipefail

DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV_DIRECTORY="${DEV_DIRECTORY:-$HOME/Documents/dev}"

link() {
  local target="$1"
  local linkpath="$2"

  mkdir -p "$(dirname "${linkpath}")"

  if [[ -L "${linkpath}" ]]; then
    local current
    current="$(readlink "${linkpath}")"
    if [[ "${current}" == "${target}" ]]; then
      echo "OK: ${linkpath}"
      return 0
    fi
    rm "${linkpath}"
  elif [[ -e "${linkpath}" ]]; then
    echo "SKIP: ${linkpath} exists and is not a symlink" >&2
    return 1
  fi

  ln -s "${target}" "${linkpath}"
  echo "linked ${linkpath} -> ${target}"
}

echo "==> Linking dotfiles from ${DOTFILES_DIR}"

link "${DOTFILES_DIR}/zsh/.zshrc" "${HOME}/.zshrc"
link "${DOTFILES_DIR}/zsh/.zprofile" "${HOME}/.zprofile"
link "${DOTFILES_DIR}/git/.gitignore_global" "${HOME}/.gitignore_global"

link "${DOTFILES_DIR}/install/mise/config.toml" "${HOME}/.config/mise/config.toml"
link "${DOTFILES_DIR}/config/opencode/opencode.jsonc" "${HOME}/.config/opencode/opencode.jsonc"

if [[ -d "${DEV_DIRECTORY}/waykit" ]]; then
  link "${DEV_DIRECTORY}/waykit" "${HOME}/.agents"
fi

if [[ ! -f "${HOME}/.secrets" ]]; then
  cp "${DOTFILES_DIR}/secrets.example" "${HOME}/.secrets"
  chmod 600 "${HOME}/.secrets"
  echo "created ${HOME}/.secrets from secrets.example"
fi

if [[ ! -f "${HOME}/.local.zsh" && -f "${DOTFILES_DIR}/zsh/local.example.zsh" ]]; then
  cp "${DOTFILES_DIR}/zsh/local.example.zsh" "${HOME}/.local.zsh"
  echo "created ${HOME}/.local.zsh from local.example.zsh"
fi

if git config --global core.excludesfile &>/dev/null; then
  :
else
  git config --global core.excludesfile "${HOME}/.gitignore_global"
  echo "set git core.excludesfile -> ~/.gitignore_global"
fi

echo "==> Linking complete"
