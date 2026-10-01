# MDOCSS

**MDOCSS** is an open, ZIP-based document container that keeps semantic content and presentation separate while using ordinary, independently usable formats.

A `.mdocss` file contains Markdown as the canonical document content and may bundle CSS, metadata, and local assets:

```text
example.mdocss
├── root.md
├── root.css
├── manifest.json
└── assets/
    ├── image.png
    └── diagram.svg
```

The core design principle is simple: **the document must remain recoverable and useful even when no MDOCSS-specific software is available.** A conforming reader can extract `root.md` with an ordinary ZIP tool and read it as Markdown.

## Status

MDOCSS is an early open specification. Version 0.1 defines the container, required files, optional metadata, path handling, and baseline conformance behavior.

This repository includes:

- `SPEC.md` — normative MDOCSS 0.1 specification
- `schema/manifest.schema.json` — JSON Schema for `manifest.json`
- `src/cli.js` — reference CLI for pack/unpack/inspect/validate
- `examples/basic/` — example source document
- `integrations/obsidian/` — initial Obsidian reference integration scaffold
- `.github/workflows/test.yml` — basic CI

## Design goals

- Open and royalty-free
- Application-independent
- Human-readable canonical content
- Separation of content from presentation
- Portable local assets
- Graceful degradation when optional components are unsupported
- Easy implementation with existing ZIP, Markdown, CSS, and JSON tooling

## Quick start

Requires Node.js 20+.

```bash
npm install
node src/cli.js pack examples/basic example.mdocss
node src/cli.js validate example.mdocss
node src/cli.js inspect example.mdocss
node src/cli.js unpack example.mdocss extracted
```

## Minimal archive

Only one file is required:

```text
document.mdocss
└── root.md
```

`root.css`, `manifest.json`, and `assets/` are optional.

## Philosophy

MDOCSS does not invent a new markup language. Markdown remains Markdown. CSS remains CSS. JSON remains JSON. ZIP remains ZIP. MDOCSS only defines how those components are packaged together and how applications should interpret the package.

That means a document is not trapped in one application. An MDOCSS-aware editor can provide a rich experience, while an ordinary ZIP utility can still recover the source document.

## License

Reference code is MIT licensed. The specification is intended to be freely implementable without royalties or permission.

Created by Jason Seaux.
