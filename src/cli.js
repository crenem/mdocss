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

async function loadArchive(file) {
  return JSZip.loadAsync(await fs.readFile(file));
}

async function readManifest(zip) {
  const file = zip.file("manifest.json");
  if (!file) return null;
  return ensureManifestObject(JSON.parse(await utf8Text(file)));
}

async function validateZip(zip) {
  const errors = [];
  const names = Object.keys(zip.files);
  if (!zip.file("root.md")) errors.push("Missing required root.md");

  for (const name of names) {
    const item = zip.files[name];
    const original = originalName(name, item);
    if (dangerous(original)) errors.push(`Dangerous archive path: ${original}`);
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
      const schema = JSON.parse(
        await fs.readFile(new URL("../schema/manifest.schema.json", import.meta.url), "utf8")
      );
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
    } catch (error) {
      errors.push(`Invalid manifest.json: ${error.message}`);
    }
  }

  return errors;
}

async function requireValid(zip, context = "MDOCSS document") {
  const errors = await validateZip(zip);
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

    for (const [name, item] of Object.entries(zip.files)) {
      const original = originalName(name, item);
      if (dangerous(original)) {
        throw new Error(`Refusing dangerous archive path: ${original}`);
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
  .action(async file => {
    const zip = await loadArchive(file);
    const errors = await validateZip(zip);

    if (errors.length) {
      console.error(errors.map(error => `- ${error}`).join("\n"));
      process.exitCode = 1;
    } else {
      console.log("Valid MDOCSS 0.1 document");
    }
  });

await program.parseAsync();
