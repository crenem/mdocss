import fs from "node:fs/promises";
import JSZip from "jszip";

const base = new URL("../integrations/obsidian/", import.meta.url);
const manifest = JSON.parse(await fs.readFile(new URL("manifest.json", base), "utf8"));

const zip = new JSZip();
for (const name of ["main.js", "manifest.json", "styles.css", "versions.json", "README.md"]) {
  zip.file(name, await fs.readFile(new URL(name, base)));
}

const outputDir = new URL("../artifacts/", import.meta.url);
await fs.mkdir(outputDir, { recursive: true });

const filename = `mdocss-obsidian-${manifest.version}.zip`;
const buffer = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
  compressionOptions: { level: 9 }
});

await fs.writeFile(new URL(filename, outputDir), buffer);
console.log(`Wrote artifacts/${filename}`);
