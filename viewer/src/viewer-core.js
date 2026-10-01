const SCHEME_RE = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const DRIVE_RE = /^[A-Za-z]:/;


export function manifestCompatibility(manifest) {
  const version = manifest?.specVersion;
  if (version == null || version === "") {
    return { supported: true, mode: "unversioned", version: null };
  }

  const match = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(String(version));
  if (!match) {
    return { supported: false, mode: "invalid-version", version: String(version) };
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);

  if (major === 0 && minor === 1) {
    return { supported: true, mode: "supported", version: String(version) };
  }

  if (major === 1) {
    return {
      supported: true,
      mode: minor === 0 ? "supported" : "forward-compatible",
      version: String(version)
    };
  }

  return { supported: false, mode: "unsupported", version: String(version) };
}

export function dangerousArchiveMember(name) {
  const value = String(name ?? "");
  if (!value || value.includes("\0")) return true;
  if (value.startsWith("/") || value.startsWith("\\")) return true;
  if (DRIVE_RE.test(value) || value.includes("\\")) return true;
  return value.split("/").includes("..");
}

export function duplicateZipMemberNames(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
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

  const seen = new Map();
  const duplicates = [];
  let cursor = centralOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > bytes.byteLength || view.getUint32(cursor, true) !== 0x02014b50) {
      break;
    }

    const flags = view.getUint16(cursor + 8, true);
    const filenameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const start = cursor + 46;
    const end = start + filenameLength;
    if (end > bytes.byteLength) break;

    const raw = bytes.slice(start, end);
    const key = Array.from(raw, byte => byte.toString(16).padStart(2, "0")).join("");
    const display = (flags & 0x0800)
      ? new TextDecoder("utf-8").decode(raw)
      : new TextDecoder("windows-1252").decode(raw);

    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count === 2) duplicates.push(display);

    cursor = end + extraLength + commentLength;
  }

  return duplicates;
}

export function isZipSymlink(entry) {
  const raw = entry?.unixPermissions;
  const mode =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseInt(raw, 8)
        : NaN;

  return Number.isFinite(mode) && (mode & 0o170000) === 0o120000;
}

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
