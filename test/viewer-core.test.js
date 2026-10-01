import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseInitialStyle,
  inferMimeType,
  normalizeArchiveReference,
  referenceKind,
  styleChoices
} from "../viewer/src/viewer-core.js";

test("archive references resolve relative to the containing file", () => {
  assert.equal(
    normalizeArchiveReference("styles/print.css", "../assets/logo.svg"),
    "assets/logo.svg"
  );
  assert.equal(
    normalizeArchiveReference("root.md", "assets/chart.png"),
    "assets/chart.png"
  );
});

test("unsafe or external references are not treated as archive members", () => {
  assert.equal(normalizeArchiveReference("root.md", "../../escape.txt"), null);
  assert.equal(normalizeArchiveReference("root.md", "/etc/passwd"), null);
  assert.equal(normalizeArchiveReference("root.md", "C:/escape.txt"), null);
  assert.equal(normalizeArchiveReference("root.md", "..\\escape.txt"), null);
  assert.equal(normalizeArchiveReference("root.md", "https://example.com/x"), null);

  assert.equal(referenceKind("https://example.com/x"), "external");
  assert.equal(referenceKind("data:image/png;base64,AA=="), "data");
  assert.equal(referenceKind("assets/x.png"), "archive");
});

test("style selection follows the MDOCSS preference order", () => {
  const manifest = {
    defaultStylesheet: "print",
    stylesheets: [
      { id: "screen", label: "Screen", href: "root.css" },
      { id: "print", label: "Print", href: "styles/print.css" }
    ]
  };

  const choices = styleChoices(manifest, true);
  assert.equal(chooseInitialStyle(manifest, choices), "print");
  assert.equal(chooseInitialStyle(manifest, choices, "screen"), "screen");
});

test("root.css becomes a fallback choice when no styles are declared", () => {
  assert.deepEqual(styleChoices(null, true), [{
    id: "fallback",
    label: "Document style",
    href: "root.css"
  }]);
});

test("common bundled resource types receive useful MIME types", () => {
  assert.equal(inferMimeType("assets/image.svg"), "image/svg+xml");
  assert.equal(inferMimeType("fonts/body.woff2"), "font/woff2");
  assert.equal(inferMimeType("assets/unknown.bin"), "application/octet-stream");
});
