import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import JSZip from "jszip";

async function validator(schemaPath = "schema/manifest-1.0.schema.json") {
  const schema = JSON.parse(await fs.readFile(schemaPath, "utf8"));
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


async function packageWithManifest(manifest = undefined) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "mdocss-versioning-"));
  const file = path.join(tmp, "document.mdocss");
  const zip = new JSZip();
  zip.file("root.md", "# Version negotiation\n");

  if (manifest !== undefined) {
    zip.file("manifest.json", JSON.stringify(manifest, null, 2) + "\n");
  }

  await fs.writeFile(
    file,
    await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
  );

  return file;
}

function cli(args) {
  return spawnSync(process.execPath, ["src/cli.js", ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
}

test("1.x reader baseline accepts same-major newer-minor declarations", async () => {
  const validate = await validator("schema/manifest-1.x-reader.schema.json");

  assert.equal(validate({
    specVersion: "1.7.0",
    title: "Forward-compatible 1.x document"
  }), true);
  assert.equal(validate({ specVersion: "1.7" }), false);
});

test("exact 1.0 authoring schema rejects later 1.x minor declarations", async () => {
  const validate = await validator();

  assert.equal(validate({ specVersion: "1.0.4" }), true);
  assert.equal(validate({ specVersion: "1.0" }), false);
  assert.equal(validate({ specVersion: "1.1.0" }), false);
});

test("CLI auto-negotiates legacy, 1.x, and unsupported major versions", async () => {
  const legacy = await packageWithManifest({ title: "Legacy unversioned manifest" });
  assert.equal(cli(["validate", legacy]).status, 0);

  const v1 = await packageWithManifest({ specVersion: "1.0.0", title: "Version 1" });
  assert.equal(cli(["validate", v1]).status, 0);

  const newerMinor = await packageWithManifest({
    specVersion: "1.4.0",
    title: "Forward-compatible version 1 minor"
  });
  assert.equal(cli(["validate", newerMinor]).status, 0);

  const futureMajor = await packageWithManifest({
    specVersion: "9.0.0",
    title: "Future major"
  });
  const future = cli(["validate", futureMajor]);
  assert.equal(future.status, 2);
  assert.match(future.stderr, /Unsupported MDOCSS major version 9\.0\.0/);
});

test("CLI target validation enforces the 1.0 authoring contract", async () => {
  const minimal = await packageWithManifest();
  assert.equal(cli(["validate", minimal, "--target", "1.0"]).status, 0);

  const v1 = await packageWithManifest({ specVersion: "1.0.3" });
  assert.equal(cli(["validate", v1, "--target", "1.0"]).status, 0);

  const unversionedManifest = await packageWithManifest({ title: "Missing version" });
  const missing = cli(["validate", unversionedManifest, "--target", "1.0"]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /must have required property 'specVersion'/);

  const newerMinor = await packageWithManifest({ specVersion: "1.1.0" });
  const mismatch = cli(["validate", newerMinor, "--target", "1.0"]);
  assert.equal(mismatch.status, 1);
  assert.match(mismatch.stderr, /does not match validation target 1\.0/);

  const legacy = await packageWithManifest({ specVersion: "0.1.0" });
  assert.equal(cli(["validate", legacy, "--target", "1.0"]).status, 1);
});


test("CLI rejects abbreviated manifest versions", async () => {
  const abbreviated10 = await packageWithManifest({ specVersion: "1.0" });
  const first = cli(["validate", abbreviated10]);
  assert.equal(first.status, 1);
  assert.match(first.stderr, /Invalid specVersion: 1\.0/);

  const abbreviated17 = await packageWithManifest({ specVersion: "1.7" });
  const second = cli(["validate", abbreviated17]);
  assert.equal(second.status, 1);
  assert.match(second.stderr, /Invalid specVersion: 1\.7/);
});
