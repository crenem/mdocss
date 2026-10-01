import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("large-print reference style includes forced-colors and reduced-motion support", async () => {
  const css = await fs.readFile("styles/accessible-large-print.css", "utf8");
  assert.match(css, /@media\s*\(forced-colors:\s*active\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /:focus-visible/);
});

test("reference style library has print fallbacks", async () => {
  const catalog = JSON.parse(await fs.readFile("styles/profiles.json", "utf8"));
  for (const profile of catalog.profiles) {
    const css = await fs.readFile(`styles/${profile.file}`, "utf8");
    assert.match(css, /@media\s+print/, `${profile.file} lacks a print fallback`);
  }
});

test("reference styles do not require remote CSS resources", async () => {
  const catalog = JSON.parse(await fs.readFile("styles/profiles.json", "utf8"));
  for (const profile of catalog.profiles) {
    const css = await fs.readFile(`styles/${profile.file}`, "utf8");
    assert.doesNotMatch(css, /(?:url\(|@import\s+)[^\n;]*(?:https?:)?\/\//i);
  }
});
