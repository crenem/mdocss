#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import JSZip from "jszip";
import { Command } from "commander";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const program = new Command();
program.name("mdocss").description("MDOCSS reference CLI").version("0.1.0");

async function walk(dir, base = dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full, base));
    else if (entry.isFile()) {
      out.push({ full, rel: path.relative(base, full).split(path.sep).join("/") });
    }
  }
  return out;
}

function dangerous(name) {
  if (!name || name.includes("\0")) return true;
  if (name.startsWith("/") || name.startsWith("\\")) return true;
  if (/^[A-Za-z]:/.test(name)) return true;
  if (name.includes("\\")) return true;
  return name.split("/").includes("..");
}

function isSymbolicLink(item) {
  const raw = item?.unixPermissions;
  const mode =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseInt(raw, 8)
        : NaN;

  return Number.isFinite(mode) && (mode & 0o170000) === 0o120000;
}

function centralDirectoryProfile(buffer) {
  const result = {
    duplicates: [],
    zip64: false,
    multiDisk: false,
    encrypted: [],
    unsupportedCompression: []
  };

  const minimumEocdSize = 22;
  if (buffer.length < minimumEocdSize) return result;

  const lowest = Math.max(0, buffer.length - minimumEocdSize - 0xffff);
  let eocd = -1;

  for (let offset = buffer.length - minimumEocdSize; offset >= lowest; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }

  if (eocd < 0) return result;

  const diskNumber = buffer.readUInt16LE(eocd + 4);
  const centralDisk = buffer.readUInt16LE(eocd + 6);
  const entriesOnDisk = buffer.readUInt16LE(eocd + 8);
  const totalEntries = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);

  result.multiDisk =
    diskNumber !== 0 ||
    centralDisk !== 0 ||
    entriesOnDisk !== totalEntries;

  if (
    totalEntries === 0xffff ||
    entriesOnDisk === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff
  ) {
    result.zip64 = true;
    return result;
  }

  if (eocd >= 20 && buffer.readUInt32LE(eocd - 20) === 0x07064b50) {
    result.zip64 = true;
  }

  const seen = new Map();
  let cursor = centralOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) {
      break;
    }

    const versionNeeded = buffer.readUInt16LE(cursor + 6);
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const filenameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const diskStart = buffer.readUInt16LE(cursor + 34);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const start = cursor + 46;
    const end = start + filenameLength;
    const extraEnd = end + extraLength;

    if (extraEnd > buffer.length) break;

    const rawName = buffer.subarray(start, end);
    const key = rawName.toString("hex");
    const displayName = (flags & 0x0800)
      ? rawName.toString("utf8")
      : rawName.toString("latin1");

    const count = (seen.get(key)?.count ?? 0) + 1;
    seen.set(key, { count, displayName });
    if (count === 2) result.duplicates.push(displayName);

    if ((flags & 0x0001) !== 0) result.encrypted.push(displayName);
    if (method !== 0 && method !== 8) {
      result.unsupportedCompression.push({ name: displayName, method });
    }

    if (
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      diskStart === 0xffff ||
      localOffset === 0xffffffff
    ) {
      result.zip64 = true;
    }

    let extraCursor = end;
    while (extraCursor + 4 <= extraEnd) {
      const headerId = buffer.readUInt16LE(extraCursor);
      const dataSize = buffer.readUInt16LE(extraCursor + 2);
      if (headerId === 0x0001) result.zip64 = true;
      extraCursor += 4 + dataSize;
    }

    if (
      localOffset + 30 <= buffer.length &&
      buffer.readUInt32LE(localOffset) === 0x04034b50
    ) {
      const localCompressedSize = buffer.readUInt32LE(localOffset + 18);
      const localUncompressedSize = buffer.readUInt32LE(localOffset + 22);
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const localExtraStart = localOffset + 30 + localNameLength;
      const localExtraEnd = localExtraStart + localExtraLength;

      if (
        versionNeeded >= 45 &&
        (localCompressedSize === 0xffffffff || localUncompressedSize === 0xffffffff)
      ) {
        result.zip64 = true;
      }

      let localExtraCursor = localExtraStart;
      while (
        localExtraCursor + 4 <= localExtraEnd &&
        localExtraEnd <= buffer.length
      ) {
        const headerId = buffer.readUInt16LE(localExtraCursor);
        const dataSize = buffer.readUInt16LE(localExtraCursor + 2);
        if (headerId === 0x0001) result.zip64 = true;
        localExtraCursor += 4 + dataSize;
      }
    }

    cursor = extraEnd + commentLength;
  }

  return result;
}

