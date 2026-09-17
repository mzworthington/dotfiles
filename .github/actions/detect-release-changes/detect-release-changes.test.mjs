import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const script = join(
  dirname(fileURLToPath(import.meta.url)),
  "detect-release-changes.sh",
);

function detect(cwd, paths = "src/ pyproject.toml") {
  const outputFile = join(cwd, "github-output");
  execFileSync("bash", [script], {
    cwd,
    env: {
      ...process.env,
      PATHS: paths,
      GITHUB_OUTPUT: outputFile,
    },
  });
  return readFileSync(outputFile, "utf8");
}

async function initRepo() {
  const cwd = await mkdtemp(join(tmpdir(), "detect-release-"));
  execFileSync("git", ["init", "-b", "main"], { cwd });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd });
  execFileSync("git", ["config", "user.name", "Test"], { cwd });
  await writeFile(join(cwd, "README"), "seed\n");
  execFileSync("git", ["add", "README"], { cwd });
  execFileSync("git", ["commit", "-m", "seed"], { cwd });
  return cwd;
}

test("requires a release when no v-star tag exists", async () => {
  const cwd = await initRepo();
  assert.match(detect(cwd), /^release=true$/m);
});

test("skips release when listed paths are unchanged since the last tag", async () => {
  const cwd = await initRepo();
  execFileSync("git", ["tag", "v1.0.0"], { cwd });
  await writeFile(join(cwd, "README"), "docs only\n");
  execFileSync("git", ["add", "README"], { cwd });
  execFileSync("git", ["commit", "-m", "docs"], { cwd });
  assert.match(detect(cwd), /^release=false$/m);
});

test("requires a release when listed paths changed since the last tag", async () => {
  const cwd = await initRepo();
  execFileSync("git", ["tag", "v1.0.0"], { cwd });
  await mkdir(join(cwd, "src"), { recursive: true });
  await writeFile(join(cwd, "src", "app.py"), "print('app')\n");
  execFileSync("git", ["add", "src/app.py"], { cwd });
  execFileSync("git", ["commit", "-m", "feat"], { cwd });
  assert.match(detect(cwd), /^release=true$/m);
});
