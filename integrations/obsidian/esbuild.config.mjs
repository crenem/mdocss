import { build } from "esbuild";

await build({
  entryPoints: ["integrations/obsidian/src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr"
  ],
  format: "cjs",
  platform: "browser",
  target: "es2020",
  outfile: "integrations/obsidian/main.js",
  sourcemap: "inline",
  legalComments: "none",
  logLevel: "info"
});
