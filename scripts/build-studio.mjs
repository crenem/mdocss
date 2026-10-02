import fs from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const appRoot = path.join(root, "apps", "studio");

const result = await build({
  entryPoints: [path.join(appRoot, "src", "app.js")],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  legalComments: "none",
  minify: false,
  logLevel: "info"
});

const jsFile = result.outputFiles.find(file => file.path.endsWith(".js")) || result.outputFiles[0];
let javascript = new TextDecoder().decode(jsFile.contents);
javascript = javascript.replace(/<\/script/gi, "<\\/script");

let css = await fs.readFile(path.join(appRoot, "src", "app.css"), "utf8");
css = css.replace(/<\/style/gi, "<\\/style");

let html = await fs.readFile(path.join(appRoot, "index.html"), "utf8");
html = html.replace(
  '<link rel="stylesheet" href="./src/app.css">',
  "<style>\n" + css + "\n</style>"
);
html = html.replace(
  '<script src="./dist/app.js" defer></script>',
  "<script>\n" + javascript + "\n</script>"
);

if (/<script\b[^>]*\bsrc\s*=/i.test(html)) {
  throw new Error("Studio single-file build still contains an external script reference.");
}
if (/<link\b[^>]*\brel=["']?stylesheet/i.test(html)) {
  throw new Error("Studio single-file build still contains an external stylesheet reference.");
}

const outDir = path.join(root, "artifacts");
await fs.mkdir(outDir, { recursive: true });
const out = path.join(outDir, "MDOCSS-Studio.html");
await fs.writeFile(out, html, "utf8");

const bytes = Buffer.byteLength(html, "utf8");
console.log("Wrote artifacts/MDOCSS-Studio.html (" + bytes + " bytes)");
