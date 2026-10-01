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


test("versioned schemas agree on exact three-component version syntax", async () => {
  const draft01 = JSON.parse(await fs.readFile("schema/manifest.schema.json", "utf8"));
  const exact10 = JSON.parse(await fs.readFile("schema/manifest-1.0.schema.json", "utf8"));
  const reader1x = JSON.parse(await fs.readFile("schema/manifest-1.x-reader.schema.json", "utf8"));

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const validate01 = ajv.compile(draft01);
  const validate10 = ajv.compile(exact10);
  const validate1x = ajv.compile(reader1x);

  assert.equal(validate01({ specVersion: "0.1.0" }), true);
  assert.equal(validate01({ specVersion: "0.1" }), false);

  assert.equal(validate10({ specVersion: "1.0.0" }), true);
  assert.equal(validate10({ specVersion: "1.0" }), false);
  assert.equal(validate10({ specVersion: "1.1.0" }), false);

  assert.equal(validate1x({ specVersion: "1.0.0" }), true);
  assert.equal(validate1x({ specVersion: "1.9.4" }), true);
  assert.equal(validate1x({ specVersion: "1.9" }), false);
  assert.equal(validate1x({ specVersion: "2.0.0" }), false);
});

test("1.0 schema metadata formats are executable constraints", async () => {
  const schema = JSON.parse(
    await fs.readFile("schema/manifest-1.0.schema.json", "utf8")
  );
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  assert.equal(validate({
    specVersion: "1.0.0",
    created: "2026-10-01T15:00:00Z",
    authors: [{
      name: "Example",
      email: "author@example.com",
      url: "https://example.com/author"
    }]
  }), true);

  assert.equal(validate({
    specVersion: "1.0.0",
    created: "2026-10-01 15:00:00"
  }), false);

  assert.equal(validate({
    specVersion: "1.0.0",
    authors: [{ name: "Example", email: "not-an-email" }]
  }), false);

  assert.equal(validate({
    specVersion: "1.0.0",
    authors: [{ name: "Example", url: "not a uri" }]
  }), false);
});

test("specification names the portable ZIP and version profiles", async () => {
  const spec = await fs.readFile("SPEC.md", "utf8");

  assert.match(spec, /ZIP interoperability profile/);
  assert.match(spec, /MUST NOT require ZIP64/);
  assert.match(spec, /method 0 \(Store\).*method 8 \(Deflate\)/s);
  assert.match(spec, /MAJOR\.MINOR\.PATCH/);
  assert.match(spec, /abbreviated forms such as `1\.0` are not valid/i);
});


test("specification states the stylesheet constraints enforced by schema and package validation", async () => {
  const spec = await fs.readFile("SPEC.md", "utf8");

  assert.match(spec, /stylesheets.*MUST be a non-empty array/is);
  assert.match(spec, /\^\[A-Za-z\]\[A-Za-z0-9\._-\]\*\$/);
  assert.match(spec, /href.*MUST end in `\.css`/is);
  assert.match(spec, /exactly one regular UTF-8 CSS file/is);
});
