import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const authoredCoreClasses = [
  "mdocss-title-page",
  "mdocss-title",
  "mdocss-subtitle",
  "mdocss-author",
  "mdocss-affiliation",
  "mdocss-course",
  "mdocss-instructor",
  "mdocss-date",
  "mdocss-abstract",
  "mdocss-abstract-title",
  "mdocss-keywords",
  "mdocss-references",
  "mdocss-reference",
  "mdocss-footnotes",
  "mdocss-footnote",
  "mdocss-note",
  "mdocss-figure",
  "mdocss-figure-label",
  "mdocss-caption",
  "mdocss-table",
  "mdocss-table-label",
  "mdocss-source-note",
  "mdocss-appendices",
  "mdocss-appendix",
  "mdocss-appendix-label",
  "mdocss-appendix-title"
];

test("every authored core semantic role is exercised by the style demo", async () => {
  const demo = await fs.readFile("examples/style-demo/root.md", "utf8");

  for (const className of authoredCoreClasses) {
    assert.match(
      demo,
      new RegExp(`class=["'][^"']*\\b${className}\\b`),
      `style demo does not exercise ${className}`
    );
  }
});

test("renderers provide the required mdocss-document shell", async () => {
  const browser = await fs.readFile("viewer/src/app.js", "utf8");
  const obsidian = await fs.readFile("integrations/obsidian/src/main.ts", "utf8");

  assert.match(browser, /mdocss-document/);
  assert.match(obsidian, /mdocss-document/);
});

test("semantic profile remains application-independent", async () => {
  const semantics = await fs.readFile("SEMANTICS.md", "utf8");

  assert.match(semantics, /mdocss-/);
  assert.doesNotMatch(semantics, /\.obsidian-/);
  assert.doesNotMatch(semantics, /\.vscode-/i);
});
