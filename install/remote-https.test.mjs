import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("remote installers refuse redirects off HTTPS", () => {
  const scripts = ["bootstrap.sh", "install/software.sh"];
  for (const rel of scripts) {
    const lines = readFileSync(join(root, rel), "utf8")
      .split("\n")
      .filter((line) => line.includes("curl ") && line.includes("http"));
    assert.ok(lines.length > 0, `${rel} should download a remote installer`);
    for (const line of lines) {
      assert.match(line, /--proto '=https'/);
      assert.match(line, /--tlsv1\.2/);
    }
  }
});