async function utf8Text(item) {
  const bytes = await item.async("uint8array");
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

async function readUtf8File(file, label = file) {
  const bytes = await fs.readFile(file);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} is not valid UTF-8`);
  }
}

function originalName(name, item) {
  return item?.unsafeOriginalName || name;
}

function declaredStyles(manifest) {
  return Array.isArray(manifest?.stylesheets) ? manifest.stylesheets : [];
}

function ensureManifestObject(value) {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error("manifest.json must contain a top-level JSON object");
  }
  return value;
}

const MANIFEST_SCHEMAS = {
  "0.1": new URL("../schema/manifest.schema.json", import.meta.url),
  "1.0": new URL("../schema/manifest-1.0-draft.schema.json", import.meta.url),
  "1.x": new URL("../schema/manifest-1.x-reader.schema.json", import.meta.url)
};

function parseSpecVersion(value) {
  if (value == null || value === "") return null;
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(value));
  if (!match) return { invalid: true, raw: String(value) };

  return {
    raw: String(value),
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

function validationFamilyForTarget(target) {
  if (!target) return null;
  if (target === "0.1" || target === "0.1.0") return "0.1";
  if (target === "1.0" || target === "1.0.0") return "1.0";
  return null;
}

function manifestValidationPlan(manifest, target = null) {
  const requestedFamily = validationFamilyForTarget(target);
  if (target && !requestedFamily) {
    return { error: `Unsupported validation target: ${target}` };
  }

  const parsed = parseSpecVersion(manifest?.specVersion);
  if (parsed?.invalid) {
    return { error: `Invalid specVersion: ${parsed.raw}` };
  }

  if (requestedFamily) {
    if (parsed) {
      const matchesTarget =
        requestedFamily === "0.1"
          ? parsed.major === 0 && parsed.minor === 1
          : parsed.major === 1 && parsed.minor === 0;

      if (!matchesTarget) {
        return {
          error: `specVersion ${parsed.raw} does not match validation target ${requestedFamily}`
        };
      }
    }

    return { family: requestedFamily, version: parsed?.raw ?? null };
  }

  if (!parsed) {
    return { family: "0.1", version: null, mode: "legacy-unversioned" };
  }

  if (parsed.major === 0 && parsed.minor === 1) {
    return { family: "0.1", version: parsed.raw, mode: "supported" };
  }

  if (parsed.major === 1) {
    return {
      family: "1.x",
      version: parsed.raw,
      mode: parsed.minor === 0 ? "supported" : "forward-compatible"
    };
  }

  return { unsupportedVersion: parsed.raw };
}

async function manifestSchema(family) {
  const source = MANIFEST_SCHEMAS[family];
  if (!source) throw new Error(`No manifest schema available for ${family}`);
  return JSON.parse(await fs.readFile(source, "utf8"));
}

async function loadArchive(file) {
  const buffer = await fs.readFile(file);
  const profile = centralDirectoryProfile(buffer);

  const profileErrors = [];
  if (profile.multiDisk) {
    profileErrors.push("Multi-disk/spanned ZIP archives are not allowed");
  }
  if (profile.zip64) {
    profileErrors.push("ZIP64 features are not allowed by the MDOCSS 1.0 ZIP profile");
  }
  for (const entry of profile.encrypted) {
    profileErrors.push(`Encrypted ZIP member is not allowed: ${entry}`);
  }
  for (const entry of profile.unsupportedCompression) {
    profileErrors.push(
      `Unsupported ZIP compression method ${entry.method}: ${entry.name}`
    );
  }

  if (profileErrors.length) {
    throw new Error(profileErrors.join("\n"));
  }

  const zip = await JSZip.loadAsync(buffer);
  Object.defineProperty(zip, "__mdocssDuplicateNames", {
    value: profile.duplicates,
    enumerable: false,
    configurable: false,
    writable: false
  });
  return zip;
}

async function readManifest(zip) {
  const file = zip.file("manifest.json");
  if (!file) return null;
  return ensureManifestObject(JSON.parse(await utf8Text(file)));
}

async function validateZip(zip, options = {}) {
  const errors = [];
  let unsupportedVersion = null;
  const names = Object.keys(zip.files);
  if (!zip.file("root.md")) errors.push("Missing required root.md");

  for (const duplicate of zip.__mdocssDuplicateNames ?? []) {
    errors.push(`Duplicate archive member name: ${duplicate}`);
  }

  for (const name of names) {
    const item = zip.files[name];
    const original = originalName(name, item);
    if (dangerous(original)) errors.push(`Dangerous archive path: ${original}`);
    if (isSymbolicLink(item)) errors.push(`Symbolic-link archive member is not allowed: ${original}`);
  }

  const root = zip.file("root.md");
  if (root) {
    try { await utf8Text(root); }
    catch { errors.push("root.md is not valid UTF-8"); }
  }

  const fallbackCss = zip.file("root.css");
  if (fallbackCss) {
    try { await utf8Text(fallbackCss); }
    catch { errors.push("root.css is not valid UTF-8"); }
  }

  const manifestFile = zip.file("manifest.json");
  if (manifestFile) {
    try {
      const data = ensureManifestObject(JSON.parse(await utf8Text(manifestFile)));
      const plan = manifestValidationPlan(data, options.target ?? null);

      if (plan.error) {
        errors.push(plan.error);
      } else if (plan.unsupportedVersion) {
        unsupportedVersion = plan.unsupportedVersion;
      } else {
        const schema = await manifestSchema(plan.family);
        const ajv = new Ajv2020({ allErrors: true, strict: false });
        addFormats(ajv);
        const check = ajv.compile(schema);

        if (!check(data)) {
          for (const err of check.errors ?? []) {
            errors.push(`manifest.json ${err.instancePath || "/"} ${err.message}`);
          }
        }

        const styles = declaredStyles(data);
        const ids = new Set();

        for (const style of styles) {
          if (ids.has(style.id)) errors.push(`Duplicate stylesheet id: ${style.id}`);
          ids.add(style.id);

          if (dangerous(style.href)) {
            errors.push(`Dangerous stylesheet path: ${style.href}`);
            continue;
          }

          if (!style.href.toLowerCase().endsWith(".css")) {
            errors.push(`Stylesheet does not reference a .css file: ${style.href}`);
          }

          const styleFile = zip.file(style.href);
          if (!styleFile) {
            errors.push(`Declared stylesheet not found: ${style.href}`);
          } else {
            try { await utf8Text(styleFile); }
            catch { errors.push(`Stylesheet is not valid UTF-8: ${style.href}`); }
          }
        }

        if (data.defaultStylesheet && !ids.has(data.defaultStylesheet)) {
          errors.push(
            `defaultStylesheet does not match a declared stylesheet id: ${data.defaultStylesheet}`
          );
        }
      }
    } catch (error) {
      errors.push(`Invalid manifest.json: ${error.message}`);
    }
  }

  return { errors, unsupportedVersion };
}

async function requireValid(zip, context = "MDOCSS document") {
  const { errors, unsupportedVersion } = await validateZip(zip);
  if (unsupportedVersion) {
    throw new Error(
      `${context} declares unsupported MDOCSS major version ${unsupportedVersion}`
    );
  }
  if (errors.length) {
    throw new Error(`${context} is not conforming:\n${errors.map(e => `- ${e}`).join("\n")}`);
  }
}

async function writeArchiveAtomic(zip, filename) {
  await requireValid(zip, "Modified MDOCSS document");

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE"
  });

  const directory = path.dirname(path.resolve(filename));
  const basename = path.basename(filename);
  const temp = path.join(directory, `.${basename}.mdocss-tmp-${process.pid}-${Date.now()}`);

  try {
    await fs.writeFile(temp, buffer, { flag: "wx" });
    await fs.rename(temp, filename);
  } catch (error) {
    await fs.rm(temp, { force: true }).catch(() => {});
    throw error;
  }
}

async function editableArchive(filename) {
  const zip = await loadArchive(filename);
  await requireValid(zip, "Source MDOCSS document");
  return zip;
}

async function writeManifest(zip, manifest) {
  ensureManifestObject(manifest);
  zip.file("manifest.json", JSON.stringify(manifest, null, 2) + "\n");
}

program.command("pack")
  .argument("<directory>")
  .argument("<output>")
  .action(async (directory, output) => {
    const files = await walk(directory);
    if (!files.some(file => file.rel === "root.md")) {
      throw new Error("Source directory must contain root.md");
    }

    const zip = new JSZip();
    for (const file of files) zip.file(file.rel, await fs.readFile(file.full));
    await requireValid(zip, "Source directory");

    await fs.writeFile(
      output,
      await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
    );
    console.log(`Wrote ${output}`);
  });

program.command("unpack")
  .argument("<file>")
  .argument("<directory>")
  .action(async (file, directory) => {
    const zip = await loadArchive(file);

    const duplicates = zip.__mdocssDuplicateNames ?? [];
    if (duplicates.length) {
      throw new Error(`Refusing archive with duplicate member names: ${duplicates.join(", ")}`);
    }

    for (const [name, item] of Object.entries(zip.files)) {
      const original = originalName(name, item);
      if (dangerous(original)) {
        throw new Error(`Refusing dangerous archive path: ${original}`);
      }
      if (isSymbolicLink(item)) {
        throw new Error(`Refusing symbolic-link archive member: ${original}`);
      }
      if (item.dir) continue;

      const dest = path.join(directory, ...name.split("/"));
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, await item.async("nodebuffer"));
    }

    console.log(`Extracted to ${directory}`);
  });

program.command("inspect")
  .argument("<file>")
  .action(async file => {
    const zip = await loadArchive(file);
    const manifest = await readManifest(zip);

    console.log(JSON.stringify({
      format: "MDOCSS",
      members: Object.keys(zip.files),
      manifest
    }, null, 2));
  });

program.command("styles")
  .description("List named hot-swappable stylesheets")
  .argument("<file>")
  .action(async file => {
    const zip = await loadArchive(file);
    const manifest = await readManifest(zip);
    const styles = declaredStyles(manifest);

    if (!styles.length) {
      if (zip.file("root.css")) {
        console.log("* fallback\troot.css\tRoot stylesheet");
      } else {
        console.log("No document stylesheets declared.");
      }
      return;
    }

    const defaultId = manifest?.defaultStylesheet;
    for (const style of styles) {
      const marker = style.id === defaultId ? "*" : " ";
      console.log(`${marker} ${style.id}\t${style.href}\t${style.label}`);
    }
  });

program.command("set-root")
  .description("Replace canonical root.md while preserving the rest of the package")
  .argument("<file>", "MDOCSS archive to modify")
  .argument("<markdown-file>", "UTF-8 Markdown source")
  .action(async (file, markdownFile) => {
    const zip = await editableArchive(file);
    const markdown = await readUtf8File(markdownFile, markdownFile);
    zip.file("root.md", markdown);
    await writeArchiveAtomic(zip, file);
    console.log(`Updated root.md in ${file}`);
  });

program.command("set-manifest")
  .description("Replace manifest.json explicitly")
  .argument("<file>", "MDOCSS archive to modify")
  .argument("<manifest-file>", "UTF-8 JSON manifest")
  .action(async (file, manifestFile) => {
    const zip = await editableArchive(file);
    const text = await readUtf8File(manifestFile, manifestFile);
    const manifest = ensureManifestObject(JSON.parse(text));
    await writeManifest(zip, manifest);
    await writeArchiveAtomic(zip, file);
    console.log(`Updated manifest.json in ${file}`);
  });

program.command("add-style")
  .description("Add a bundled stylesheet and declare it in manifest.json")
  .argument("<file>", "MDOCSS archive to modify")
  .argument("<css-file>", "UTF-8 CSS source")
  .requiredOption("--id <id>", "Stylesheet identifier")
  .requiredOption("--label <label>", "Human-readable stylesheet label")
  .option("--href <path>", "Archive path; defaults to styles/<css filename>")
  .option("--description <text>", "Stylesheet description")
  .option("--profile <id>", "Implementation-independent profile identifier")
  .option("--default", "Make this the author-defined default")
  .action(async (file, cssFile, options) => {
    const zip = await editableArchive(file);
    const css = await readUtf8File(cssFile, cssFile);
    const manifest = (await readManifest(zip)) ?? {
      specVersion: "0.1.0",
      entrypoint: "root.md"
    };

    const styles = [...declaredStyles(manifest)];
    if (styles.some(style => style.id === options.id)) {
      throw new Error(`Stylesheet id already exists: ${options.id}`);
    }

    const href = options.href || `styles/${path.basename(cssFile)}`;
    if (dangerous(href) || !href.toLowerCase().endsWith(".css")) {
      throw new Error(`Invalid stylesheet archive path: ${href}`);
    }

    const entry = {
      id: options.id,
      label: options.label,
      href
    };
    if (options.description) entry.description = options.description;
    if (options.profile) entry.profile = options.profile;

    zip.file(href, css);
    manifest.stylesheets = [...styles, entry];
    if (options.default) manifest.defaultStylesheet = options.id;

    await writeManifest(zip, manifest);
    await writeArchiveAtomic(zip, file);
    console.log(`Added stylesheet ${options.id} to ${file}`);
  });

program.command("remove-style")
  .description("Remove a stylesheet declaration")
  .argument("<file>", "MDOCSS archive to modify")
  .argument("<id>", "Stylesheet identifier")
  .option("--delete-css", "Delete the bundled CSS when no remaining style references it")
  .action(async (file, id, options) => {
    const zip = await editableArchive(file);
    const manifest = await readManifest(zip);
    if (!manifest) throw new Error("Document has no manifest.json");

    const styles = declaredStyles(manifest);
    const target = styles.find(style => style.id === id);
    if (!target) throw new Error(`Stylesheet id not found: ${id}`);

    const remaining = styles.filter(style => style.id !== id);
    if (remaining.length) manifest.stylesheets = remaining;
    else delete manifest.stylesheets;

    if (manifest.defaultStylesheet === id) {
      if (remaining.length) manifest.defaultStylesheet = remaining[0].id;
      else delete manifest.defaultStylesheet;
    }

    if (
      options.deleteCss &&
      !remaining.some(style => style.href === target.href)
    ) {
      zip.remove(target.href);
    }

    await writeManifest(zip, manifest);
    await writeArchiveAtomic(zip, file);
    console.log(`Removed stylesheet ${id} from ${file}`);
  });

program.command("rename-style")
  .description("Rename a stylesheet id and optionally its label or archive path")
  .argument("<file>", "MDOCSS archive to modify")
  .argument("<id>", "Current stylesheet identifier")
  .argument("<new-id>", "New stylesheet identifier")
  .option("--label <label>", "New human-readable label")
  .option("--href <path>", "Move the bundled CSS to a new archive path")
  .action(async (file, id, newId, options) => {
    const zip = await editableArchive(file);
    const manifest = await readManifest(zip);
    if (!manifest) throw new Error("Document has no manifest.json");

    const styles = declaredStyles(manifest).map(style => ({ ...style }));
    const target = styles.find(style => style.id === id);
    if (!target) throw new Error(`Stylesheet id not found: ${id}`);
    if (id !== newId && styles.some(style => style.id === newId)) {
      throw new Error(`Stylesheet id already exists: ${newId}`);
    }

    const oldHref = target.href;
    target.id = newId;
    if (options.label) target.label = options.label;

    if (options.href && options.href !== oldHref) {
      if (dangerous(options.href) || !options.href.toLowerCase().endsWith(".css")) {
        throw new Error(`Invalid stylesheet archive path: ${options.href}`);
      }

      const cssEntry = zip.file(oldHref);
      if (!cssEntry) throw new Error(`Declared stylesheet not found: ${oldHref}`);
      zip.file(options.href, await cssEntry.async("nodebuffer"));
      target.href = options.href;

      if (!styles.some(style => style !== target && style.href === oldHref)) {
        zip.remove(oldHref);
      }
    }

    manifest.stylesheets = styles;
    if (manifest.defaultStylesheet === id) manifest.defaultStylesheet = newId;

    await writeManifest(zip, manifest);
    await writeArchiveAtomic(zip, file);
    console.log(`Renamed stylesheet ${id} to ${newId} in ${file}`);
  });

program.command("validate")
  .argument("<file>")
  .option("--target <version>", "Validate authoring conformance for 0.1 or 1.0")
  .action(async (file, options) => {
    const zip = await loadArchive(file);
    const { errors, unsupportedVersion } = await validateZip(zip, {
      target: options.target ?? null
    });

    if (errors.length) {
      console.error(errors.map(error => `- ${error}`).join("\n"));
      process.exitCode = 1;
    } else if (unsupportedVersion) {
      console.error(
        `Unsupported MDOCSS major version ${unsupportedVersion}; root.md may still be safely recoverable`
      );
      process.exitCode = 2;
    } else {
      console.log(
        options.target
          ? `Valid MDOCSS ${options.target} document`
          : "Valid MDOCSS document"
      );
    }
  });

await program.parseAsync();
