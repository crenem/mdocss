import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function run(args) {
  return spawnSync(process.execPath, ["src/cli.js", ...args], { encoding: "utf8" });
}

test("basic example can be packed, validated, and exposes named styles", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "mdocss-"));
  const output = path.join(dir, "example.mdocss");

  let result = run(["pack", "examples/basic", output]);
  assert.equal(result.status, 0, result.stderr);

  result = run(["validate", output]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Valid MDOCSS/);

  result = run(["styles", output]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\* default\s+root\.css\s+Default/);
  assert.match(result.stdout, /dark\s+styles\/dark\.css\s+Dark/);
  assert.match(result.stdout, /manuscript\s+styles\/manuscript\.css\s+Manuscript/);

  assert.ok((await readFile(output)).length > 0);
});

test("semantic paper example round-trips its stylesheet declarations", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "mdocss-semantic-"));
  const output = path.join(dir, "semantic-paper.mdocss");

  let result = run(["pack", "examples/semantic-paper", output]);
  assert.equal(result.status, 0, result.stderr);

  result = run(["validate", output]);
  assert.equal(result.status, 0, result.stderr);

  result = run(["styles", output]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\* academic\s+styles\/academic\.css\s+Academic/);
  assert.match(result.stdout, /reading\s+styles\/reading\.css\s+Reading/);
});
