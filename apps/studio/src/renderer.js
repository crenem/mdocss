import { marked } from "marked";
import DOMPurify from "dompurify";
import {
  escapeHtmlAttribute,
  inferMimeType,
  normalizeArchiveReference,
  referenceKind
} from "../../../viewer/src/viewer-core.js";
import { decodeUtf8, zipEntry, writeEditors, activeCssPath } from "./package-model.js";

marked.use({ gfm: true, breaks: false });

export class StudioRenderer {
  constructor(frame) {
    this.frame = frame;
    this.documentModel = null;
    this.blobUrls = new Map();
    this.editable = true;
  }

  setDocument(documentModel) {
    this.revokeAssets();
    this.documentModel = documentModel;
  }

  setEditable(editable) {
    this.editable = Boolean(editable);
    const article = this.frame.contentDocument?.querySelector(".mdocss-document");
    if (article) {
      article.setAttribute("contenteditable", this.editable ? "true" : "false");
      article.setAttribute("spellcheck", this.editable ? "true" : "false");
    }
  }

  revokeAssets() {
    for (const url of this.blobUrls.values()) URL.revokeObjectURL(url);
    this.blobUrls.clear();
  }

  async blobUrlFor(path) {
    if (this.blobUrls.has(path)) return this.blobUrls.get(path);
    const entry = zipEntry(this.documentModel.zip, path);
    if (!entry) return null;

    const bytes = await entry.async("uint8array");
    const url = URL.createObjectURL(new Blob([bytes], { type: inferMimeType(path) }));
    this.blobUrls.set(path, url);
    return url;
  }

  async rewriteRenderedResources(html) {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const resourceAttributes = [
      ["img", "src"],
      ["source", "src"],
      ["video", "src"],
      ["video", "poster"],
      ["audio", "src"]
    ];

    for (const [selector, attr] of resourceAttributes) {
      for (const element of parsed.querySelectorAll(selector + "[" + attr + "]")) {
        const value = element.getAttribute(attr);
        element.setAttribute("data-mdocss-source-src", value || "");
        const kind = referenceKind(value);
        if (kind === "data" || kind === "blob" || kind === "fragment") continue;

        if (kind === "external") {
          element.removeAttribute(attr);
          element.setAttribute("data-mdocss-blocked-resource", value);
          continue;
        }

        const resolved = normalizeArchiveReference("root.md", value);
        const url = resolved ? await this.blobUrlFor(resolved) : null;
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
      link.setAttribute("data-mdocss-source-href", href || "");
      const kind = referenceKind(href);

      if (kind === "external") {
        link.setAttribute("rel", "noopener noreferrer");
        link.setAttribute("data-mdocss-external-link", "true");
      } else if (kind === "archive") {
        const resolved = normalizeArchiveReference("root.md", href);
        const url = resolved ? await this.blobUrlFor(resolved) : null;
        if (url) link.setAttribute("href", url);
      }
    }

    return parsed.body.innerHTML;
  }

  async loadCss(path, seen = new Set()) {
    if (!path) return "";
    const resolvedPath = normalizeArchiveReference("", path);
    if (!resolvedPath || seen.has(resolvedPath)) return "";
    seen.add(resolvedPath);

    const entry = zipEntry(this.documentModel.zip, resolvedPath);
    if (!entry) throw new Error("Stylesheet not found: " + resolvedPath);

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
      let replacement = "";
      if (referenceKind(item.href) === "archive") {
        const importedPath = normalizeArchiveReference(resolvedPath, item.href);
        if (importedPath) {
          const imported = await this.loadCss(importedPath, seen);
          replacement = item.media
            ? "@media " + item.media + " {\n" + imported + "\n}"
            : imported;
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

      let replacement = 'url("")';
      if (kind === "archive") {
        const assetPath = normalizeArchiveReference(resolvedPath, item.href);
        const url = assetPath ? await this.blobUrlFor(assetPath) : null;
        if (url) replacement = 'url("' + url + '")';
      }
      css = css.replace(item.whole, replacement);
    }

    return css;
  }

  baseCss() {
    return [
      ":root { color-scheme: light; }",
      "html, body { margin: 0; min-height: 100%; background: white; color: #111; }",
      ".mdocss-document { display: block; min-height: 100vh; box-sizing: border-box; overflow-wrap: anywhere; }",
      "img, svg, video { max-width: 100%; }",
      "pre { overflow-x: auto; }",
      "[data-mdocss-missing-resource], [data-mdocss-blocked-resource] { outline: 1px dashed #b00; }",
      "@media print { html, body, .mdocss-document { background: white !important; } }"
    ].join("\n");
  }

  frameDocument(content, css) {
    const lang = this.documentModel?.manifest?.language || "en";
    const csp = [
      "default-src 'none'",
      "img-src blob: data:",
      "media-src blob: data:",
      "font-src blob: data:",
      "style-src 'unsafe-inline' blob:"
    ].join("; ");

    return [
      "<!doctype html>",
      '<html lang="' + escapeHtmlAttribute(lang) + '">',
      "<head>",
      '<meta charset="utf-8">',
      '<meta http-equiv="Content-Security-Policy" content="' + csp + '">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      '<style id="mdocss-base-style">' + this.baseCss() + "</style>",
      '<style id="mdocss-style">' + css + "</style>",
      "</head>",
      '<body><article class="mdocss-document" contenteditable="' +
        (this.editable ? "true" : "false") +
        '" spellcheck="' +
        (this.editable ? "true" : "false") +
        '">' + content + "</article></body>",
      "</html>"
    ].join("\n");
  }

  async render(markdown, cssEditorValue) {
    if (!this.documentModel) return { css: "" };

    writeEditors(this.documentModel, markdown, cssEditorValue);
    this.revokeAssets();

    const rawHtml = await marked.parse(markdown);
    const sanitized = DOMPurify.sanitize(rawHtml, {
      USE_PROFILES: { html: true },
      ALLOW_DATA_ATTR: true
    });
    const rewritten = await this.rewriteRenderedResources(sanitized);

    const path = activeCssPath(this.documentModel);
    const css = path ? await this.loadCss(path) : "";

    this.frame.srcdoc = this.frameDocument(rewritten, css);
    await new Promise(resolve => {
      if (this.frame.contentDocument?.readyState === "complete") resolve();
      else this.frame.addEventListener("load", resolve, { once: true });
    });

    return { css };
  }

  print() {
    if (!this.frame.contentWindow) return;
    this.frame.contentWindow.focus();
    this.frame.contentWindow.print();
  }
}
