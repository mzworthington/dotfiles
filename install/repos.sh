#!/usr/bin/env bash
# Clone optional companion repositories.
set -euo pipefail

DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV_DIRECTORY="${DEV_DIRECTORY:-$HOME/Documents/dev}"
# shellcheck source=/dev/null
source "${DOTFILES_DIR}/install/repos.conf"

clone_repo() {
  local name="$1"
  local url="$2"
  local path="$3"
  local install_script="${4:-}"
  local optional="${5:-0}"

  path="${path/#\~/$HOME}"

  if [[ -d "${path}/.git" ]]; then
    echo "OK: ${name} already cloned at ${path}"
  else
    mkdir -p "$(dirname "${path}")"
    echo "==> Cloning ${name}…"
    if ! git clone "${url}" "${path}"; then
      if [[ "${optional}" == "1" ]]; then
        echo "WARN: optional repo ${name} failed to clone"
        return 0
      fi
      return 1
    fi
  fi

  if [[ -n "${install_script}" && -x "${path}/${install_script}" ]]; then
    echo "==> Running ${name} install script…"
    (cd "${path}" && "./${install_script}")
  fi
}

for entry in "${REPOS[@]}"; do
  IFS='|' read -r name url path install_script optional <<< "${entry}"
  clone_repo "${name}" "${url}" "${path}" "${install_script}" "${optional}"
done
