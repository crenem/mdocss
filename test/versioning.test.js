import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

async function validator() {
  const schema = JSON.parse(
    await fs.readFile("schema/manifest-1.0-draft.schema.json", "utf8")
  );
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

test("candidate 1.0 manifest requires specVersion", async () => {
  const validate = await validator();

  assert.equal(validate({
    title: "Unversioned manifest"
  }), false);

  assert.equal(validate({
    specVersion: "1.0.0",
    title: "Versioned manifest"
  }), true);
});

test("candidate 1.0 manifest keeps the fixed root entrypoint rule", async () => {
  const validate = await validator();

  assert.equal(validate({
    specVersion: "1.0.0",
    entrypoint: "root.md"
  }), true);

  assert.equal(validate({
    specVersion: "1.0.0",
    entrypoint: "other.md"
  }), false);
});

test("candidate 1.0 manifest accepts named stylesheet metadata", async () => {
  const validate = await validator();

  assert.equal(validate({
    specVersion: "1.0.0",
    stylesheets: [
      {
        id: "apa7",
        label: "APA 7 Student Paper",
        href: "styles/apa7.css",
        profile: "org.mdocss.apa7.student"
      }
    ],
    defaultStylesheet: "apa7"
  }), true);
});
