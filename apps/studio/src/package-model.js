import JSZip from "jszip";
import {
  chooseInitialStyle,
  dangerousArchiveMember,
  duplicateZipMemberNames,
  isZipSymlink,
  manifestCompatibility,
  styleChoices,
  zipInteroperabilityIssues
} from "../../../viewer/src/viewer-core.js";

export async function decodeUtf8(entry, label) {
  try {
    const bytes = await entry.async("uint8array");
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(label + " is not valid UTF-8.");
  }
}

export function zipEntry(zip, path) {
  const entry = zip.file(path);
  return entry && !entry.dir ? entry : null;
}

export function validateArchive(zip, buffer) {
  const duplicates = duplicateZipMemberNames(buffer);
  if (duplicates.length) {
    throw new Error("Duplicate archive member names are not allowed: " + duplicates.join(", "));
  }

  const issues = zipInteroperabilityIssues(buffer);
  if (issues.length) throw new Error(issues.join("; "));

  for (const [name, entry] of Object.entries(zip.files)) {
    const original = entry.unsafeOriginalName || name;
    if (dangerousArchiveMember(original)) {
      throw new Error("Unsafe archive member path: " + original);
    }
    if (isZipSymlink(entry)) {
      throw new Error("Symbolic-link archive member is not allowed: " + original);
    }
  }
}

function refreshStyles(documentModel) {
  documentModel.styles = styleChoices(
    documentModel.manifest,
    Boolean(zipEntry(documentModel.zip, "root.css"))
  );

  if (!documentModel.styles.some(style => style.id === documentModel.activeStyleId)) {
    documentModel.activeStyleId = chooseInitialStyle(documentModel.manifest, documentModel.styles);
  }
}

export async function openPackage(file) {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  validateArchive(zip, buffer);

  const root = zipEntry(zip, "root.md");
  if (!root) throw new Error("This archive does not contain the required root.md.");
  const markdown = await decodeUtf8(root, "root.md");

  let manifest = null;
  const manifestEntry = zipEntry(zip, "manifest.json");
  if (manifestEntry) {
    manifest = JSON.parse(await decodeUtf8(manifestEntry, "manifest.json"));
    if (!manifest || Array.isArray(manifest) || typeof manifest !== "object") {
      throw new Error("manifest.json must contain a JSON object.");
    }
  }

  const compatibility = manifestCompatibility(manifest);
  const featureManifest = compatibility.supported ? manifest : null;
  const styles = compatibility.supported
    ? styleChoices(featureManifest, Boolean(zipEntry(zip, "root.css")))
    : [];

  return {
    fileName: file.name || "document.mdocss",
    zip,
    manifest: featureManifest,
    rawManifest: manifest,
    compatibility,
    styles,
    activeStyleId: chooseInitialStyle(featureManifest, styles),
    markdown,
    readOnly: !compatibility.supported,
    dirty: false,
    preferredMode: featureManifest?.documentOne?.preferredMode === "read" ? "read" : "edit"
  };
}

export function activeStyle(documentModel) {
  return documentModel?.styles.find(style => style.id === documentModel.activeStyleId) || null;
}

export function activeCssPath(documentModel) {
  return activeStyle(documentModel)?.href || null;
}

export async function readActiveCss(documentModel) {
  const path = activeCssPath(documentModel);
  if (!path) return "";
  const entry = zipEntry(documentModel.zip, path);
  return entry ? decodeUtf8(entry, path) : "";
}

export function writeManifest(documentModel) {
  if (!documentModel?.manifest) return;
  documentModel.zip.file("manifest.json", JSON.stringify(documentModel.manifest, null, 2) + "\n");
  documentModel.rawManifest = documentModel.manifest;
}

export function writeEditors(documentModel, markdown, css) {
  if (!documentModel || documentModel.readOnly) return;
  documentModel.zip.file("root.md", markdown);
  documentModel.markdown = markdown;
  const cssPath = activeCssPath(documentModel);
  if (cssPath) documentModel.zip.file(cssPath, css);
  writeManifest(documentModel);
}

function styleIdFromLabel(label) {
  const base = String(label || "style")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[^A-Za-z]+/, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "style";
  return /^[A-Za-z]/.test(base) ? base : "style-" + base;
}

function uniqueStyleId(documentModel, label) {
  const base = styleIdFromLabel(label);
  const used = new Set(documentModel.styles.map(style => style.id));
  let id = base;
  let index = 2;
  while (used.has(id)) id = base + "-" + index++;
  return id;
}

