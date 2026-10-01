import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const repoPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const artifactsPath = path.join(repoPath, "artifacts");

async function walk(directory, base = directory) {
  const out = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full, base));
    else if (entry.isFile()) {
      out.push({
        full,
        rel: path.relative(base, full).split(path.sep).join("/")
      });
    }
  }
  return out;
}

async function packageDirectory(directory) {
  const zip = new JSZip();
  for (const file of await walk(directory)) {
    zip.file(file.rel, await fs.readFile(file.full));
  }
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 }
  });
}

async function generatedLocalAssetPackage() {
  const zip = new JSZip();
  zip.file(
    "root.md",
    "# Local asset smoke test\n\n![Bundled asset](assets/mark.svg)\n"
  );
  zip.file(
    "root.css",
    [
      ".mdocss-document { max-width: 42rem; margin: 2rem auto; font-family: sans-serif; }",
      "body { background-image: url(\"assets/mark.svg\"); background-repeat: no-repeat; background-position: right 1rem top 1rem; }"
    ].join("\n") + "\n"
  );
  zip.file(
    "assets/mark.svg",
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60"><rect width="120" height="60" rx="8" fill="#ddd"/><text x="60" y="36" text-anchor="middle" font-family="sans-serif" font-size="18">MDOCSS</text></svg>'
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function generatedRemoteResourcePackage() {
  const zip = new JSZip();
  zip.file(
    "root.md",
    "# Network isolation smoke test\n\n![Remote image](https://example.invalid/mdocss-should-not-fetch.png)\n"
  );
  zip.file(
    "root.css",
    ".mdocss-document { background-image: url(\"https://example.invalid/mdocss-should-not-fetch.css.png\"); }\n"
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

await fs.mkdir(artifactsPath, { recursive: true });

const viewerZip = path.join(artifactsPath, "mdocss-reference-viewer.zip");
const artifactNames = await fs.readdir(artifactsPath);
const obsidianName = artifactNames.find(name =>
  /^mdocss-obsidian-.*\.zip$/.test(name)
);
if (!obsidianName) throw new Error("Obsidian package not found; run package:obsidian first");

const styleDemoPath = path.join(artifactsPath, "mdocss-style-demo.mdocss");
const styleDemo = await fs.readFile(styleDemoPath);

const kit = new JSZip();
kit.file("README-FIRST.md", [
  "# MDOCSS runtime smoke kit",
  "",
  "Follow SMOKE_TEST.md and record findings on GitHub issue #2.",
  "",
  "Included:",
  "- browser/mdocss-reference-viewer.zip",
  "- obsidian/" + obsidianName,
  "- documents/mdocss-style-demo.mdocss",
  "- documents/basic.mdocss",
  "- documents/semantic-paper.mdocss",
  "- documents/local-asset.mdocss",
  "- documents/remote-resource.mdocss",
  "- hostile/ representative invalid fixtures",
  "- ROOT-SHA256.txt baseline for canonical-content checks",
  ""
].join("\n"));
kit.file("SMOKE_TEST.md", await fs.readFile(path.join(repoPath, "SMOKE_TEST.md")));
kit.file("INTEROPERABILITY.md", await fs.readFile(path.join(repoPath, "INTEROPERABILITY.md")));
kit.file("browser/mdocss-reference-viewer.zip", await fs.readFile(viewerZip));
kit.file("obsidian/" + obsidianName, await fs.readFile(path.join(artifactsPath, obsidianName)));
kit.file("documents/mdocss-style-demo.mdocss", styleDemo);
kit.file(
  "documents/basic.mdocss",
  await packageDirectory(path.join(repoPath, "examples", "basic"))
);
kit.file(
  "documents/semantic-paper.mdocss",
  await packageDirectory(path.join(repoPath, "examples", "semantic-paper"))
);
kit.file("documents/local-asset.mdocss", await generatedLocalAssetPackage());
kit.file("documents/remote-resource.mdocss", await generatedRemoteResourcePackage());

for (const name of [
  "invalid-path-traversal.mdocss",
  "invalid-absolute-path.mdocss",
  "invalid-backslash-path.mdocss",
  "invalid-root-utf8.mdocss",
  "invalid-manifest-json.mdocss",
  "invalid-duplicate-member.mdocss",
  "invalid-symlink.mdocss"
]) {
  kit.file(
    "hostile/" + name,
    await fs.readFile(path.join(repoPath, "conformance", "fixtures", name))
  );
}

const rootText = await fs.readFile(path.join(repoPath, "examples", "style-demo", "root.md"));
const digest = crypto.createHash("sha256").update(rootText).digest("hex");
kit.file(
  "ROOT-SHA256.txt",
  `mdocss-style-demo.mdocss root.md SHA-256  ${digest}\n`
);

const out = path.join(artifactsPath, "mdocss-smoke-kit.zip");
await fs.writeFile(
  out,
  await kit.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 }
  })
);

console.log("Wrote artifacts/mdocss-smoke-kit.zip");
