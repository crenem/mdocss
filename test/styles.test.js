import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

test("reference style catalog has unique profiles and existing UTF-8 CSS files", async () => {
  const catalog = JSON.parse(await fs.readFile("styles/profiles.json", "utf8"));
  assert.ok(Array.isArray(catalog.profiles));
  assert.ok(catalog.profiles.length >= 7);

  const ids = new Set();
  const files = new Set();

  for (const profile of catalog.profiles) {
    assert.equal(typeof profile.id, "string");
    assert.equal(typeof profile.label, "string");
    assert.equal(typeof profile.file, "string");

    assert.equal(ids.has(profile.id), false, `duplicate profile id: ${profile.id}`);
    assert.equal(files.has(profile.file), false, `duplicate profile file: ${profile.file}`);
    ids.add(profile.id);
    files.add(profile.file);

    const cssPath = path.join("styles", profile.file);
    const css = new TextDecoder("utf-8", { fatal: true }).decode(
      await fs.readFile(cssPath)
    );
    assert.match(css, /\.mdocss-document/);
  }
});

test("academic reference profiles are present", async () => {
  const catalog = JSON.parse(await fs.readFile("styles/profiles.json", "utf8"));
  const ids = new Set(catalog.profiles.map(profile => profile.id));

  assert.ok(ids.has("org.mdocss.apa7.student"));
  assert.ok(ids.has("org.mdocss.mla9"));
  assert.ok(ids.has("org.mdocss.chicago18.manuscript"));
});
