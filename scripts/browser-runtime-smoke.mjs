import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import JSZip from "jszip";
import { chromium } from "playwright";

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const viewerUrl = pathToFileURL(path.join(repo, "viewer", "index.html")).href;

async function writeRawCase(caseId) {
  const cases = JSON.parse(
    await fs.readFile(path.join(repo, "conformance", "cases.json"), "utf8")
  );
  const testCase = cases.find(item => item.id === caseId);
  const rawBase64 = testCase?.generated?.rawBase64;
  if (!rawBase64) throw new Error(`Conformance case ${caseId} has no rawBase64 fixture`);

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mdocss-browser-raw-"));
  const file = path.join(dir, `${caseId}.mdocss`);
  await fs.writeFile(file, Buffer.from(rawBase64, "base64"));
  return file;
}

async function writePackage(name, build) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mdocss-browser-"));
  const file = path.join(dir, name);
  const zip = new JSZip();
  await build(zip);
  await fs.writeFile(
    file,
    await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
  );
  return file;
}

async function waitRendered(page) {
  await page.waitForFunction(() => {
    const text = document.querySelector("#status")?.textContent || "";
    return (
      text.startsWith("Rendered with ") ||
      text === "Rendered without a bundled stylesheet." ||
      text.includes("recovery mode")
    );
  });
}

async function loadFile(page, file) {
  await page.setInputFiles("#file-input", file);
}

const styleDemo = path.join(repo, "artifacts", "mdocss-style-demo.mdocss");
const styleDemoBytes = await fs.readFile(styleDemo);
const beforeHash = crypto.createHash("sha256").update(styleDemoBytes).digest("hex");

const localAsset = await writePackage("local-asset.mdocss", async zip => {
  zip.file("root.md", "# Asset test\n\n![Local mark](assets/mark.svg)\n");
  zip.file(
    "root.css",
    ".mdocss-document { background-image: url(\"assets/mark.svg\"); }\n"
  );
  zip.file(
    "assets/mark.svg",
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="#ddd"/></svg>'
  );
});

const maliciousMetadata = await writePackage("malicious-metadata.mdocss", async zip => {
  zip.file("root.md", "# Metadata escaping test\n");
  zip.file(
    "manifest.json",
    JSON.stringify({
      specVersion: "0.1.0",
      language: 'en" autofocus onfocus="alert(1)'
    })
  );
});

const remoteResource = await writePackage("remote-resource.mdocss", async zip => {
  zip.file(
    "root.md",
    "# Remote resource test\n\n![Remote](https://example.invalid/mdocss-no-fetch.png)\n"
  );
  zip.file(
    "root.css",
    ".mdocss-document { background-image: url(\"https://example.invalid/mdocss-no-fetch.css.png\"); }\n"
  );
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const network = [];
page.on("request", request => network.push(request.url()));

try {
  await page.goto(viewerUrl);

  // Real style-demo load.
  await loadFile(page, styleDemo);
  await waitRendered(page);

  const optionCount = await page.locator("#style-select option").count();
  assert.equal(optionCount, 7, "style demo should expose seven bundled profiles");

  const frame = page.frameLocator("#document-frame");
  await frame.locator(".mdocss-document").waitFor();
  const canonicalText = await frame.locator(".mdocss-document").innerText();
  assert.match(canonicalText, /One Document, Many Presentations/);

  // Hot-swap styles and prove semantic content is unchanged.
  const originalText = canonicalText;
  await page.selectOption("#style-select", "org.mdocss.reading.dark");
  await page.waitForFunction(() =>
    document.querySelector("#status")?.textContent === "Style: Dark Reading"
  );
  assert.equal(
    await frame.locator(".mdocss-document").innerText(),
    originalText,
    "style switching must not change rendered semantic text"
  );

  await page.selectOption("#style-select", "org.mdocss.apa7.student");
  await page.waitForFunction(() =>
    document.querySelector("#status")?.textContent === "Style: APA 7 Student Paper"
  );
  assert.equal(await frame.locator(".mdocss-document").innerText(), originalText);

  // Print button calls the document frame's print function.
  await frame.locator("body").evaluate(() => {
    window.__mdocssPrintCalled = false;
    window.print = () => { window.__mdocssPrintCalled = true; };
  });
  await page.click("#print-button");
  assert.equal(
    await frame.locator("body").evaluate(() => window.__mdocssPrintCalled),
    true,
    "print control should delegate to the rendered document frame"
  );

  // Local Markdown and CSS assets become blob URLs.
  await loadFile(page, localAsset);
  await waitRendered(page);
  const localFrame = page.frameLocator("#document-frame");
  const imageSrc = await localFrame.locator("img").getAttribute("src");
  assert.match(imageSrc || "", /^blob:/, "local Markdown image should resolve to a blob URL");
  const cssText = await localFrame.locator("#mdocss-style").textContent();
  assert.match(cssText || "", /url\("blob:/, "local CSS asset should resolve to a blob URL");

  // Remote image/CSS resources must not trigger network fetches.
  const networkStart = network.length;
  await loadFile(page, remoteResource);
  await waitRendered(page);
  const remoteFrame = page.frameLocator("#document-frame");
  const remoteImg = remoteFrame.locator("img");
  assert.equal(await remoteImg.getAttribute("src"), null);
  assert.equal(
    await remoteImg.getAttribute("data-mdocss-blocked-resource"),
    "https://example.invalid/mdocss-no-fetch.png"
  );
  const remoteCss = await remoteFrame.locator("#mdocss-style").textContent();
  assert.doesNotMatch(remoteCss || "", /example\.invalid/);
  assert.equal(
    network.slice(networkStart).some(url => url.includes("example.invalid")),
    false,
    "document resources must not be fetched from remote origins"
  );

  // Manifest metadata must not reshape generated frame markup.
  await loadFile(page, maliciousMetadata);
  await waitRendered(page);
  const metadataFrame = page.frameLocator("#document-frame");
  assert.equal(
    await metadataFrame.locator("html").getAttribute("lang"),
    'en" autofocus onfocus="alert(1)'
  );
  assert.equal(
    await metadataFrame.locator("html").getAttribute("autofocus"),
    null,
    "manifest language must not create additional HTML attributes"
  );
  assert.equal(
    await metadataFrame.locator("html").getAttribute("onfocus"),
    null,
    "manifest language must not create event-handler attributes"
  );

  // Hostile package rejects safely.
  await loadFile(
    page,
    path.join(repo, "conformance", "fixtures", "invalid-path-traversal.mdocss")
  );
  await page.waitForFunction(() =>
    document.querySelector("#status")?.textContent?.startsWith("Could not open document:")
  );
  assert.equal(await page.locator("#document-frame").isHidden(), true);

  // ZIP-profile violation rejects safely.
  const bzipFixture = await writeRawCase("I021");
  await loadFile(page, bzipFixture);
  await page.waitForFunction(() =>
    document.querySelector("#status")?.textContent?.startsWith("Could not open document:")
  );

  // Style selection never writes back to the source package.
  const afterHash = crypto
    .createHash("sha256")
    .update(await fs.readFile(styleDemo))
    .digest("hex");
  assert.equal(afterHash, beforeHash, "browser style selection must not rewrite the package");

  console.log("Browser runtime smoke test passed.");
} finally {
  await browser.close();
}
