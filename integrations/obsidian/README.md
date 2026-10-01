# MDOCSS for Obsidian

This directory is the reference-integration scaffold for opening MDOCSS documents from Obsidian.

## Intended behavior

The plugin will:

1. register the `.mdocss` extension;
2. open the ZIP container without permanently extracting it into the vault;
3. render `root.md` using Obsidian's Markdown renderer;
4. apply `root.css` inside a scoped document container;
5. resolve bundled relative assets;
6. eventually support editing and repacking while preserving unknown files.

## Status

The integration is intentionally marked experimental while the 0.1 container specification stabilizes.

The core format does **not** depend on Obsidian. This plugin is one reference implementation among potentially many.
