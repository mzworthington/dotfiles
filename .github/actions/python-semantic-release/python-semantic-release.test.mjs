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

function tags(cwd) {
  return execFileSync("git", ["tag", "-l", "v*"], { cwd, encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);
}

function writeStub(cwd, printLine) {
  const binDir = join(cwd, ".venv", "bin");
  mkdirSync(binDir, { recursive: true });
  const stub = join(binDir, "semantic-release");
  writeFileSync(
    stub,
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "\${PWD}/.sr-calls"
if [[ "\${1:-}" == "version" && "\${2:-}" == "--print" ]]; then
  echo "${printLine}"
  exit 0
fi
if [[ "\${1:-}" == "version" || "\${1:-}" == "publish" ]]; then
  exit 0
fi
echo "unexpected args: $*" >&2
exit 1
`,
  );
  chmodSync(stub, 0o755);
}

async function initRepo() {
  const cwd = await mkdtemp(join(tmpdir(), "python-release-"));
  execFileSync("git", ["init", "-b", "main"], { cwd });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd });
  execFileSync("git", ["config", "user.name", "Test"], { cwd });
  writeFileSync(
    join(cwd, "pyproject.toml"),
    '[project]\nname = "demo"\nversion = "1.2.3"\n',
  );
  execFileSync("git", ["add", "pyproject.toml"], { cwd });
  execFileSync("git", ["commit", "-m", "seed"], { cwd });
  writeStub(cwd, "No release will be made");
  return cwd;
}

test("seeds a baseline v-star tag from pyproject when none exist", async () => {
  const cwd = await initRepo();
  execFileSync("bash", [script], { cwd });
  assert.deepEqual(tags(cwd), ["v1.2.3"]);
});

test("skips publish when semantic-release will not cut a version", async () => {
  const cwd = await initRepo();
  execFileSync("git", ["tag", "v1.0.0"], { cwd });
  execFileSync("bash", [script], { cwd });
  assert.deepEqual(tags(cwd).sort(), ["v1.0.0"]);
});

test("does not retag pyproject version when a v-star tag exists but does not describe HEAD", async () => {
  const cwd = await initRepo();
  execFileSync("git", ["checkout", "--orphan", "other"], { cwd });
  writeFileSync(join(cwd, "other.txt"), "x\n");
  execFileSync("git", ["add", "other.txt"], { cwd });
  execFileSync("git", ["commit", "-m", "orphan"], { cwd });
  execFileSync("git", ["tag", "v1.2.3"], { cwd });
  execFileSync("git", ["checkout", "main"], { cwd });
  execFileSync("bash", [script], { cwd });
  assert.deepEqual(tags(cwd), ["v1.2.3"]);
});

test("runs version, fast-forwards main, and publishes when a release is due", async () => {
  const cwd = await initRepo();
  execFileSync("git", ["tag", "v1.0.0"], { cwd });
  writeStub(cwd, "1.2.4");
  const origin = await mkdtemp(join(tmpdir(), "python-release-origin-"));
  execFileSync("git", ["clone", "--bare", cwd, origin]);
  execFileSync("git", ["remote", "add", "origin", origin], { cwd });
  execFileSync("bash", [script], { cwd });
  const calls = readFileSync(join(cwd, ".sr-calls"), "utf8");
  assert.match(calls, /^version --print$/m);
  assert.match(calls, /^version$/m);
  assert.match(calls, /^publish$/m);
});

test("force-level minor still publishes when print would skip", async () => {
  const cwd = await initRepo();
  execFileSync("git", ["tag", "v1.0.0"], { cwd });
  writeStub(cwd, "No release will be made, 0.1.0 has already been released!");
  const origin = await mkdtemp(join(tmpdir(), "python-release-origin-"));
  execFileSync("git", ["clone", "--bare", cwd, origin]);
  execFileSync("git", ["remote", "add", "origin", origin], { cwd });
  execFileSync("bash", [script], {
    cwd,
    env: { ...process.env, FORCE_LEVEL: "minor" },
  });
  const calls = readFileSync(join(cwd, ".sr-calls"), "utf8");
  assert.match(calls, /^version --minor$/m);
  assert.match(calls, /^publish$/m);
  assert.doesNotMatch(calls, /^version --print$/m);
});

test("attaches detached HEAD to main so a due release is not skipped", async () => {
  const cwd = await initRepo();
  execFileSync("git", ["tag", "v1.0.0"], { cwd });
  const binDir = join(cwd, ".venv", "bin");
  mkdirSync(binDir, { recursive: true });
  writeFileSync(
    join(binDir, "semantic-release"),
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "\${PWD}/.sr-calls"
if ! git symbolic-ref -q HEAD >/dev/null; then
  echo "No release will be made, 0.1.0 has already been released!"
  exit 0
fi
if [[ "\${1:-}" == "version" && "\${2:-}" == "--print" ]]; then
  echo "1.2.4"
  exit 0
fi
if [[ "\${1:-}" == "version" || "\${1:-}" == "publish" ]]; then
  exit 0
fi
echo "unexpected args: $*" >&2
exit 1
`,
  );
  chmodSync(join(binDir, "semantic-release"), 0o755);
  const origin = await mkdtemp(join(tmpdir(), "python-release-origin-"));
  execFileSync("git", ["clone", "--bare", cwd, origin]);
  execFileSync("git", ["remote", "add", "origin", origin], { cwd });
  execFileSync("git", ["checkout", "--detach"], { cwd });
  execFileSync("bash", [script], { cwd });
  const calls = readFileSync(join(cwd, ".sr-calls"), "utf8");
  assert.match(calls, /^version$/m);
  assert.match(calls, /^publish$/m);
});
