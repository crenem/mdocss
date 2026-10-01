# MDOCSS

**MDOCSS** is an open, ZIP-based document container that keeps semantic content and presentation separate while using ordinary, independently usable formats.

A `.mdocss` file contains Markdown as canonical content and may bundle metadata, assets, and multiple hot-swappable CSS presentations:

```text
example.mdocss
├── root.md
├── root.css
├── manifest.json
├── styles/
│   ├── dark.css
│   └── manuscript.css
└── assets/
    ├── image.png
    └── diagram.svg
```

The core design principle is simple: **the document must remain recoverable and useful even when no MDOCSS-specific software is available.** A conforming reader can extract `root.md` with an ordinary ZIP tool and read it as Markdown.

## Hot-swappable presentation

The manifest can declare multiple named stylesheets:

```json
{
  "stylesheets": [
    { "id": "default", "label": "Default", "href": "root.css" },
    { "id": "dark", "label": "Dark", "href": "styles/dark.css" },
    { "id": "manuscript", "label": "Manuscript", "href": "styles/manuscript.css" }
  ],
  "defaultStylesheet": "default"
}
```

A style-aware reader can switch among them at runtime without rewriting `root.md`. The active style is presentation state; the document's semantic content does not change.

This design also allows prepackaged profile styles such as APA, MLA, Chicago-style manuscripts, business reports, dark reading, or large-print accessibility themes to operate on the same content.

## Semantic class profile

`SEMANTICS.md` defines a small, application-independent class vocabulary for roles plain Markdown cannot identify reliably, such as title-page fields, abstracts, references, notes, figures, tables, and appendices.

The class set is deliberately minimal. Ordinary headings, paragraphs, lists, block quotes, links, and tables continue to use normal Markdown/HTML semantics.

## Status

MDOCSS is an early open specification.

This repository includes:

- `SPEC.md` — normative container and reader/editor behavior
- `SEMANTICS.md` — Core Semantic Class Profile
- `ROADMAP.md` — staged path to a stable 1.0 release
- `ACCESSIBILITY.md` — accessibility guidance for readers and stylesheet authors
- `PRINT.md` — print and paged-media guidance
- `styles/` — reference APA 7, MLA 9, Chicago 18, professional, reading, dark, and large-print profiles
- `schema/manifest.schema.json` — JSON Schema for `manifest.json`
- `src/cli.js` — reference CLI for pack/unpack/inspect/validate/style listing
- `examples/basic/` — example source document with multiple styles
- `viewer/` — browser reference renderer with hot-swappable styles and print support
- `integrations/obsidian/` — working Obsidian reader MVP source and build configuration
- `conformance/` — public valid/invalid fixture corpus and executable harness
- `SECURITY.md` — implementation security guidance
- `.github/workflows/test.yml` — CI

## Design goals

- Open and royalty-free
- Application-independent
- Human-readable canonical content
- Separation of semantics from presentation
- Hot-swappable named presentations
- Small shared semantic vocabulary
- Portable local assets
- Graceful degradation
- Straightforward implementation using ZIP, Markdown, CSS, and JSON tooling

## Quick start

Requires Node.js 20+.

```bash
npm install
node src/cli.js pack examples/basic example.mdocss
node src/cli.js validate example.mdocss
node src/cli.js inspect example.mdocss
node src/cli.js styles example.mdocss
node src/cli.js unpack example.mdocss extracted
npm run conformance
npm run build:viewer
npm run build:obsidian
npm run build:style-demo

# Round-trip editing
node src/cli.js set-root example.mdocss revised.md
node src/cli.js set-manifest example.mdocss manifest.json
node src/cli.js add-style example.mdocss apa7.css --id apa7 --label "APA 7th Edition" --default
node src/cli.js rename-style example.mdocss apa7 academic --label "Academic"
node src/cli.js remove-style example.mdocss academic --delete-css
```

## Minimal archive

Only one file is required:

```text
document.mdocss
└── root.md
```

`root.css`, `manifest.json`, `styles/`, and `assets/` are optional.

## Philosophy

MDOCSS does not invent a new markup language. Markdown remains Markdown. CSS remains CSS. JSON remains JSON. ZIP remains ZIP. MDOCSS defines how those components are packaged together and how applications should interpret the package.

That means a document is not trapped in one application. An MDOCSS-aware editor can provide a rich experience, while an ordinary ZIP utility can still recover the source document.

## Scope discipline

The 1.0 core intentionally excludes scripting, macros, DRM, encryption, collaborative-editing protocols, a new Markdown dialect, proprietary font formats, cloud synchronization, and mandatory online registries.

See `ROADMAP.md` for the release plan.

## License

Reference code is MIT licensed. The specification is intended to be freely implementable without royalties or permission.

Created by Jason Seaux.
