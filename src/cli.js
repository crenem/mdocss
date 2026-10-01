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
    else if (entry.isFile()) out.push({ full, rel: path.relative(base, full).split(path.sep).join("/") });
  }
  return out;
}

function dangerous(name) {
  if (!name || name.includes("\0")) return true;
  if (name.startsWith("/") || name.startsWith("\\")) return true;
  if (/^[A-Za-z]:/.test(name)) return true;
  if (name.includes("\\")) return true;
  const parts = name.split("/");
  return parts.includes("..");
}

async function utf8Text(item) {
  const bytes = await item.async("uint8array");
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function originalName(name, item) {
  return item?.unsafeOriginalName || name;
}

function declaredStyles(manifest) {
  return Array.isArray(manifest?.stylesheets) ? manifest.stylesheets : [];
}

async function loadArchive(file) {
  return JSZip.loadAsync(await fs.readFile(file));
}

async function readManifest(zip) {
  const file = zip.file("manifest.json");
  return file ? JSON.parse(await file.async("string")) : null;
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
      const data = JSON.parse(await utf8Text(manifestFile));
      const schema = JSON.parse(await fs.readFile(new URL("../schema/manifest.schema.json", import.meta.url), "utf8"));
      const ajv = new Ajv2020({ allErrors: true, strict: false });
      addFormats(ajv);
      const check = ajv.compile(schema);
      if (!check(data)) {
        for (const err of check.errors ?? []) errors.push(`manifest.json ${err.instancePath || "/"} ${err.message}`);
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
        errors.push(`defaultStylesheet does not match a declared stylesheet id: ${data.defaultStylesheet}`);
      }
    } catch (e) {
      errors.push(`Invalid manifest.json: ${e.message}`);
    }
  }

  return errors;
}

program.command("pack")
  .argument("<directory>")
  .argument("<output>")
  .action(async (directory, output) => {
    const files = await walk(directory);
    if (!files.some(f => f.rel === "root.md")) throw new Error("Source directory must contain root.md");
    const zip = new JSZip();
    for (const f of files) zip.file(f.rel, await fs.readFile(f.full));
    await fs.writeFile(output, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
    console.log(`Wrote ${output}`);
  });

program.command("unpack")
  .argument("<file>")
  .argument("<directory>")
  .action(async (file, directory) => {
    const zip = await loadArchive(file);
    for (const [name, item] of Object.entries(zip.files)) {
      const original = originalName(name, item);
      if (dangerous(original)) throw new Error(`Refusing dangerous archive path: ${original}`);
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
      if (zip.file("root.css")) console.log("* fallback\troot.css\tRoot stylesheet");
      else console.log("No document stylesheets declared.");
      return;
    }

    const defaultId = manifest?.defaultStylesheet;
    for (const style of styles) {
      const marker = style.id === defaultId ? "*" : " ";
      console.log(`${marker} ${style.id}\t${style.href}\t${style.label}`);
    }
  });

program.command("validate")
  .argument("<file>")
  .action(async file => {
    const zip = await loadArchive(file);
    const errors = await validateZip(zip);
    if (errors.length) {
      console.error(errors.map(e => `- ${e}`).join("\n"));
      process.exitCode = 1;
    } else {
      console.log("Valid MDOCSS 0.1 document");
    }
  });

await program.parseAsync();
