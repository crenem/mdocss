import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

test("example can be packed, validated, and exposes named styles", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "mdocss-"));
  const output = path.join(dir, "example.mdocss");

  let result = spawnSync(process.execPath, ["src/cli.js", "pack", "examples/basic", output], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);

  result = spawnSync(process.execPath, ["src/cli.js", "validate", output], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Valid MDOCSS/);

  result = spawnSync(process.execPath, ["src/cli.js", "styles", output], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\* default\s+root\.css\s+Default/);
  assert.match(result.stdout, /dark\s+styles\/dark\.css\s+Dark/);
  assert.match(result.stdout, /manuscript\s+styles\/manuscript\.css\s+Manuscript/);

  assert.ok((await readFile(output)).length > 0);
});
