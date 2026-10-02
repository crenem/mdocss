# MDOCSS for Obsidian

This directory contains the reference Obsidian integration for MDOCSS.

It registers the `.mdocss` extension with a custom Obsidian `FileView`, opens the ZIP container directly from the vault, renders `root.md`, resolves bundled resources, and exposes named stylesheets through a hot-swap picker.

## Current behavior

The plugin:

1. registers the `.mdocss` extension with Obsidian;
2. opens an archive directly from the vault without permanent extraction;
3. reads UTF-8 `root.md` and optional `manifest.json`;
4. sanitizes rendered Markdown/HTML;
5. preserves MDOCSS semantic classes;
6. enumerates named stylesheets;
7. hot-swaps the active stylesheet without rewriting `root.md`;
8. resolves bundled CSS `@import`, images, media, fonts, and other CSS resources;
9. blocks automatic remote document-resource fetching;
10. isolates document rendering in a sandboxed iframe;
11. remembers a per-file local style preference in plugin data;
12. migrates that preference when an MDOCSS file is renamed;
13. provides browser print preview.

A reader-local style choice does not rewrite `defaultStylesheet` in the document.

## Build

From the repository root:

```bash
npm install
npm run build:obsidian
```

This produces:

```text
integrations/obsidian/main.js
```

The plugin files for a manual installation are:

```text
main.js
manifest.json
styles.css
```

Place those files in:

```text
<Vault>/.obsidian/plugins/mdocss/
```

then reload Obsidian and enable the **MDOCSS** community plugin.

## Status

This is a reference implementation for the draft format, not yet a published Community directory release.

The source type-checks and bundles against the current Obsidian API in CI. Before the roadmap's v0.5 gate is considered complete, it still needs a manual smoke test inside Obsidian on representative MDOCSS fixtures.

The core MDOCSS format does **not** depend on Obsidian.
