#!/usr/bin/env bash
set -euo pipefail

output="${GITHUB_OUTPUT:-/dev/stdout}"
tag_match="${TAG_MATCH:-v*}"

git fetch --tags --force >/dev/null 2>&1 || true

last_tag="$(git for-each-ref --sort=-v:refname --format='%(refname:short)' --count=1 "refs/tags/${tag_match}")"
if [ -z "${last_tag}" ]; then
  echo "release=true" >> "${output}"
  echo "No previous release tag found; release required."
  exit 0
fi

echo "last_tag=${last_tag}" >> "${output}"

# Split on IFS whitespace so GitHub multiline `paths:` inputs work.
# shellcheck disable=SC2206
pathspecs=(${PATHS:-})
if [ "${#pathspecs[@]}" -eq 0 ]; then
  echo "PATHS is required" >&2
  exit 1
fi

if git diff --quiet "${last_tag}" HEAD -- "${pathspecs[@]}"; then
  echo "release=false" >> "${output}"
  echo "No application changes since ${last_tag}."
else
  echo "release=true" >> "${output}"
  echo "Application changes detected since ${last_tag}."
fi
