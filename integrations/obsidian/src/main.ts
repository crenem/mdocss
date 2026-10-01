import {
  FileView,
  Plugin,
  TFile,
  WorkspaceLeaf
} from "obsidian";
import JSZip, { type JSZipObject } from "jszip";
import { marked } from "marked";
import DOMPurify from "dompurify";

const VIEW_TYPE_MDOCSS = "mdocss-view";

type StylesheetEntry = {
  id: string;
  label: string;
  href: string;
  description?: string;
  profile?: string;
};

type Manifest = {
  specVersion?: string;
  title?: string;
  language?: string;
  entrypoint?: string;
  stylesheets?: StylesheetEntry[];
  defaultStylesheet?: string;
  [key: string]: unknown;
};

type PluginData = {
  styleByPath: Record<string, string>;
};

function referenceKind(value: string): "empty" | "fragment" | "data" | "blob" | "external" | "archive" {
  const ref = String(value ?? "").trim();
  if (!ref) return "empty";
  if (ref.startsWith("#")) return "fragment";
  if (/^data:/i.test(ref)) return "data";
  if (/^blob:/i.test(ref)) return "blob";
  if (ref.startsWith("//") || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(ref)) return "external";
  return "archive";
}

function escapeHtmlAttribute(value: string): string {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  } as Record<string, string>)[character]);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}


function manifestCompatibility(manifest: Manifest | null): { supported: boolean; version: string | null } {
  const version = manifest?.specVersion;
  if (version == null || version === "") return { supported: true, version: null };

  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version));
  if (!match) return { supported: false, version: String(version) };

  const major = Number(match[1]);
  const minor = Number(match[2]);

  return {
    supported:
      (major === 0 && minor === 1) ||
      major === 1,
    version: String(version)
  };
}

function dangerousArchiveMember(name: string): boolean {
  if (!name || /[\x00-\x1f\x7f]/.test(name)) return true;
  if (name.startsWith("/") || name.startsWith("\\")) return true;
  if (/^[A-Za-z]:/.test(name) || name.includes("\\")) return true;

  const parts = name.split("/");
  if (parts.includes("..") || parts.includes(".")) return true;
  return parts.slice(0, -1).includes("");
}

function zipInteroperabilityIssues(input: ArrayBuffer): string[] {
  const bytes = new Uint8Array(input);
  const issues: string[] = [];
  if (bytes.byteLength < 22) return issues;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const lowest = Math.max(0, bytes.byteLength - 22 - 0xffff);
  let eocd = -1;

  for (let offset = bytes.byteLength - 22; offset >= lowest; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }

  if (eocd < 0) return issues;

  const diskNumber = view.getUint16(eocd + 4, true);
  const centralDisk = view.getUint16(eocd + 6, true);
  const entriesOnDisk = view.getUint16(eocd + 8, true);
  const totalEntries = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);

  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== totalEntries) {
    issues.push("Multi-disk/spanned ZIP archives are not allowed.");
  }

  let zip64 =
    entriesOnDisk === 0xffff ||
    totalEntries === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff ||
    (eocd >= 20 && view.getUint32(eocd - 20, true) === 0x07064b50);

  if (zip64 || centralOffset >= bytes.byteLength) {
    if (zip64) issues.push("ZIP64 features are not allowed by the MDOCSS ZIP profile.");
    return issues;
  }

  let cursor = centralOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > bytes.byteLength || view.getUint32(cursor, true) !== 0x02014b50) break;

    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const filenameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const diskStart = view.getUint16(cursor + 34, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const start = cursor + 46;
    const end = start + filenameLength;
    const extraEnd = end + extraLength;

    if (extraEnd > bytes.byteLength) break;

    const raw = bytes.slice(start, end);
    let display: string;

    if ((flags & 0x0800) !== 0) {
      try {
        display = new TextDecoder("utf-8", { fatal: true }).decode(raw);
      } catch {
        display = Array.from(raw, byte => byte.toString(16).padStart(2, "0")).join("");
        issues.push(`ZIP member name marked UTF-8 is not valid UTF-8: ${display}`);
      }
    } else {
      display = new TextDecoder("windows-1252").decode(raw);
      if (raw.some(byte => byte >= 0x80)) {
        issues.push(
          `Non-ASCII ZIP member name must set the UTF-8 language flag: ${display}`
        );
      }
    }

    if ((flags & 0x0001) !== 0) {
      issues.push(`Encrypted ZIP member is not allowed: ${display}`);
    }
    if (method !== 0 && method !== 8) {
      issues.push(`Unsupported ZIP compression method ${method}: ${display}`);
    }

    if (
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      diskStart === 0xffff ||
      localOffset === 0xffffffff
    ) {
      zip64 = true;
    }

    let extraCursor = end;
    while (extraCursor + 4 <= extraEnd) {
      const headerId = view.getUint16(extraCursor, true);
      const dataSize = view.getUint16(extraCursor + 2, true);
      if (headerId === 0x0001) zip64 = true;
      extraCursor += 4 + dataSize;
    }

    if (
      localOffset + 30 <= bytes.byteLength &&
      view.getUint32(localOffset, true) === 0x04034b50
    ) {
      const localCompressedSize = view.getUint32(localOffset + 18, true);
      const localUncompressedSize = view.getUint32(localOffset + 22, true);
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const localExtraStart = localOffset + 30 + localNameLength;
      const localExtraEnd = localExtraStart + localExtraLength;

      if (
        localCompressedSize === 0xffffffff ||
        localUncompressedSize === 0xffffffff
      ) {
        zip64 = true;
      }

      let localExtraCursor = localExtraStart;
      while (
        localExtraCursor + 4 <= localExtraEnd &&
        localExtraEnd <= bytes.byteLength
      ) {
        const headerId = view.getUint16(localExtraCursor, true);
        const dataSize = view.getUint16(localExtraCursor + 2, true);
        if (headerId === 0x0001) zip64 = true;
        localExtraCursor += 4 + dataSize;
      }
    }

    cursor = extraEnd + commentLength;
  }

  if (zip64 && !issues.some(issue => issue.startsWith("ZIP64 features"))) {
    issues.push("ZIP64 features are not allowed by the MDOCSS ZIP profile.");
  }

  return issues;
}