export async function addStyle(documentModel, label, css = "") {
  if (!documentModel?.manifest || documentModel.readOnly) {
    throw new Error("A writable manifest is required to create styles.");
  }

  const id = uniqueStyleId(documentModel, label);
  const href = "styles/" + id + ".css";
  documentModel.zip.file(href, css);
  documentModel.manifest.stylesheets = Array.isArray(documentModel.manifest.stylesheets)
    ? documentModel.manifest.stylesheets
    : [];
  documentModel.manifest.stylesheets.push({ id, label: String(label || id), href });
  if (!documentModel.manifest.defaultStylesheet) {
    documentModel.manifest.defaultStylesheet = id;
  }
  documentModel.activeStyleId = id;
  refreshStyles(documentModel);
  writeManifest(documentModel);
  return id;
}

export async function duplicateActiveStyle(documentModel, label) {
  const css = await readActiveCss(documentModel);
  return addStyle(documentModel, label, css);
}

export function renameActiveStyle(documentModel, label) {
  const style = activeStyle(documentModel);
  if (!style || !documentModel?.manifest || documentModel.readOnly) return false;
  const declaration = documentModel.manifest.stylesheets?.find(item => item.id === style.id);
  if (!declaration) return false;
  declaration.label = String(label || style.label).trim() || style.label;
  refreshStyles(documentModel);
  writeManifest(documentModel);
  return true;
}

export function deleteActiveStyle(documentModel) {
  const style = activeStyle(documentModel);
  if (!style || !documentModel?.manifest || documentModel.readOnly) return false;
  const declarations = documentModel.manifest.stylesheets;
  if (!Array.isArray(declarations) || declarations.length <= 1) return false;

  const index = declarations.findIndex(item => item.id === style.id);
  if (index < 0) return false;

  declarations.splice(index, 1);
  if (style.href !== "root.css") documentModel.zip.remove(style.href);

  if (documentModel.manifest.defaultStylesheet === style.id) {
    documentModel.manifest.defaultStylesheet = declarations[0]?.id;
  }

  documentModel.activeStyleId = declarations[Math.min(index, declarations.length - 1)]?.id || null;
  refreshStyles(documentModel);
  writeManifest(documentModel);
  return true;
}

function cleanAssetName(name) {
  const raw = String(name || "image")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return raw && raw !== "." && raw !== ".." ? raw : "image";
}

export async function addAsset(documentModel, file) {
  if (!documentModel || documentModel.readOnly) throw new Error("Document is read-only.");
  const clean = cleanAssetName(file.name);
  const dot = clean.lastIndexOf(".");
  const stem = dot > 0 ? clean.slice(0, dot) : clean;
  const ext = dot > 0 ? clean.slice(dot) : "";

  let path = "assets/" + clean;
  let index = 2;
  while (documentModel.zip.files[path]) {
    path = "assets/" + stem + "-" + index++ + ext;
  }

  documentModel.zip.file(path, new Uint8Array(await file.arrayBuffer()));
  return path;
}

export function setPreferredMode(documentModel, mode) {
  if (!documentModel?.manifest || documentModel.readOnly) return;
  documentModel.manifest.documentOne = {
    ...(documentModel.manifest.documentOne || {}),
    preferredMode: mode === "read" ? "read" : "edit"
  };
  documentModel.preferredMode = mode === "read" ? "read" : "edit";
  writeManifest(documentModel);
}

export async function generatePackageBlob(documentModel, markdown, css) {
  writeEditors(documentModel, markdown, css);
  return documentModel.zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 9 }
  });
}

export async function createNewPackage(initialCss) {
  const zip = new JSZip();

  zip.file("root.md", [
    '<section class="mdocss-title-page">',
    '  <h1 class="mdocss-title">Untitled Document</h1>',
    '  <p class="mdocss-author">Author</p>',
    "</section>",
    "",
    "# Introduction",
    "",
    "Start writing here.",
    ""
  ].join("\n"));

  zip.file("root.css", initialCss);

  zip.file("manifest.json", JSON.stringify({
    specVersion: "1.0.0",
    title: "Untitled Document",
    language: "en",
    entrypoint: "root.md",
    stylesheets: [
      { id: "default", label: "Default", href: "root.css" }
    ],
    defaultStylesheet: "default",
    documentOne: {
      preferredMode: "edit"
    }
  }, null, 2) + "\n");

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  return new File([blob], "Untitled.mdocss", { type: "application/zip" });
}
