import fs from "node:fs/promises";
import JSZip from "jszip";

const repo = new URL("../", import.meta.url);
const catalog = JSON.parse(
  await fs.readFile(new URL("styles/profiles.json", repo), "utf8")
);
const root = await fs.readFile(new URL("examples/style-demo/root.md", repo));

const zip = new JSZip();
zip.file("root.md", root);

const stylesheets = [];
for (const profile of catalog.profiles) {
  const href = `styles/${profile.file}`;
  zip.file(href, await fs.readFile(new URL(`styles/${profile.file}`, repo)));
  stylesheets.push({
    id: profile.id,
    label: profile.label,
    href,
    profile: profile.id
  });
}

zip.file("manifest.json", JSON.stringify({
  specVersion: "0.1.0",
  title: "One Document, Many Presentations",
  language: "en",
  entrypoint: "root.md",
  stylesheets,
  defaultStylesheet: "org.mdocss.reading.clean",
  authors: [{ name: "Example Author" }]
}, null, 2) + "\n");

const outDir = new URL("artifacts/", repo);
await fs.mkdir(outDir, { recursive: true });
const out = new URL("mdocss-style-demo.mdocss", outDir);
await fs.writeFile(
  out,
  await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 }
  })
);
console.log("Wrote artifacts/mdocss-style-demo.mdocss");
