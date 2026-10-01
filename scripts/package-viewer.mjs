import fs from "node:fs/promises";
import JSZip from "jszip";

const root = new URL("../", import.meta.url);
const zip = new JSZip();

const files = [
  ["index.html", "viewer/index.html"],
  ["src/app.css", "viewer/src/app.css"],
  ["dist/app.js", "viewer/dist/app.js"],
  ["README.md", "viewer/README.md"]
];

for (const [archivePath, repoPath] of files) {
  zip.file(archivePath, await fs.readFile(new URL(repoPath, root)));
}

const outDir = new URL("artifacts/", root);
await fs.mkdir(outDir, { recursive: true });

const out = new URL("mdocss-reference-viewer.zip", outDir);
await fs.writeFile(
  out,
  await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 }
  })
);

console.log("Wrote artifacts/mdocss-reference-viewer.zip");
