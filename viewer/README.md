# MDOCSS Reference Viewer

The reference viewer is the browser implementation for the v0.4 roadmap milestone.

It demonstrates that a self-contained MDOCSS archive can be opened, rendered, restyled, and printed without extracting the document manually and without fetching document assets from the network.

## Features

- open a local `.mdocss` file with a file picker or drag-and-drop;
- read UTF-8 `root.md`;
- parse optional `manifest.json`;
- render Markdown;
- sanitize rendered HTML;
- preserve MDOCSS semantic classes;
- resolve bundled images, media, fonts, and CSS resources to browser Blob URLs;
- enumerate named stylesheets;
- hot-swap the active stylesheet without reparsing `root.md`;
- resolve local CSS `@import` rules recursively;
- block remote CSS resources;
- isolate document rendering in a sandboxed iframe;
- apply a restrictive Content Security Policy inside the rendered document;
- invoke browser print preview.

## Build

From the repository root:

```bash
npm install
npm run build:viewer
```

Then open:

```text
viewer/index.html
```

No web server is required for the generated IIFE bundle.

## Security model

The viewer does not execute document scripts.

Rendered HTML is sanitized before insertion. Document CSS is placed in an iframe rather than in the application's own DOM. The iframe does not receive script permission. The generated document CSP blocks ordinary network resources; bundled resources are exposed through local Blob URLs.

This reference renderer is a conformance aid, not a general-purpose browser sandbox. Host applications implementing MDOCSS should apply security controls appropriate to their runtime.

## Current Markdown behavior

The reference viewer uses Marked with GFM-compatible behavior for its demonstration renderer. MDOCSS itself still does not require one universal Markdown dialect in the 0.x draft.

A future renderer-profile test suite can tighten interoperability without redefining Markdown.
