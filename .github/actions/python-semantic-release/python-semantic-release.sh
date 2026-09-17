#!/usr/bin/env bash
set -euo pipefail

export PATH="${PWD}/.venv/bin:${PATH}"
tag_match="${TAG_MATCH:-v*}"
pyproject="${PYPROJECT:-pyproject.toml}"
python_bin="$(command -v python || command -v python3)"

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

if ! git describe --tags --match "${tag_match}" >/dev/null 2>&1; then
  VERSION="$(
    PYPROJECT_PATH="${pyproject}" "${python_bin}" -c \
      'import os, tomllib; print(tomllib.load(open(os.environ["PYPROJECT_PATH"], "rb"))["project"]["version"])'
  )"
  git tag "v${VERSION}"
  echo "Seeded baseline tag v${VERSION} from ${pyproject}"
fi

print_log="$(semantic-release version --print 2>&1 || true)"
printf '%s\n' "${print_log}"
if printf '%s\n' "${print_log}" | grep -qiE 'No release will be made|No release will be created'; then
  echo "No semantic-release version to cut; skipping publish."
  exit 0
fi

semantic-release version
git fetch origin main
git pull --ff-only origin main
semantic-release publish
