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

# PSR pushes https://$GITHUB_ACTOR:$GH_TOKEN@github.com/..., which is rejected
# when main moved (non-fast-forward ruleset) or the actor does not own the token.
# Commit locally, replay onto the latest main, then push with checkout credentials.
publish_release() {
  local before after branch version tag notes
  before="$(git rev-parse HEAD)"
  semantic-release version "$@" --no-push --no-tag
  after="$(git rev-parse HEAD)"
  if [ "${before}" = "${after}" ]; then
    echo "No release commit; skipping push."
    semantic-release publish
    return 0
  fi

  git fetch origin main
  if ! git merge-base --is-ancestor origin/main HEAD; then
    git rebase origin/main
  fi

  version="$(
    PYPROJECT_PATH="${pyproject}" "${python_bin}" -c \
      'import os, tomllib; print(tomllib.load(open(os.environ["PYPROJECT_PATH"], "rb"))["project"]["version"])'
  )"
  tag="v${version}"
  if git rev-parse -q --verify "refs/tags/${tag}" >/dev/null; then
    if [ "$(git rev-parse "${tag}^{}")" != "$(git rev-parse HEAD)" ]; then
      echo "Tag ${tag} already points at a different commit" >&2
      exit 1
    fi
  else
    git tag -a "${tag}" -m "${tag}"
  fi

  branch="$(git rev-parse --abbrev-ref HEAD)"
  if [ "${branch}" = "HEAD" ]; then
    branch="main"
  fi
  git push origin "HEAD:${branch}"
  git push origin "refs/tags/${tag}"

  if [ "${GITHUB_ACTIONS:-}" = "true" ] && command -v gh >/dev/null; then
    if ! gh release view "${tag}" >/dev/null 2>&1; then
      notes="$(
        awk -v heading="## ${tag} " '
          $0 ~ "^" heading { found=1; next }
          found && /^## / { exit }
          found { print }
        ' CHANGELOG.md
      )"
      gh release create "${tag}" --title "${tag}" --notes "${notes}"
    fi
  fi
  semantic-release publish
}

force_level="${FORCE_LEVEL:-}"
case "${force_level}" in
  "") ;;
  patch | minor | major)
    publish_release "--${force_level}"
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
    publish_release --minor
    exit 0
  fi
  echo "No semantic-release version to cut; skipping publish."
  exit 0
fi

publish_release
