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
    dirty: false
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

export function writeEditors(documentModel, markdown, css) {
  if (!documentModel || documentModel.readOnly) return;
  documentModel.zip.file("root.md", markdown);
  documentModel.markdown = markdown;
  const cssPath = activeCssPath(documentModel);
  if (cssPath) documentModel.zip.file(cssPath, css);
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
    defaultStylesheet: "default"
  }, null, 2) + "\n");

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  return new File([blob], "Untitled.mdocss", { type: "application/zip" });
}
