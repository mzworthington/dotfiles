#!/usr/bin/env bash
set -euo pipefail

export PATH="${PWD}/.venv/bin:${PATH}"
tag_match="${TAG_MATCH:-v*}"
pyproject="${PYPROJECT:-pyproject.toml}"
python_bin="$(command -v python || command -v python3)"

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

git fetch --tags --force origin >/dev/null 2>&1 || git fetch --tags --force >/dev/null 2>&1 || true
if ! git symbolic-ref -q HEAD >/dev/null; then
  git checkout -B main HEAD
fi

if [ -z "$(git tag -l "${tag_match}")" ]; then
  VERSION="$(
    PYPROJECT_PATH="${pyproject}" "${python_bin}" -c \
      'import os, tomllib; print(tomllib.load(open(os.environ["PYPROJECT_PATH"], "rb"))["project"]["version"])'
  )"
  git tag "v${VERSION}"
  echo "Seeded baseline tag v${VERSION} from ${pyproject}"
fi

force_level="${FORCE_LEVEL:-}"
case "${force_level}" in
  "") ;;
  patch | minor | major)
    semantic-release version "--${force_level}"
    git fetch origin main
    git pull --ff-only origin main
    semantic-release publish
    exit 0
    ;;
  *)
    echo "FORCE_LEVEL must be patch, minor, or major (got ${force_level})" >&2
    exit 1
    ;;
esac

print_log="$(semantic-release version --print 2>&1 || true)"
printf '%s\n' "${print_log}"
if printf '%s\n' "${print_log}" | grep -qiE 'No release will be made|No release will be created'; then
  printed="$(printf '%s\n' "${print_log}" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+' | head -n 1 || true)"
  highest="$(git for-each-ref --sort=-v:refname --format='%(refname:short)' --count=1 "refs/tags/${tag_match}")"
  highest_ver="${highest#v}"
  if [ -n "${printed}" ] && [ -n "${highest_ver}" ] && [ "${printed}" != "${highest_ver}" ] && [ "$(printf '%s\n' "${printed}" "${highest_ver}" | sort -V | head -n 1)" = "${printed}" ]; then
    echo "PSR printed ${printed} but latest tag is ${highest}; bumping minor from the tag list."
    semantic-release version --minor
    git fetch origin main
    git pull --ff-only origin main
    semantic-release publish
    exit 0
  fi
  echo "No semantic-release version to cut; skipping publish."
  exit 0
fi

semantic-release version
git fetch origin main
git pull --ff-only origin main
semantic-release publish