function isZipSymlink(entry: JSZipObject): boolean {
  const raw = entry.unixPermissions;
  const mode =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseInt(raw, 8)
        : NaN;

  return Number.isFinite(mode) && (mode & 0o170000) === 0o120000;
}

function duplicateZipMemberNames(input: ArrayBuffer): string[] {
  const bytes = new Uint8Array(input);
  if (bytes.byteLength < 22) return [];

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const lowest = Math.max(0, bytes.byteLength - 22 - 0xffff);
  let eocd = -1;

  for (let offset = bytes.byteLength - 22; offset >= lowest; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }

  if (eocd < 0) return [];

  const totalEntries = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (totalEntries === 0xffff || centralOffset === 0xffffffff) return [];

  const seen = new Map<string, number>();
  const duplicates: string[] = [];
  let cursor = centralOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > bytes.byteLength || view.getUint32(cursor, true) !== 0x02014b50) break;

    const filenameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const start = cursor + 46;
    const end = start + filenameLength;
    if (end > bytes.byteLength) break;

    const raw = bytes.slice(start, end);
    const key = Array.from(raw, byte => byte.toString(16).padStart(2, "0")).join("");
    const display = new TextDecoder("utf-8").decode(raw);
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count === 2) duplicates.push(display);

    cursor = end + extraLength + commentLength;
  }

  return duplicates;
}

function normalizeArchiveReference(baseFile: string, reference: string): string | null {
  if (referenceKind(reference) !== "archive") return null;

  let ref = String(reference).trim();
  const suffixIndex = ref.search(/[?#]/);
  if (suffixIndex >= 0) ref = ref.slice(0, suffixIndex);
  ref = safeDecode(ref);

  if (!ref || ref.includes("\\") || ref.startsWith("/") || /^[A-Za-z]:/.test(ref)) return null;

  const base = String(baseFile || "").replace(/\\/g, "/");
  const slash = base.lastIndexOf("/");
  const baseDir = slash >= 0 ? base.slice(0, slash) : "";

  const parts: string[] = [];
  for (const part of [...(baseDir ? baseDir.split("/") : []), ...ref.split("/")]) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!parts.length) return null;
      parts.pop();
      continue;
    }
    parts.push(part);
  }

  return parts.join("/");
}

function inferMimeType(pathname: string): string {
  const ext = pathname.toLowerCase().split(".").pop() ?? "";
  const types: Record<string, string> = {
    apng: "image/apng",
    avif: "image/avif",
    css: "text/css",
    gif: "image/gif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    json: "application/json",
    md: "text/markdown",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    ogg: "audio/ogg",
    pdf: "application/pdf",
    png: "image/png",
    svg: "image/svg+xml",
    txt: "text/plain",
    wav: "audio/wav",
    webm: "video/webm",
    webp: "image/webp",
    woff: "font/woff",
    woff2: "font/woff2"
  };
  return types[ext] ?? "application/octet-stream";
}

