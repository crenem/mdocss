import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import JSZip from "jszip";

function run(args) {
  return spawnSync(process.execPath, ["src/cli.js", ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
}

async function load(file) {
  return JSZip.loadAsync(await fs.readFile(file));
}

test("set-root preserves unknown package content", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mdocss-edit-root-"));
  const target = path.join(dir, "doc.mdocss");
  const source = path.join("conformance", "fixtures", "valid-unknown-members.mdocss");
  const markdown = path.join(dir, "replacement.md");

  await fs.copyFile(source, target);
  await fs.writeFile(markdown, "# Replaced root\n\nPreserve everything else.\n", "utf8");

  let result = run(["set-root", target, markdown]);
  assert.equal(result.status, 0, result.stderr);

  result = run(["validate", target]);
  assert.equal(result.status, 0, result.stderr);

  const zip = await load(target);
  assert.match(await zip.file("root.md").async("string"), /Replaced root/);
  assert.equal(
    await zip.file("extensions/vendor.json").async("string"),
    '{"hello":"world"}\n'
  );

  const manifest = JSON.parse(await zip.file("manifest.json").async("string"));
  assert.equal(manifest["x-example"].mode, "preserve-me");
  assert.equal(manifest["x-example"].number, 42);
});

test("style add, rename, move, and remove round-trip cleanly", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mdocss-edit-style-"));
  const target = path.join(dir, "doc.mdocss");
  const css = path.join(dir, "apa7.css");

  await fs.copyFile(
    path.join("conformance", "fixtures", "valid-minimal.mdocss"),
    target
  );
  await fs.writeFile(
    css,
    ".mdocss-document { font-family: serif; line-height: 2; }\n",
    "utf8"
  );

  let result = run([
    "add-style", target, css,
    "--id", "apa7",
    "--label", "APA 7th Edition",
    "--profile", "org.mdocss.apa7",
    "--default"
  ]);
  assert.equal(result.status, 0, result.stderr);

  result = run(["validate", target]);
  assert.equal(result.status, 0, result.stderr);

  result = run([
    "rename-style", target, "apa7", "academic",
    "--label", "Academic",
    "--href", "styles/academic.css"
  ]);
  assert.equal(result.status, 0, result.stderr);

  let zip = await load(target);
  let manifest = JSON.parse(await zip.file("manifest.json").async("string"));
  assert.equal(manifest.defaultStylesheet, "academic");
  assert.equal(manifest.stylesheets[0].href, "styles/academic.css");
  assert.ok(zip.file("styles/academic.css"));
  assert.equal(zip.file("styles/apa7.css"), null);

  result = run(["remove-style", target, "academic", "--delete-css"]);
  assert.equal(result.status, 0, result.stderr);

  result = run(["validate", target]);
  assert.equal(result.status, 0, result.stderr);

  zip = await load(target);
  manifest = JSON.parse(await zip.file("manifest.json").async("string"));
  assert.deepEqual(manifest.stylesheets, []);
  assert.equal("defaultStylesheet" in manifest, false);
  assert.equal(zip.file("styles/academic.css"), null);
});

test("set-manifest validates before replacing the original archive", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mdocss-edit-manifest-"));
  const target = path.join(dir, "doc.mdocss");
  const manifestFile = path.join(dir, "manifest.json");

  await fs.copyFile(
    path.join("conformance", "fixtures", "valid-minimal.mdocss"),
    target
  );
  const before = await fs.readFile(target);

  await fs.writeFile(
    manifestFile,
    JSON.stringify({
      specVersion: "0.1.0",
      entrypoint: "wrong.md"
    }),
    "utf8"
  );

  const result = run(["set-manifest", target, manifestFile]);
  assert.notEqual(result.status, 0);

  const after = await fs.readFile(target);
  assert.deepEqual(after, before);
});
