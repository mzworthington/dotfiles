import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const installDir = dirname(fileURLToPath(import.meta.url));
const reposConf = join(installDir, "repos.conf");

function repoPaths(devDirectory) {
  const output = execFileSync(
    "bash",
    ["-c", 'source "$1"; printf "%s\\n" "${REPOS[@]}"', "bash", reposConf],
    {
      env: { ...process.env, DEV_DIRECTORY: devDirectory },
      encoding: "utf8",
    },
  );
  const paths = new Map();
  for (const line of output.trim().split("\n")) {
    const [name, , path] = line.split("|");
    paths.set(name, path);
  }
  return paths;
}

test("edge-dns is checked out in its own directory", () => {
  const dev = "/tmp/dev-directory";
  const paths = repoPaths(dev);
  assert.equal(paths.get("edge-dns"), `${dev}/edge-dns`);
});

test("mzworthington is checked out under the dev directory", () => {
  const dev = "/tmp/dev-directory";
  const paths = repoPaths(dev);
  assert.equal(paths.get("mzworthington"), `${dev}/mzworthington`);
});

test("an existing checkout is fast-forwarded", async () => {
  const root = await mkdtemp(join(tmpdir(), "repos-sh-"));
  const dev = join(root, "dev");
  const bin = join(root, "bin");
  const log = join(root, "git.log");
  const archlens = join(dev, "archlens");
  await mkdir(join(archlens, ".git"), { recursive: true });
  await mkdir(bin, { recursive: true });
  await writeFile(
    join(bin, "git"),
    `#!/bin/bash
printf '%s\\n' "$*" >> "$GIT_LOG"
if [[ "$1" == "clone" ]]; then
  mkdir -p "$3/.git"
fi
exit 0
`,
  );
  await chmod(join(bin, "git"), 0o755);

  execFileSync("bash", [join(installDir, "repos.sh")], {
    cwd: root,
    env: {
      ...process.env,
      DEV_DIRECTORY: dev,
      GIT_LOG: log,
      HOME: root,
      PATH: `${bin}:${process.env.PATH}`,
    },
    encoding: "utf8",
  });

  const recorded = await readFile(log, "utf8");
  assert.ok(
    recorded.includes(`-C ${archlens} pull --ff-only`),
    `expected fast-forward of ${archlens}, got:\n${recorded}`,
  );
});

test("a dirty checkout is stashed, fast-forwarded, and restored", async () => {
  const root = await mkdtemp(join(tmpdir(), "repos-stash-"));
  const dev = join(root, "dev");
  const archlens = join(dev, "archlens");
  const remote = join(root, "remote.git");
  const seed = join(root, "seed");
  const bin = join(root, "bin");
  const realGit = execFileSync("which", ["git"], { encoding: "utf8" }).trim();
  const gitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@example.com",
  };
  const git = (cwd, args) => execFileSync(realGit, args, { cwd, env: gitEnv });

  execFileSync(realGit, ["init", "--bare", "-b", "main", remote], { env: gitEnv });
  await mkdir(seed, { recursive: true });
  git(seed, ["init", "-b", "main"]);
  await writeFile(join(seed, "keep.txt"), "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten\n");
  git(seed, ["add", "keep.txt"]);
  git(seed, ["commit", "-m", "seed"]);
  git(seed, ["remote", "add", "origin", remote]);
  git(seed, ["push", "-u", "origin", "HEAD"]);

  await mkdir(dev, { recursive: true });
  git(dev, ["clone", remote, archlens]);
  await writeFile(join(seed, "keep.txt"), "one-remote\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten\n");
  git(seed, ["commit", "-am", "upstream"]);
  git(seed, ["push"]);
  await writeFile(join(archlens, "keep.txt"), "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten-local\n");

  await mkdir(bin, { recursive: true });
  await writeFile(
    join(bin, "git"),
    `#!/bin/bash
if [[ "$1" == "-C" && "$2" == "$ARCHLENS" ]]; then
  exec "$REAL_GIT" "$@"
fi
if [[ "$1" == "clone" ]]; then
  mkdir -p "$3/.git"
  exit 0
fi
exec "$REAL_GIT" "$@"
`,
  );
  await chmod(join(bin, "git"), 0o755);

  execFileSync("bash", [join(installDir, "repos.sh")], {
    cwd: root,
    env: {
      ...gitEnv,
      ARCHLENS: archlens,
      DEV_DIRECTORY: dev,
      HOME: root,
      PATH: `${bin}:${process.env.PATH}`,
      REAL_GIT: realGit,
    },
    encoding: "utf8",
  });

  assert.equal(
    await readFile(join(archlens, "keep.txt"), "utf8"),
    "one-remote\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten-local\n",
  );
  assert.equal(execFileSync(realGit, ["-C", archlens, "stash", "list"], { encoding: "utf8" }), "");
});
