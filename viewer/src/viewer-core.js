const SCHEME_RE = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const DRIVE_RE = /^[A-Za-z]:/;

export function referenceKind(value) {
  const ref = String(value ?? "").trim();
  if (!ref) return "empty";
  if (ref.startsWith("#")) return "fragment";
  if (/^data:/i.test(ref)) return "data";
  if (/^blob:/i.test(ref)) return "blob";
  if (ref.startsWith("//") || SCHEME_RE.test(ref)) return "external";
  return "archive";
}

function safeDecodePath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizeArchiveReference(baseFile, reference) {
  if (referenceKind(reference) !== "archive") return null;

  let ref = String(reference).trim();
  const suffixIndex = ref.search(/[?#]/);
  if (suffixIndex >= 0) ref = ref.slice(0, suffixIndex);
  ref = safeDecodePath(ref);

  if (!ref || ref.includes("\\") || ref.startsWith("/") || DRIVE_RE.test(ref)) {
    return null;
  }

  const base = String(baseFile || "").replace(/\\/g, "/");
  const slash = base.lastIndexOf("/");
  const baseDir = slash >= 0 ? base.slice(0, slash) : "";

  const parts = [];
  for (const piece of [...(baseDir ? baseDir.split("/") : []), ...ref.split("/")]) {
    if (!piece || piece === ".") continue;
    if (piece === "..") {
      if (!parts.length) return null;
      parts.pop();
      continue;
    }
    parts.push(piece);
  }

  return parts.join("/");
}

export function inferMimeType(pathname) {
  const ext = String(pathname).toLowerCase().split(".").pop();
  const types = {
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
  return types[ext] || "application/octet-stream";
}

export function styleChoices(manifest, hasRootCss = false) {
  const declared = Array.isArray(manifest?.stylesheets)
    ? manifest.stylesheets.filter(style =>
        style &&
        typeof style.id === "string" &&
        typeof style.label === "string" &&
        typeof style.href === "string"
      )
    : [];

  if (declared.length) return declared;

  if (hasRootCss) {
    return [{
      id: "fallback",
      label: "Document style",
      href: "root.css"
    }];
  }

  return [];
}

export function chooseInitialStyle(manifest, choices, localPreference = null) {
  if (!Array.isArray(choices) || !choices.length) return null;

  if (localPreference && choices.some(style => style.id === localPreference)) {
    return localPreference;
  }

  if (
    manifest?.defaultStylesheet &&
    choices.some(style => style.id === manifest.defaultStylesheet)
  ) {
    return manifest.defaultStylesheet;
  }

  const root = choices.find(style => style.href === "root.css");
  return root?.id || choices[0].id;
}
