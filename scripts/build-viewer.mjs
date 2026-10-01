import fs from "node:fs/promises";
import { build } from "esbuild";

await fs.mkdir(new URL("../viewer/dist/", import.meta.url), { recursive: true });

await build({
  entryPoints: [new URL("../viewer/src/app.js", import.meta.url).pathname],
  outfile: new URL("../viewer/dist/app.js", import.meta.url).pathname,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  sourcemap: true,
  legalComments: "none",
  logLevel: "info"
});
