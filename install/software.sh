#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_APPS="${INSTALL_APPS:-1}"
INSTALL_AI="${INSTALL_AI:-1}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "software.sh: skipping (macOS only)"
  exit 0
fi

if ! command -v brew &>/dev/null; then
  echo "ERROR: Homebrew not found. Run bootstrap.sh first."
  exit 1
fi

echo "==> Updating Homebrew…"
brew update

echo "==> Installing core Homebrew packages…"
brew bundle check --file "${INSTALL_DIR}/homebrew/Brewfile" >/dev/null 2>&1 \
  || brew bundle --file "${INSTALL_DIR}/homebrew/Brewfile"

if [[ "${INSTALL_APPS}" == "1" && -f "${INSTALL_DIR}/homebrew/Brewfile.apps" ]]; then
  echo "==> Installing desktop apps…"
  brew bundle check --file "${INSTALL_DIR}/homebrew/Brewfile.apps" >/dev/null 2>&1 \
    || brew bundle --file "${INSTALL_DIR}/homebrew/Brewfile.apps"
fi

if [[ "${INSTALL_AI}" == "1" && -f "${INSTALL_DIR}/homebrew/Brewfile.ai" ]]; then
  echo "==> Installing AI tools…"
  brew bundle check --file "${INSTALL_DIR}/homebrew/Brewfile.ai" >/dev/null 2>&1 \
    || brew bundle --file "${INSTALL_DIR}/homebrew/Brewfile.ai"
fi

if command -v container &>/dev/null; then
  echo "==> Starting Apple container at login…"
  brew services start container
  container system start || true
fi

echo "==> Cleaning up Homebrew…"
brew cleanup

if command -v mise &>/dev/null; then
  echo "==> Installing mise tools…"
  mise install
  mise up
else
  echo "WARN: mise not found; skipping tool installation"
fi

if [[ "${INSTALL_AI}" == "1" ]]; then
  echo "==> Installing software outside brew/mise…"
  if ! command -v unsloth &>/dev/null; then
    echo "Installing Unsloth…"
    curl -fsSL https://unsloth.ai/install.sh | sh
  else
    echo "Unsloth already installed"
  fi

  if ! command -v dcode &>/dev/null; then
    curl -LsSf https://langch.in/dcode | bash
  fi
fi

echo "==> Software install complete"
