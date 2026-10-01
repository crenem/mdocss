import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

async function walk(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

test("every checked-in example manifest matches the draft schema and package-level style references", async () => {
  const schema = JSON.parse(await fs.readFile("schema/manifest.schema.json", "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  const files = await walk("examples");
  const manifests = files.filter(file => path.basename(file) === "manifest.json");
  assert.ok(manifests.length >= 2, "expected checked-in example manifests");

  for (const manifestPath of manifests) {
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    assert.equal(
      validate(manifest),
      true,
      `${manifestPath}: ${ajv.errorsText(validate.errors)}`
    );

    const directory = path.dirname(manifestPath);
    const ids = new Set();

    for (const style of manifest.stylesheets ?? []) {
      assert.equal(ids.has(style.id), false, `${manifestPath}: duplicate style id ${style.id}`);
      ids.add(style.id);

      const target = path.join(directory, ...style.href.split("/"));
      const stat = await fs.stat(target);
      assert.ok(stat.isFile(), `${manifestPath}: missing style target ${style.href}`);
      assert.ok(style.href.toLowerCase().endsWith(".css"));
      new TextDecoder("utf-8", { fatal: true }).decode(await fs.readFile(target));
    }

    if (manifest.defaultStylesheet) {
      assert.ok(
        ids.has(manifest.defaultStylesheet),
        `${manifestPath}: defaultStylesheet is not declared`
      );
    }
  }
});

test("specification and companion documents agree on core draft version", async () => {
  const spec = await fs.readFile("SPEC.md", "utf8");
  const schema = JSON.parse(await fs.readFile("schema/manifest.schema.json", "utf8"));
  const changelog = await fs.readFile("CHANGELOG.md", "utf8");

  assert.match(spec, /\*\*Version:\*\* 0\.1\.0/);
  assert.equal(schema.title, "MDOCSS 0.1 Manifest");
  assert.match(schema.properties.specVersion.pattern, /0\\\.1/);
  assert.match(changelog, /0\.1\.0-draft/);
});

test("media type text does not claim the candidate MDOCSS subtype is registered", async () => {
  const spec = await fs.readFile("SPEC.md", "utf8");
  assert.match(spec, /application\/vnd\.mdocss\+zip/);
  assert.match(spec, /not registered with IANA/i);
  assert.match(spec, /application\/zip/);
});
