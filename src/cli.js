#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import JSZip from "jszip";
import { Command } from "commander";
import Ajv from "ajv";
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
  if (!name || name.startsWith("/") || name.includes("\\")) return true;
  const parts = name.split("/");
  return parts.includes("..");
}

async function loadArchive(file) {
  return JSZip.loadAsync(await fs.readFile(file));
}

async function validateZip(zip) {
  const errors = [];
  const names = Object.keys(zip.files);
  if (!zip.file("root.md")) errors.push("Missing required root.md");

  for (const name of names) {
    if (dangerous(name)) errors.push(`Dangerous archive path: ${name}`);
  }

  const root = zip.file("root.md");
  if (root) {
    try { await root.async("string"); }
    catch { errors.push("root.md could not be decoded as text"); }
  }

  const manifestFile = zip.file("manifest.json");
  if (manifestFile) {
    try {
      const data = JSON.parse(await manifestFile.async("string"));
      const schema = JSON.parse(await fs.readFile(new URL("../schema/manifest.schema.json", import.meta.url), "utf8"));
      const ajv = new Ajv({ allErrors: true, strict: false });
      addFormats(ajv);
      const check = ajv.compile(schema);
      if (!check(data)) {
        for (const err of check.errors ?? []) errors.push(`manifest.json ${err.instancePath || "/"} ${err.message}`);
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
      if (dangerous(name)) throw new Error(`Refusing dangerous archive path: ${name}`);
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
    const manifest = zip.file("manifest.json")
      ? JSON.parse(await zip.file("manifest.json").async("string"))
      : null;
    console.log(JSON.stringify({
      format: "MDOCSS",
      members: Object.keys(zip.files),
      manifest
    }, null, 2));
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
