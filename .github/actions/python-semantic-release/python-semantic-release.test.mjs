import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = join(
  dirname(fileURLToPath(import.meta.url)),
  "python-semantic-release.sh",
);

function git(cwd, args, options = {}) {
  return execFileSync("git", args, { cwd, encoding: "utf8", ...options });
}

function tags(cwd) {
  return git(cwd, ["tag", "-l", "v*"]).trim().split("\n").filter(Boolean);
}

function srCalls(cwd) {
  return readFileSync(join(cwd, ".sr-calls"), "utf8");
}

function run(cwd, env = {}) {
  execFileSync("bash", [script], { cwd, env: { ...process.env, ...env } });
}

function writeStub(
  cwd,
  { print = "No release will be made", prelude = "", onNoPush = "" } = {},
) {
  const binDir = join(cwd, ".venv", "bin");
  mkdirSync(binDir, { recursive: true });
  const stub = join(binDir, "semantic-release");
  writeFileSync(
    stub,
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "\${PWD}/.sr-calls"
${prelude}if [[ "\${1:-}" == "version" && "\${2:-}" == "--print" ]]; then
  echo "${print}"
  exit 0
fi
${onNoPush}if [[ "\${1:-}" == "version" || "\${1:-}" == "publish" ]]; then
  exit 0
fi
echo "unexpected args: $*" >&2
exit 1
`,
  );
  chmodSync(stub, 0o755);
}

function commitReleaseOnNoPush(version) {
  return `if [[ "\${1:-}" == "version" && "$*" == *"--no-push"* ]]; then
  printf '[project]\\nname = "demo"\\nversion = "${version}"\\n' > pyproject.toml
  git add pyproject.toml
  git commit -m "chore(release): ${version}"
  exit 0
fi
`;
}

const refuseDetached = `if ! git symbolic-ref -q HEAD >/dev/null; then
  echo "No release will be made, 0.1.0 has already been released!"
  exit 0
fi
`;

async function initRepo() {
  const cwd = await mkdtemp(join(tmpdir(), "python-release-"));
  git(cwd, ["init", "-b", "main"]);
  git(cwd, ["config", "user.email", "test@example.com"]);
  git(cwd, ["config", "user.name", "Test"]);
  writeFileSync(
    join(cwd, "pyproject.toml"),
    '[project]\nname = "demo"\nversion = "1.2.3"\n',
  );
  git(cwd, ["add", "pyproject.toml"]);
  git(cwd, ["commit", "-m", "seed"]);
  writeStub(cwd);
  return cwd;
}

async function addOrigin(cwd) {
  const origin = await mkdtemp(join(tmpdir(), "python-release-origin-"));
  execFileSync("git", ["clone", "--bare", cwd, origin]);
  git(cwd, ["remote", "add", "origin", origin]);
  return origin;
}

test("seeds a baseline v-star tag from pyproject when none exist", async () => {
  const cwd = await initRepo();
  run(cwd);
  assert.deepEqual(tags(cwd), ["v1.2.3"]);
});

test("skips publish when semantic-release will not cut a version", async () => {
  const cwd = await initRepo();
  git(cwd, ["tag", "v1.0.0"]);
  run(cwd);
  assert.deepEqual(tags(cwd).sort(), ["v1.0.0"]);
});

test("does not retag pyproject version when a v-star tag exists but does not describe HEAD", async () => {
  const cwd = await initRepo();
  git(cwd, ["checkout", "--orphan", "other"]);
  writeFileSync(join(cwd, "other.txt"), "x\n");
  git(cwd, ["add", "other.txt"]);
  git(cwd, ["commit", "-m", "orphan"]);
  git(cwd, ["tag", "v1.2.3"]);
  git(cwd, ["checkout", "main"]);
  run(cwd);
  assert.deepEqual(tags(cwd), ["v1.2.3"]);
});

test("rebases a local release commit onto origin/main and pushes that fast-forward", async () => {
  const cwd = await initRepo();
  git(cwd, ["tag", "v1.0.0"]);
  writeStub(cwd, { print: "1.2.4", onNoPush: commitReleaseOnNoPush("1.2.4") });
  const origin = await addOrigin(cwd);
  const other = await mkdtemp(join(tmpdir(), "python-release-other-"));
  execFileSync("git", ["clone", origin, other]);
  git(other, ["config", "user.email", "other@example.com"]);
  git(other, ["config", "user.name", "Other"]);
  writeFileSync(join(other, "moved.txt"), "landed while releasing\n");
  git(other, ["add", "moved.txt"]);
  git(other, ["commit", "-m", "landed on main"]);
  git(other, ["push", "origin", "HEAD:main"]);
  run(cwd);
  const originLog = git(origin, ["log", "--format=%s", "main"]);
  assert.match(originLog, /chore\(release\): 1\.2\.4/);
  assert.match(originLog, /landed on main/);
  assert.equal(
    git(origin, ["rev-parse", "v1.2.4^{}"]).trim(),
    git(origin, ["rev-parse", "main"]).trim(),
  );
});

test("drops GITHUB_OUTPUT for version --no-tag so a missing commit_sha does not fail the step", async () => {
  const cwd = await initRepo();
  git(cwd, ["tag", "v1.0.0"]);
  writeStub(cwd, {
    print: "1.2.4",
    onNoPush: `printf 'env=%s args=%s\\n' "\${GITHUB_OUTPUT-<unset>}" "\$*" >> "\${PWD}/.sr-calls"
if [[ "\${1:-}" == "version" && " \$* " == *" --no-tag "* && -n "\${GITHUB_OUTPUT:-}" ]]; then
  echo "some required outputs were not set: commit_sha" >&2
  exit 1
fi
`,
  });
  await addOrigin(cwd);
  const outputFile = join(cwd, "gha-output");
  writeFileSync(outputFile, "");
  run(cwd, { GITHUB_OUTPUT: outputFile });
  const calls = srCalls(cwd);
  assert.match(calls, /^env= args=version --no-push --no-tag$/m);
  assert.match(calls, /^env=.+ args=publish$/m);
});

test("runs version, fast-forwards main, and publishes when a release is due", async () => {
  const cwd = await initRepo();
  git(cwd, ["tag", "v1.0.0"]);
  writeStub(cwd, { print: "1.2.4" });
  await addOrigin(cwd);
  run(cwd);
  const calls = srCalls(cwd);
  assert.match(calls, /^version --print$/m);
  assert.match(calls, /^version --no-push --no-tag$/m);
  assert.match(calls, /^publish$/m);
});

test("force-level minor still publishes when print would skip", async () => {
  const cwd = await initRepo();
  git(cwd, ["tag", "v1.0.0"]);
  writeStub(cwd, { print: "No release will be made, 0.1.0 has already been released!" });
  await addOrigin(cwd);
  run(cwd, { FORCE_LEVEL: "minor" });
  const calls = srCalls(cwd);
  assert.match(calls, /^version --minor --no-push --no-tag$/m);
  assert.match(calls, /^publish$/m);
  assert.doesNotMatch(calls, /^version --print$/m);
});

test("bumps from the latest v-star tag when print reports a stale 0.1.0 skip", async () => {
  const cwd = await initRepo();
  git(cwd, ["tag", "v1.2.3"]);
  writeStub(cwd, {
    print: "0.1.0\nNo release will be made, 0.1.0 has already been released!",
  });
  await addOrigin(cwd);
  run(cwd);
  const calls = srCalls(cwd);
  assert.match(calls, /^version --print$/m);
  assert.match(calls, /^version --minor --no-push --no-tag$/m);
  assert.match(calls, /^publish$/m);
});

test("attaches detached HEAD to main so a due release is not skipped", async () => {
  const cwd = await initRepo();
  git(cwd, ["tag", "v1.0.0"]);
  writeStub(cwd, { print: "1.2.4", prelude: refuseDetached });
  await addOrigin(cwd);
  git(cwd, ["checkout", "--detach"]);
  run(cwd);
  const calls = srCalls(cwd);
  assert.match(calls, /^version --no-push --no-tag$/m);
  assert.match(calls, /^publish$/m);
});
