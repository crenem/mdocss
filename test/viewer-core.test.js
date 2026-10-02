import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import JSZip from "jszip";
import {
  chooseInitialStyle,
  dangerousArchiveMember,
  escapeHtmlAttribute,
  duplicateZipMemberNames,
  inferMimeType,
  isZipSymlink,
  manifestCompatibility,
  normalizeArchiveReference,
  referenceKind,
  styleChoices,
  zipInteroperabilityIssues
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


test("manifest compatibility enters recovery mode for unsupported versions", () => {
  assert.equal(manifestCompatibility(null).supported, true);
  assert.equal(manifestCompatibility({}).supported, true);
  assert.equal(manifestCompatibility({ specVersion: "0.1.7" }).supported, true);
  assert.equal(manifestCompatibility({ specVersion: "1.0.0" }).supported, true);
  assert.equal(manifestCompatibility({ specVersion: "1.0" }).supported, false);
  assert.equal(manifestCompatibility({ specVersion: "1.4.0" }).supported, true);
  assert.equal(manifestCompatibility({ specVersion: "1.4" }).supported, false);
  assert.equal(manifestCompatibility({ specVersion: "1.4.0" }).mode, "forward-compatible");
  assert.equal(manifestCompatibility({ specVersion: "2.0.0" }).supported, false);
  assert.equal(manifestCompatibility({ specVersion: "9.0.0" }).supported, false);
  assert.equal(manifestCompatibility({ specVersion: "not-a-version" }).supported, false);
});

test("browser preflight detects dangerous paths and duplicate ZIP members", async () => {
  assert.equal(dangerousArchiveMember("../escape.txt"), true);
  assert.equal(dangerousArchiveMember("C:/escape.txt"), true);
  assert.equal(dangerousArchiveMember("assets/./image.png"), true);
  assert.equal(dangerousArchiveMember("assets//image.png"), true);
  assert.equal(dangerousArchiveMember("assets/bad\nname.png"), true);
  assert.equal(dangerousArchiveMember("assets/image.png"), false);

  const duplicate = await fs.readFile("conformance/fixtures/invalid-duplicate-member.mdocss");
  assert.deepEqual(duplicateZipMemberNames(duplicate), ["root.md"]);
});

test("browser preflight identifies ZIP symbolic links", async () => {
  const bytes = await fs.readFile("conformance/fixtures/invalid-symlink.mdocss");
  const zip = await JSZip.loadAsync(bytes);
  assert.equal(isZipSymlink(zip.files["assets/link"]), true);
});


test("rich-reader ZIP preflight rejects BZIP2 and ZIP64 corpus cases", async () => {
  const cases = JSON.parse(await fs.readFile("conformance/cases.json", "utf8"));

  for (const id of ["I021", "I022"]) {
    const entry = cases.find(item => item.id === id);
    assert.ok(entry?.generated?.rawBase64, `missing raw fixture for ${id}`);

    const bytes = Buffer.from(entry.generated.rawBase64, "base64");
    const issues = zipInteroperabilityIssues(bytes);

    assert.ok(
      issues.length > 0,
      `${id} should fail the rich-reader ZIP interoperability preflight`
    );
  }

  const bzip2 = cases.find(item => item.id === "I021");
  assert.match(
    zipInteroperabilityIssues(Buffer.from(bzip2.generated.rawBase64, "base64")).join("\n"),
    /Unsupported ZIP compression method/
  );

  const zip64 = cases.find(item => item.id === "I022");
  assert.match(
    zipInteroperabilityIssues(Buffer.from(zip64.generated.rawBase64, "base64")).join("\n"),
    /ZIP64 features/
  );
});


test("rich-reader ZIP preflight requires UTF-8 flag for non-ASCII member names", async () => {
  const cases = JSON.parse(await fs.readFile("conformance/cases.json", "utf8"));
  const valid = cases.find(item => item.id === "V009");
  const invalid = cases.find(item => item.id === "I028");

  assert.deepEqual(
    zipInteroperabilityIssues(Buffer.from(valid.generated.rawBase64, "base64")),
    []
  );

  assert.match(
    zipInteroperabilityIssues(
      Buffer.from(invalid.generated.rawBase64, "base64")
    ).join("\n"),
    /Non-ASCII ZIP member name must set the UTF-8 language flag/
  );
});


test("manifest metadata is escaped before insertion into generated HTML attributes", () => {
  assert.equal(
    escapeHtmlAttribute('en" autofocus onfocus="alert(1)'),
    "en&quot; autofocus onfocus=&quot;alert(1)"
  );
  assert.equal(
    escapeHtmlAttribute("<script>&'"),
    "&lt;script&gt;&amp;&#39;"
  );
});
