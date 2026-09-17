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
