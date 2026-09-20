import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const composeShim = join(
  dirname(fileURLToPath(import.meta.url)),
  "docker-compose",
);

test("docker-compose delegates to container-compose", async () => {
  const dir = await mkdtemp(join(tmpdir(), "compose-shim-"));
  const compose = join(dir, "container-compose");
  writeFileSync(
    compose,
    `#!/usr/bin/env bash
printf 'compose:%s\\n' "$*"
`,
  );
  chmodSync(compose, 0o755);
  const out = execFileSync(composeShim, ["up", "-d"], {
    encoding: "utf8",
    env: { ...process.env, CONTAINER_COMPOSE_BIN: compose },
  });
  assert.equal(out, "compose:up -d\n");
});
