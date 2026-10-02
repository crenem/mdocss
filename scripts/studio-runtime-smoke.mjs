import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import JSZip from "jszip";
import { chromium } from "playwright";

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const documentOneFile = path.join(repo, "artifacts", "DocumentOne.html");
const documentOneHtml = await fs.readFile(documentOneFile, "utf8");

assert.doesNotMatch(documentOneHtml, /<script\b[^>]*\bsrc\s*=/i);
assert.doesNotMatch(documentOneHtml, /<link\b[^>]*\brel=["']?stylesheet/i);
assert.match(documentOneHtml, /DocumentOne/);

const temp = await fs.mkdtemp(path.join(os.tmpdir(), "documentone-"));
const sourceFile = path.join(temp, "documentone-test.mdocss");

const zip = new JSZip();
zip.file(
  "root.md",
  "# DocumentOne Test\n\nOriginal text.\n\n![Remote](https://example.invalid/documentone-remote.png)\n"
);
zip.file(
  "root.css",
  [
    "@page { size: letter; margin: 1in; }",
    '.mdocss-document { max-width: 6.5in; margin: 0 auto; padding: 1in; font-family: Georgia, serif; font-size: 12pt; line-height: 1.5; }'
  ].join("\n")
);
zip.file(
  "manifest.json",
  JSON.stringify({
    specVersion: "1.0.0",
    title: "DocumentOne Test",
    entrypoint: "root.md",
    stylesheets: [{ id: "default", label: "Default", href: "root.css" }],
    defaultStylesheet: "default",
    documentOne: { preferredMode: "edit" }
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
page.on("console", message => console.log("BROWSER", message.type(), message.text()));
page.on("pageerror", error => console.log("PAGEERROR", error.stack || error.message));

try {
  await page.goto(pathToFileURL(documentOneFile).href);
  await page.setInputFiles("#file-input", sourceFile);

  await page.waitForFunction(() => {
    const frame = document.querySelector("#document-frame");
    return frame && !frame.hidden && frame.contentDocument?.querySelector(".mdocss-document");
  });

  const frame = page.frameLocator("#document-frame");
  const article = frame.locator(".mdocss-document");
  await article.waitFor();

  assert.equal(await article.getAttribute("contenteditable"), "true");
  assert.match(await page.locator("#markdown-editor").inputValue(), /Original text/);

  const blocked = frame.locator("[data-mdocss-blocked-resource]");
  assert.equal(await blocked.count(), 1);
  assert.equal(
    requests.some(url => url.includes("example.invalid")),
    false,
    "DocumentOne must not fetch remote document resources"
  );

  // WYSIWYG typing updates canonical Markdown underneath.
  const originalParagraph = frame.getByText("Original text.", { exact: true });
  await originalParagraph.evaluate(element => {
    element.textContent += " Edited on paper.";
    element.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: " Edited on paper."
      })
    );
  });

  await page.waitForTimeout(250);
  const markdownAfterPaperEdit = await page.locator("#markdown-editor").inputValue();
  const statusAfterPaperEdit = await page.locator("#status").textContent();
  console.log("MARKDOWN_AFTER_PAPER_EDIT", JSON.stringify(markdownAfterPaperEdit));
  console.log("STATUS_AFTER_PAPER_EDIT", JSON.stringify(statusAfterPaperEdit));
  assert.match(markdownAfterPaperEdit, /Edited on paper\./);

  // Select the inserted words in the paper and format them using the host toolbar.
  await originalParagraph.evaluate(element => {
    const text = element.firstChild;
    const value = text?.nodeValue || "";
    const phrase = "Edited on paper.";
    const start = value.indexOf(phrase);
    const range = document.createRange();
    range.setStart(text, start);
    range.setEnd(text, start + phrase.length);
    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });

  await page.click("#bold-button");
  await frame.locator("strong").filter({ hasText: "Edited on paper." }).waitFor();

  await page.waitForFunction(() =>
    /\*\*Edited on paper\.\*\*/.test(document.querySelector("#markdown-editor")?.value || "")
  );

  // Visual presentation controls write standard CSS and update the live paper.
  const fontSize = page.locator("#font-size");
  await fontSize.fill("14");
  await fontSize.dispatchEvent("input");

  await page.waitForFunction(() =>
    document.querySelector("#css-editor")?.value.includes("font-size: 14pt")
  );

  await page.waitForFunction(() => {
    const frame = document.querySelector("#document-frame");
    const node = frame?.contentDocument?.querySelector(".mdocss-document");
    return node && parseFloat(frame.contentWindow.getComputedStyle(node).fontSize) > 18;
  });

  // Create an additional named style without editing CSS.
  page.once("dialog", dialog => dialog.accept("Academic Copy"));
  await page.click("#duplicate-style-button");
  await page.waitForFunction(() =>
    document.querySelector("#style-select")?.options.length === 2
  );

  // Insert an image into assets/ and into the WYSIWYG document.
  await frame.locator("p").first().click();
  await page.keyboard.press("End");

  const answers = ["Diagram alt text", "Figure 1. Embedded diagram."];
  const imageDialogHandler = dialog => dialog.accept(answers.shift() ?? "");
  page.on("dialog", imageDialogHandler);

  await page.setInputFiles("#image-input", {
    name: "diagram.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="white"/><text x="10" y="35">MDOCSS</text></svg>'
    )
  });
  page.off("dialog", imageDialogHandler);

  await frame.locator("figure.mdocss-figure img").waitFor();
  assert.match(
    await page.locator("#markdown-editor").inputValue(),
    /assets\/diagram\.svg/
  );

  // Reading mode uses the same renderer but disables authoring.
  await page.click("#read-mode-button");
  assert.equal(await article.getAttribute("contenteditable"), "false");
  await page.click("#edit-mode-button");
  assert.equal(await article.getAttribute("contenteditable"), "true");

  // Print stays delegated to the sandboxed paper frame.
  await frame.locator("body").evaluate(() => {
    window.__documentOnePrintCalled = false;
    window.print = () => { window.__documentOnePrintCalled = true; };
  });
  await page.click("#print-button");
  assert.equal(
    await frame.locator("body").evaluate(() => window.__documentOnePrintCalled),
    true
  );

  // Save and verify that the open MDOCSS package remains the actual document.
  const downloadPromise = page.waitForEvent("download");
  await page.click("#save-button");
  const download = await downloadPromise;
  const savedPath = path.join(temp, "saved.mdocss");
  await download.saveAs(savedPath);

  const savedZip = await JSZip.loadAsync(await fs.readFile(savedPath));
  const savedRoot = await savedZip.file("root.md").async("string");
  const savedCss = await savedZip.file("root.css").async("string");
  const preserved = await savedZip.file("extras/keep.txt").async("string");
  const savedManifest = JSON.parse(await savedZip.file("manifest.json").async("string"));

  assert.match(savedRoot, /Edited on paper/);
  assert.match(savedRoot, /\*\*Edited on paper\.\*\*/);
  assert.match(savedRoot, /assets\/diagram\.svg/);
  assert.match(savedCss, /font-size:\s*14pt/);
  assert.ok(savedZip.file("assets/diagram.svg"));
  assert.equal(savedManifest.stylesheets.length, 2);
  assert.equal(preserved, "preserve me");

  console.log("DocumentOne runtime smoke test passed.");
} finally {
  await browser.close();
}
