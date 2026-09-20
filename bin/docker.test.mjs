import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const dockerShim = join(dirname(fileURLToPath(import.meta.url)), "docker");

async function fakeBins() {
  const dir = await mkdtemp(join(tmpdir(), "docker-shim-"));
  const container = join(dir, "container");
  const compose = join(dir, "container-compose");
  writeFileSync(
    container,
    `#!/usr/bin/env bash
printf 'container:%s\\n' "$*"
`,
  );
  writeFileSync(
    compose,
    `#!/usr/bin/env bash
printf 'compose:%s\\n' "$*"
`,
  );
  chmodSync(container, 0o755);
  chmodSync(compose, 0o755);
  return { dir, container, compose };
}

function runDocker(env, args) {
  return execFileSync(dockerShim, args, {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

test("docker ps maps to container list", async () => {
  const { container, compose } = await fakeBins();
  const out = runDocker(
    { CONTAINER_BIN: container, CONTAINER_COMPOSE_BIN: compose },
    ["ps"],
  );
  assert.equal(out, "container:list\n");
});

test("docker images maps to container image list", async () => {
  const { container, compose } = await fakeBins();
  const out = runDocker(
    { CONTAINER_BIN: container, CONTAINER_COMPOSE_BIN: compose },
    ["images"],
  );
  assert.equal(out, "container:image list\n");
});

test("docker pull maps to container image pull", async () => {
  const { container, compose } = await fakeBins();
  const out = runDocker(
    { CONTAINER_BIN: container, CONTAINER_COMPOSE_BIN: compose },
    ["pull", "alpine:latest"],
  );
  assert.equal(out, "container:image pull alpine:latest\n");
});

test("docker compose delegates to container-compose", async () => {
  const { container, compose } = await fakeBins();
  const out = runDocker(
    { CONTAINER_BIN: container, CONTAINER_COMPOSE_BIN: compose },
    ["compose", "up", "-d"],
  );
  assert.equal(out, "compose:up -d\n");
});

test("docker version maps to container --version", async () => {
  const { container, compose } = await fakeBins();
  const out = runDocker(
    { CONTAINER_BIN: container, CONTAINER_COMPOSE_BIN: compose },
    ["version"],
  );
  assert.equal(out, "container:--version\n");
});

test("docker info maps to container system status", async () => {
  const { container, compose } = await fakeBins();
  const out = runDocker(
    { CONTAINER_BIN: container, CONTAINER_COMPOSE_BIN: compose },
    ["info"],
  );
  assert.equal(out, "container:system status\n");
});