function declaredStyles(manifest: Manifest | null, hasRootCss: boolean): StylesheetEntry[] {
  const styles = Array.isArray(manifest?.stylesheets)
    ? manifest.stylesheets.filter(style =>
        style &&
        typeof style.id === "string" &&
        typeof style.label === "string" &&
        typeof style.href === "string"
      )
    : [];

  if (styles.length) return styles;

  return hasRootCss
    ? [{ id: "fallback", label: "Document style", href: "root.css" }]
    : [];
}

function initialStyle(
  manifest: Manifest | null,
  styles: StylesheetEntry[],
  preference?: string
): string | null {
  if (!styles.length) return null;
  if (preference && styles.some(style => style.id === preference)) return preference;
  if (manifest?.defaultStylesheet && styles.some(style => style.id === manifest.defaultStylesheet)) {
    return manifest.defaultStylesheet;
  }
  return styles.find(style => style.href === "root.css")?.id ?? styles[0].id;
}

async function decodeUtf8(entry: JSZipObject, label: string): Promise<string> {
  try {
    const bytes = await entry.async("uint8array");
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} is not valid UTF-8.`);
  }
}

function safeEntry(zip: JSZip, path: string): JSZipObject | null {
  const entry = zip.file(path);
  return entry && !entry.dir ? entry : null;
}

class MdocssView extends FileView {
  private plugin: MdocssPlugin;
  private zip: JSZip | null = null;
  private manifest: Manifest | null = null;
  private styles: StylesheetEntry[] = [];
  private activeStyle: string | null = null;
  private blobUrls = new Map<string, string>();
  private styleSelect: HTMLSelectElement | null = null;
  private frame: HTMLIFrameElement | null = null;
  private statusEl: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: MdocssPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  override getViewType(): string {
    return VIEW_TYPE_MDOCSS;
  }

  override getDisplayText(): string {
    return this.file?.basename ?? "MDOCSS";
  }

  override getIcon(): string {
    return "file-text";
  }

  override async onLoadFile(file: TFile): Promise<void> {
    await super.onLoadFile(file);
    await this.renderFile(file);
  }

  override async onUnloadFile(file: TFile): Promise<void> {
    this.revokeBlobUrls();
    this.zip = null;
    this.manifest = null;
    this.styles = [];
    this.activeStyle = null;
    await super.onUnloadFile(file);
  }

  private revokeBlobUrls(): void {
    for (const url of this.blobUrls.values()) URL.revokeObjectURL(url);
    this.blobUrls.clear();
  }

  private async blobUrlFor(path: string): Promise<string | null> {
    if (!this.zip) return null;
    const cached = this.blobUrls.get(path);
    if (cached) return cached;

    const entry = safeEntry(this.zip, path);
    if (!entry) return null;

    const bytes = await entry.async("uint8array");
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
    const url = URL.createObjectURL(new Blob([buffer], { type: inferMimeType(path) }));
    this.blobUrls.set(path, url);
    return url;
  }

  private async rewriteRenderedResources(html: string): Promise<string> {
    const parsed = new DOMParser().parseFromString(html, "text/html");

    const attrs: Array<[string, string]> = [
      ["img", "src"],
      ["source", "src"],
      ["video", "src"],
      ["video", "poster"],
      ["audio", "src"]
    ];

    for (const [selector, attr] of attrs) {
      for (const element of Array.from(parsed.querySelectorAll(`${selector}[${attr}]`))) {
        const value = element.getAttribute(attr) ?? "";
        const kind = referenceKind(value);

        if (kind === "data" || kind === "blob" || kind === "fragment") continue;

        if (kind === "external") {
          element.removeAttribute(attr);
          element.setAttribute("data-mdocss-blocked-resource", value);
          continue;
        }

        const resolved = normalizeArchiveReference("root.md", value);
        const url = resolved ? await this.blobUrlFor(resolved) : null;

        if (url) element.setAttribute(attr, url);
        else {
          element.removeAttribute(attr);
          element.setAttribute("data-mdocss-missing-resource", value);
        }
      }
    }

    for (const anchor of Array.from(parsed.querySelectorAll("a[href]"))) {
      const href = anchor.getAttribute("href") ?? "";
      const kind = referenceKind(href);

      if (kind === "external") {
        anchor.setAttribute("rel", "noopener noreferrer");
        anchor.setAttribute("data-mdocss-external-link", "true");
        continue;
      }

      if (kind === "archive") {
        const resolved = normalizeArchiveReference("root.md", href);
        const url = resolved ? await this.blobUrlFor(resolved) : null;
        if (url) anchor.setAttribute("href", url);
      }
    }

    return parsed.body.innerHTML;
  }

  private async loadCss(path: string, seen = new Set<string>()): Promise<string> {
    if (!this.zip) return "";

    const resolvedPath = normalizeArchiveReference("", path);
    if (!resolvedPath || seen.has(resolvedPath)) return "";
    seen.add(resolvedPath);

    const entry = safeEntry(this.zip, resolvedPath);
    if (!entry) throw new Error(`Stylesheet not found: ${resolvedPath}`);

    let css = await decodeUtf8(entry, resolvedPath);

    const importRe = /@import\s+(?:url\(\s*)?(?:"([^"]+)"|'([^']+)'|([^\s;)]+))\s*\)?\s*([^;]*);/gi;
    const imports: Array<{ whole: string; href: string; media: string }> = [];
    let match: RegExpExecArray | null;

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
          replacement = item.media ? `@media ${item.media} {\n${imported}\n}` : imported;
        }
      }
      css = css.replace(item.whole, replacement);
    }

    const urlRe = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi;
    const refs: Array<{ whole: string; href: string }> = [];

    while ((match = urlRe.exec(css)) !== null) {
      refs.push({
        whole: match[0],
        href: (match[1] || match[2] || match[3] || "").trim()
      });
    }

    for (const item of refs) {
      const kind = referenceKind(item.href);
      if (kind === "data" || kind === "blob" || kind === "fragment") continue;

      let replacement = "url(\"\")";
      if (kind === "archive") {
        const assetPath = normalizeArchiveReference(resolvedPath, item.href);
        const url = assetPath ? await this.blobUrlFor(assetPath) : null;
        if (url) replacement = `url("${url}")`;
      }

      css = css.replace(item.whole, replacement);
    }

    return css;
  }

  private baseCss(): string {
    return `
      :root { color-scheme: light; }
      html, body { margin: 0; min-height: 100%; background: white; color: #111; }
      .mdocss-document {
        display: block;
        min-height: 100vh;
        box-sizing: border-box;
        overflow-wrap: anywhere;
      }
      img, svg, video { max-width: 100%; }
      pre { overflow-x: auto; }
      [data-mdocss-missing-resource],
      [data-mdocss-blocked-resource] { outline: 1px dashed #b00; }
    `;
  }

  private frameDocument(content: string, css: string): string {
    const lang = typeof this.manifest?.language === "string" ? this.manifest.language : "en";
    const csp = [
      "default-src 'none'",
      "img-src blob: data:",
      "media-src blob: data:",
      "font-src blob: data:",
      "style-src 'unsafe-inline' blob:"
    ].join("; ");

    return `<!doctype html>
<html lang="${escapeHtmlAttribute(lang)}">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style id="mdocss-base-style">${this.baseCss()}</style>
  <style id="mdocss-style">${css}</style>
</head>
<body>
  <article class="mdocss-document">${content}</article>
</body>
</html>`;
  }

  private async setStyle(styleId: string, persist: boolean): Promise<void> {
    const style = this.styles.find(item => item.id === styleId);
    const css = style ? await this.loadCss(style.href) : "";

    const styleNode = this.frame?.contentDocument?.querySelector<HTMLStyleElement>("#mdocss-style");
    if (styleNode) styleNode.textContent = css;

    this.activeStyle = style?.id ?? null;
    if (this.statusEl) {
      this.statusEl.textContent = style ? `Style: ${style.label}` : "No bundled stylesheet";
    }

    if (persist && this.file && style) {
      await this.plugin.rememberStyle(this.file.path, style.id);
    }
  }

  private buildToolbar(file: TFile): HTMLElement {
    const toolbar = this.contentEl.createDiv({ cls: "mdocss-obsidian-toolbar" });

    toolbar.createDiv({
      cls: "mdocss-obsidian-title",
      text: this.manifest?.title || file.basename
    });

    const right = toolbar.createDiv({ cls: "mdocss-obsidian-actions" });
    const label = right.createEl("label", { cls: "mdocss-obsidian-style-label" });
    label.createSpan({ text: "Style" });

    this.styleSelect = label.createEl("select");
    this.styleSelect.addEventListener("change", () => {
      if (!this.styleSelect) return;
      void this.setStyle(this.styleSelect.value, true);
    });

    const printButton = right.createEl("button", { text: "Print" });
    printButton.addEventListener("click", () => {
      this.frame?.contentWindow?.focus();
      this.frame?.contentWindow?.print();
    });

    return toolbar;
  }

  private async renderFile(file: TFile): Promise<void> {
    this.revokeBlobUrls();
    this.contentEl.empty();

    try {
      const bytes = await this.app.vault.readBinary(file);
      const duplicates = duplicateZipMemberNames(bytes);
      if (duplicates.length) {
        throw new Error(`Duplicate archive member names are not allowed: ${duplicates.join(", ")}`);
      }

      const zipIssues = zipInteroperabilityIssues(bytes);
      if (zipIssues.length) {
        throw new Error(zipIssues.join(" "));
      }

      this.zip = await JSZip.loadAsync(bytes);

      for (const [name, entry] of Object.entries(this.zip.files)) {
        const original = entry.unsafeOriginalName || name;
        if (dangerousArchiveMember(original)) {
          throw new Error(`Unsafe archive member path: ${original}`);
        }
        if (isZipSymlink(entry)) {
          throw new Error(`Symbolic-link archive member is not allowed: ${original}`);
        }
      }

      const root = safeEntry(this.zip, "root.md");
      if (!root) throw new Error("Required root.md is missing.");

      const markdown = await decodeUtf8(root, "root.md");

      const manifestEntry = safeEntry(this.zip, "manifest.json");
      const parsedManifest = manifestEntry
        ? JSON.parse(await decodeUtf8(manifestEntry, "manifest.json")) as Manifest
        : null;

      if (parsedManifest && (Array.isArray(parsedManifest) || typeof parsedManifest !== "object")) {
        throw new Error("manifest.json must contain a JSON object.");
      }

      const compatibility = manifestCompatibility(parsedManifest);
      this.manifest = compatibility.supported ? parsedManifest : null;
      this.styles = compatibility.supported
        ? declaredStyles(this.manifest, Boolean(safeEntry(this.zip, "root.css")))
        : [];

      this.buildToolbar(file);

      const rawHtml = await marked.parse(markdown, { gfm: true, breaks: false });
      const sanitized = DOMPurify.sanitize(rawHtml, {
        USE_PROFILES: { html: true },
        ALLOW_DATA_ATTR: true
      });
      const rewritten = await this.rewriteRenderedResources(sanitized);

      if (this.styleSelect) {
        this.styleSelect.empty();

        if (!this.styles.length) {
          this.styleSelect.add(new Option("No bundled styles", ""));
          this.styleSelect.disabled = true;
        } else {
          for (const style of this.styles) {
            this.styleSelect.add(new Option(style.label, style.id));
          }
          this.styleSelect.disabled = false;
        }
      }

      const preference = this.plugin.data.styleByPath[file.path];
      const selectedId = initialStyle(this.manifest, this.styles, preference);
      const selected = this.styles.find(style => style.id === selectedId);
      const css = selected ? await this.loadCss(selected.href) : "";

      this.frame = this.contentEl.createEl("iframe", {
        cls: "mdocss-obsidian-frame",
        attr: {
          title: `Rendered MDOCSS: ${file.basename}`,
          sandbox: "allow-same-origin"
        }
      });

      this.frame.srcdoc = this.frameDocument(rewritten, css);
      this.activeStyle = selected?.id ?? null;
      if (this.styleSelect && selected) this.styleSelect.value = selected.id;

      this.statusEl = this.contentEl.createDiv({
        cls: "mdocss-obsidian-status",
        text: compatibility.supported
          ? (selected ? `Style: ${selected.label}` : "Rendered without a bundled stylesheet")
          : `Unsupported MDOCSS version ${compatibility.version || "unknown"}; canonical-content recovery mode`
      });
    } catch (error) {
      this.zip = null;
      this.manifest = null;
      this.styles = [];
      this.activeStyle = null;
      this.contentEl.createDiv({
        cls: "mdocss-obsidian-error",
        text: `Could not open MDOCSS document: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

export default class MdocssPlugin extends Plugin {
  data: PluginData = { styleByPath: {} };

  override async onload(): Promise<void> {
    const stored = await this.loadData();
    this.data = {
      styleByPath:
        stored && typeof stored.styleByPath === "object" && stored.styleByPath
          ? stored.styleByPath
          : {}
    };

    this.registerView(
      VIEW_TYPE_MDOCSS,
      leaf => new MdocssView(leaf, this)
    );
    this.registerExtensions(["mdocss"], VIEW_TYPE_MDOCSS);

    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        const preference = this.data.styleByPath[oldPath];
        if (!preference) return;
        delete this.data.styleByPath[oldPath];
        this.data.styleByPath[file.path] = preference;
        void this.saveData(this.data);
      })
    );
  }

  async rememberStyle(path: string, styleId: string): Promise<void> {
    this.data.styleByPath[path] = styleId;
    await this.saveData(this.data);
  }
}
