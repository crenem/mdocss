# MDOCSS for Obsidian

This directory is the reference-integration scaffold for opening MDOCSS documents from Obsidian.

## Intended behavior

The plugin will:

1. register the `.mdocss` extension;
2. open the ZIP container without permanently extracting it into the vault;
3. render `root.md` using Obsidian's Markdown renderer;
4. add the standard `mdocss-document` rendering wrapper;
5. preserve/expose MDOCSS semantic classes;
6. enumerate named stylesheets from `manifest.json`;
7. expose a style picker when multiple presentations are available;
8. hot-swap the active stylesheet without rewriting `root.md`;
9. scope document CSS to the MDOCSS rendering surface;
10. resolve bundled relative assets safely;
11. remember an optional user-local style preference without changing the archive default;
12. eventually support editing and atomic repacking while preserving unknown files.

If no named stylesheets are declared, the plugin should use `root.css` when present. If no document stylesheet exists, Markdown should render with Obsidian's normal presentation.

## Style selection versus document defaults

Choosing a style while reading is presentation state. The plugin should not change `defaultStylesheet` merely because the user selected another style.

Changing the author-defined default is a separate explicit editing action.

## Semantic classes

The plugin should follow `SEMANTICS.md` rather than inventing Obsidian-specific document roles. Application-specific wrapper classes may exist for implementation purposes, but portable styles should not depend on them for essential formatting.

## Status

The integration is experimental while the core specification stabilizes.

The core format does **not** depend on Obsidian. This plugin is one reference implementation among potentially many.
