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


test("every reference profile provides a portable print pagination baseline", async () => {
  const catalog = JSON.parse(await fs.readFile("styles/profiles.json", "utf8"));

  for (const profile of catalog.profiles) {
    const css = await fs.readFile(path.join("styles", profile.file), "utf8");

    assert.match(css, /@page\s*\{/s, `${profile.file}: missing @page`);
    assert.match(css, /counter\(page\)/, `${profile.file}: missing page counter`);
    assert.match(css, /@media\s+print\s*\{/s, `${profile.file}: missing print media block`);
    assert.match(css, /break-after:\s*avoid/, `${profile.file}: headings should avoid orphaning`);
    assert.match(css, /break-inside:\s*avoid/, `${profile.file}: missing fragmentation avoidance`);
    assert.match(css, /orphans:\s*\d+/, `${profile.file}: missing orphan control`);
    assert.match(css, /widows:\s*\d+/, `${profile.file}: missing widow control`);
    assert.match(css, /display:\s*table-header-group/, `${profile.file}: missing repeated table-header rule`);
  }
});

test("academic pagination profiles use Letter pages and visible page counters", async () => {
  for (const file of [
    "apa7-student.css",
    "mla9.css",
    "chicago18-manuscript.css"
  ]) {
    const css = await fs.readFile(path.join("styles", file), "utf8");
    assert.match(css, /@page[\s\S]*?size:\s*letter/);
    assert.match(css, /@top-right[\s\S]*?counter\(page\)/);
  }
});
