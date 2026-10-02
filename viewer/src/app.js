import JSZip from "jszip";
import { marked } from "marked";
import DOMPurify from "dompurify";
import {
  chooseInitialStyle,
  escapeHtmlAttribute,
  dangerousArchiveMember,
  duplicateZipMemberNames,
  inferMimeType,
  isZipSymlink,
  manifestCompatibility,
  normalizeArchiveReference,
  referenceKind,
  styleChoices,
  zipInteroperabilityIssues
} from "./viewer-core.js";

const fileInput = document.querySelector("#file-input");
const styleSelect = document.querySelector("#style-select");
const printButton = document.querySelector("#print-button");
const dropZone = document.querySelector("#drop-zone");
const emptyState = document.querySelector("#empty-state");
const frame = document.querySelector("#document-frame");
const status = document.querySelector("#status");
const documentInfo = document.querySelector("#document-info");

let current = null;

function setStatus(message) {
  status.textContent = message;
}

function setInfo(message = "") {
  documentInfo.textContent = message;
}

function revokeAssets() {
  if (!current?.blobUrls) return;
  for (const url of current.blobUrls.values()) URL.revokeObjectURL(url);
}

async function decodeUtf8(zipEntry, label) {
  try {
    const bytes = await zipEntry.async("uint8array");
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} is not valid UTF-8.`);
  }
}

function zipEntry(zip, path) {
  const entry = zip.file(path);
  return entry && !entry.dir ? entry : null;
}

async function blobUrlFor(path) {
  if (!current) throw new Error("No MDOCSS document is loaded.");
  if (current.blobUrls.has(path)) return current.blobUrls.get(path);

  const entry = zipEntry(current.zip, path);
  if (!entry) return null;

  const bytes = await entry.async("uint8array");
  const url = URL.createObjectURL(new Blob([bytes], { type: inferMimeType(path) }));
  current.blobUrls.set(path, url);
  return url;
}

async function rewriteRenderedResources(html) {
  const parsed = new DOMParser().parseFromString(html, "text/html");

  const resourceAttributes = [
    ["img", "src"],
    ["source", "src"],
    ["video", "src"],
    ["video", "poster"],
    ["audio", "src"]
  ];

  for (const [selector, attr] of resourceAttributes) {
    for (const element of parsed.querySelectorAll(`${selector}[${attr}]`)) {
      const value = element.getAttribute(attr);
      const kind = referenceKind(value);

      if (kind === "data" || kind === "blob" || kind === "fragment") continue;

      if (kind === "external") {
        element.removeAttribute(attr);
        element.setAttribute("data-mdocss-blocked-resource", value);
        continue;
      }

      const resolved = normalizeArchiveReference("root.md", value);
      const url = resolved ? await blobUrlFor(resolved) : null;

      if (url) {
        element.setAttribute(attr, url);
      } else {
        element.removeAttribute(attr);
        element.setAttribute("data-mdocss-missing-resource", value);
      }
    }
  }

  for (const link of parsed.querySelectorAll("a[href]")) {
    const href = link.getAttribute("href");
    const kind = referenceKind(href);

    if (kind === "external") {
      link.setAttribute("rel", "noopener noreferrer");
      link.setAttribute("data-mdocss-external-link", "true");
      continue;
    }

    if (kind === "archive") {
      const resolved = normalizeArchiveReference("root.md", href);
      const url = resolved ? await blobUrlFor(resolved) : null;
      if (url) link.setAttribute("href", url);
    }
  }

  return parsed.body.innerHTML;
}

async function loadCss(path, seen = new Set()) {
  if (!current) return "";

  const resolvedPath = normalizeArchiveReference("", path);
  if (!resolvedPath || seen.has(resolvedPath)) return "";
  seen.add(resolvedPath);

  const entry = zipEntry(current.zip, resolvedPath);
  if (!entry) throw new Error(`Stylesheet not found: ${resolvedPath}`);

  let css = await decodeUtf8(entry, resolvedPath);

  const importRe = /@import\s+(?:url\(\s*)?(?:"([^"]+)"|'([^']+)'|([^\s;)]+))\s*\)?\s*([^;]*);/gi;
  const imports = [];
  let match;
  while ((match = importRe.exec(css)) !== null) {
    imports.push({
      whole: match[0],
      href: match[1] || match[2] || match[3],
      media: (match[4] || "").trim()
    });
  }

  for (const item of imports) {
    const kind = referenceKind(item.href);
    let replacement = "";

    if (kind === "archive") {
      const importedPath = normalizeArchiveReference(resolvedPath, item.href);
      if (importedPath) {
        const imported = await loadCss(importedPath, seen);
        replacement = item.media ? `@media ${item.media} {\n${imported}\n}` : imported;
      }
    }

    css = css.replace(item.whole, replacement);
  }

  const urlRe = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi;
  const references = [];
  while ((match = urlRe.exec(css)) !== null) {
    references.push({
      whole: match[0],
      href: (match[1] || match[2] || match[3] || "").trim()
    });
  }

  for (const item of references) {
    const kind = referenceKind(item.href);
    if (kind === "data" || kind === "blob" || kind === "fragment") continue;

    let replacement = "url(\"\")";
    if (kind === "archive") {
      const assetPath = normalizeArchiveReference(resolvedPath, item.href);
      const url = assetPath ? await blobUrlFor(assetPath) : null;
      if (url) replacement = `url("${url}")`;
    }

    css = css.replace(item.whole, replacement);
  }

  return css;
}

function baseDocumentCss() {
  return `
    :root { color-scheme: light; }
    html { background: white; color: #111; }
    body {
      margin: 0;
      min-height: 100vh;
      background: white;
      color: #111;
    }
    .mdocss-document {
      display: block;
      min-height: 100vh;
      box-sizing: border-box;
      overflow-wrap: anywhere;
    }
    img, svg, video { max-width: 100%; }
    pre { overflow-x: auto; }
    [data-mdocss-missing-resource],
    [data-mdocss-blocked-resource] {
      outline: 1px dashed #b00;
    }
    @media print {
      html, body, .mdocss-document { background: white !important; }
    }
  `;
}

function makeFrameDocument(contentHtml, documentCss = "") {
  const csp = [
    "default-src 'none'",
    "img-src blob: data:",
    "media-src blob: data:",
    "font-src blob: data:",
    "style-src 'unsafe-inline' blob:"
  ].join("; ");

  return `<!doctype html>
<html lang="${escapeHtmlAttribute(current?.manifest?.language || "en")}">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style id="mdocss-base-style">${baseDocumentCss()}</style>
  <style id="mdocss-style">${documentCss}</style>
</head>
<body>
  <article class="mdocss-document">${contentHtml}</article>
</body>
</html>`;
}

async function applyStyle(styleId) {
  if (!current) return;

  const style = current.styles.find(item => item.id === styleId);
  let css = "";

  if (style) {
    setStatus(`Applying ${style.label}…`);
    css = await loadCss(style.href);
  }

  const styleNode = frame.contentDocument?.querySelector("#mdocss-style");
  if (styleNode) styleNode.textContent = css;

  current.activeStyle = style?.id || null;
  setStatus(style ? `Style: ${style.label}` : "Document rendered without a bundled stylesheet.");
}

function populateStylePicker() {
  styleSelect.innerHTML = "";

  if (!current?.styles.length) {
    const option = new Option("No bundled styles", "");
    styleSelect.add(option);
    styleSelect.disabled = true;
    return;
  }

  for (const style of current.styles) {
    styleSelect.add(new Option(style.label, style.id));
  }

  styleSelect.disabled = false;
  const selected = chooseInitialStyle(current.manifest, current.styles);
  if (selected) styleSelect.value = selected;
}

async function loadFile(file) {
  revokeAssets();
  current = null;
  styleSelect.disabled = true;
  printButton.disabled = true;
  setInfo("");
  setStatus(`Opening ${file.name}…`);

  try {
    const archiveBuffer = await file.arrayBuffer();
    const duplicates = duplicateZipMemberNames(archiveBuffer);
    if (duplicates.length) {
      throw new Error(`Duplicate archive member names are not allowed: ${duplicates.join(", ")}`);
    }

    const zipIssues = zipInteroperabilityIssues(archiveBuffer);
    if (zipIssues.length) {
      throw new Error(zipIssues.join("; "));
    }

    const zip = await JSZip.loadAsync(archiveBuffer);

    for (const [name, entry] of Object.entries(zip.files)) {
      const original = entry.unsafeOriginalName || name;
      if (dangerousArchiveMember(original)) {
        throw new Error(`Unsafe archive member path: ${original}`);
      }
      if (isZipSymlink(entry)) {
        throw new Error(`Symbolic-link archive member is not allowed: ${original}`);
      }
    }

    const root = zipEntry(zip, "root.md");
    if (!root) throw new Error("This archive does not contain the required root.md.");

    const markdown = await decodeUtf8(root, "root.md");

    let manifest = null;
    const manifestEntry = zipEntry(zip, "manifest.json");
    if (manifestEntry) {
      const text = await decodeUtf8(manifestEntry, "manifest.json");
      manifest = JSON.parse(text);
      if (!manifest || Array.isArray(manifest) || typeof manifest !== "object") {
        throw new Error("manifest.json must contain a JSON object.");
      }
    }

    const compatibility = manifestCompatibility(manifest);
    const featureManifest = compatibility.supported ? manifest : null;

    current = {
      file,
      zip,
      manifest: featureManifest,
      rawManifest: manifest,
      compatibility,
      blobUrls: new Map(),
      styles: compatibility.supported
        ? styleChoices(featureManifest, Boolean(zipEntry(zip, "root.css")))
        : [],
      activeStyle: null
    };

    marked.use({
      gfm: true,
      breaks: false
    });

    const rawHtml = await marked.parse(markdown);
    const sanitized = DOMPurify.sanitize(rawHtml, {
      USE_PROFILES: { html: true },
      ALLOW_DATA_ATTR: true
    });
    const rewritten = await rewriteRenderedResources(sanitized);

    populateStylePicker();

    const initialStyleId = chooseInitialStyle(featureManifest, current.styles);
    const initialStyle = current.styles.find(item => item.id === initialStyleId);
    const css = initialStyle ? await loadCss(initialStyle.href) : "";

    frame.srcdoc = makeFrameDocument(rewritten, css);

    await new Promise(resolve => {
      if (frame.contentDocument?.readyState === "complete") resolve();
      else frame.addEventListener("load", resolve, { once: true });
    });

    current.activeStyle = initialStyle?.id || null;
    if (initialStyle) styleSelect.value = initialStyle.id;

    emptyState.hidden = true;
    frame.hidden = false;
    printButton.disabled = false;

    const title = featureManifest?.title || file.name;
    const styleCount = current.styles.length;

    if (!compatibility.supported) {
      setInfo(`${file.name} · recovery mode`);
      setStatus(
        `Unsupported MDOCSS version ${compatibility.version || "unknown"}; showing canonical content without interpreting optional package semantics.`
      );
    } else {
      setInfo(`${title} · ${styleCount} style${styleCount === 1 ? "" : "s"}`);
      setStatus(initialStyle ? `Rendered with ${initialStyle.label}.` : "Rendered without a bundled stylesheet.");
    }
  } catch (error) {
    revokeAssets();
    current = null;
    frame.hidden = true;
    emptyState.hidden = false;
    styleSelect.disabled = true;
    printButton.disabled = true;
    setStatus(`Could not open document: ${error.message}`);
    console.error(error);
  }
}

fileInput.addEventListener("change", () => {
  const [file] = fileInput.files || [];
  if (file) loadFile(file);
});

styleSelect.addEventListener("change", () => {
  applyStyle(styleSelect.value).catch(error => {
    setStatus(`Could not apply style: ${error.message}`);
    console.error(error);
  });
});

printButton.addEventListener("click", () => {
  if (!current || !frame.contentWindow) return;
  frame.contentWindow.focus();
  frame.contentWindow.print();
});

for (const eventName of ["dragenter", "dragover"]) {
  dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  });
}

dropZone.addEventListener("drop", event => {
  const [file] = event.dataTransfer?.files || [];
  if (file) loadFile(file);
});

window.addEventListener("beforeunload", revokeAssets);
