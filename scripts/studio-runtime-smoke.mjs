import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import JSZip from "jszip";
import { chromium } from "playwright";

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const studioFile = path.join(repo, "artifacts", "MDOCSS-Studio.html");
const studioHtml = await fs.readFile(studioFile, "utf8");

assert.doesNotMatch(studioHtml, /<script\b[^>]*\bsrc\s*=/i);
assert.doesNotMatch(studioHtml, /<link\b[^>]*\brel=["']?stylesheet/i);

const temp = await fs.mkdtemp(path.join(os.tmpdir(), "mdocss-studio-"));
const sourceFile = path.join(temp, "studio-test.mdocss");

const zip = new JSZip();
zip.file(
  "root.md",
  "# Studio Test\n\nOriginal text.\n\n![Remote](https://example.invalid/studio-remote.png)\n"
);
zip.file(
  "root.css",
  [
    "@page { size: letter; margin: 1in; }",
    '.mdocss-document { font-family: Georgia, serif; font-size: 12pt; line-height: 1.5; }'
  ].join("\n")
);
zip.file(
  "manifest.json",
  JSON.stringify({
    specVersion: "1.0.0",
    title: "Studio Test",
    entrypoint: "root.md",
    stylesheets: [{ id: "default", label: "Default", href: "root.css" }],
    defaultStylesheet: "default"
  }, null, 2)
);
zip.file("extras/keep.txt", "preserve me");

await fs.writeFile(
  sourceFile,
  await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
);

const browserChannel = process.env.MDOCSS_PLAYWRIGHT_CHANNEL || undefined;
const browser = await chromium.launch({
  headless: true,
  ...(browserChannel ? { channel: browserChannel } : {})
});

const page = await browser.newPage({ acceptDownloads: true });
const requests = [];
page.on("request", request => requests.push(request.url()));

try {
  await page.goto(pathToFileURL(studioFile).href);
  await page.setInputFiles("#file-input", sourceFile);

  await page.waitForFunction(() => {
    const frame = document.querySelector("#document-frame");
    return frame && !frame.hidden && frame.contentDocument?.querySelector(".mdocss-document");
  });

  assert.match(await page.locator("#markdown-editor").inputValue(), /Original text/);

  const frame = page.frameLocator("#document-frame");
  await frame.locator(".mdocss-document").waitFor();

  const blocked = frame.locator("[data-mdocss-blocked-resource]");
  assert.equal(await blocked.count(), 1);
  assert.equal(
    requests.some(url => url.includes("example.invalid")),
    false,
    "Studio must not fetch remote document resources"
  );

  const markdown = page.locator("#markdown-editor");
  await markdown.fill("# Studio Test\n\nOriginal text.\n\nStudio edit sentinel.\n");
  await markdown.dispatchEvent("input");
  await frame.getByText("Studio edit sentinel.").waitFor();

  const fontSize = page.locator("#font-size");
  await fontSize.fill("14");
  await fontSize.dispatchEvent("input");

  await page.waitForFunction(() =>
    document.querySelector("#css-editor")?.value.includes("font-size: 14pt")
  );

  const renderedFont = await frame.locator(".mdocss-document").evaluate(node =>
    getComputedStyle(node).fontSize
  );
  assert.match(renderedFont, /^18\.6/);

  await frame.locator("body").evaluate(() => {
    window.__studioPrintCalled = false;
    window.print = () => { window.__studioPrintCalled = true; };
  });
  await page.click("#print-button");
  assert.equal(
    await frame.locator("body").evaluate(() => window.__studioPrintCalled),
    true
  );

  const downloadPromise = page.waitForEvent("download");
  await page.click("#save-button");
  const download = await downloadPromise;
  const savedPath = path.join(temp, "saved.mdocss");
  await download.saveAs(savedPath);

  const savedZip = await JSZip.loadAsync(await fs.readFile(savedPath));
  const savedRoot = await savedZip.file("root.md").async("string");
  const savedCss = await savedZip.file("root.css").async("string");
  const preserved = await savedZip.file("extras/keep.txt").async("string");

  assert.match(savedRoot, /Studio edit sentinel/);
  assert.match(savedCss, /font-size:\s*14pt/);
  assert.equal(preserved, "preserve me");

  console.log("MDOCSS Studio runtime smoke test passed.");
} finally {
  await browser.close();
}
