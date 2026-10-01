# MDOCSS Runtime Smoke-Test Plan

This plan closes the manual runtime portion of the v0.4 browser-viewer and v0.5 Obsidian-reader roadmap gates.

Related tracking issue: https://github.com/crenem/mdocss/issues/2

## Test artifacts

Use the latest successful CI artifact from the `spec-v0.1` branch:

- `mdocss-runtime-smoke-<commit>`

Its `mdocss-smoke-kit.zip` contains the browser viewer, Obsidian plugin, style demo, basic and semantic example packages, local-asset and remote-resource test packages, representative hostile fixtures, this checklist, and a SHA-256 baseline for the style demo's canonical `root.md`.

The CI artifact also exposes the viewer ZIP, Obsidian ZIP, and style-demo package separately for convenience.

Record results in `SMOKE_RESULTS_TEMPLATE.md`. The kit's `SMOKE-METADATA.json` records the CI commit when available.

At minimum record:

- operating system;
- browser and version;
- Obsidian version;
- MDOCSS branch commit tested.

## Browser reference viewer

### Open and render

1. Extract `mdocss-reference-viewer.zip`.
2. Open `index.html`.
3. Open `documents/mdocss-style-demo.mdocss` from the smoke kit.

Expected:

- the document renders without a web server;
- the title and semantic sections are visible;
- no document script executes;
- the style control lists all bundled profiles.

### Hot-swap styles

Switch among:

- APA 7 Student Paper;
- MLA 9 Research Paper;
- Chicago 18 Manuscript;
- Business Report;
- Clean Reading;
- Dark Reading;
- Accessible Large Print.

Expected:

- presentation changes immediately;
- document text does not change;
- title-page/reference/figure/table/appendix roles remain present;
- no reload or package rewrite is required.

### Canonical-content invariance

Before and after style switching, extract the package with the reference CLI and compare the SHA-256 digest of `root.md`.

Expected: identical digest.

### Print preview

Select at least:

- APA 7 Student Paper;
- Dark Reading;
- Accessible Large Print.

Invoke **Print**.

Expected:

- print preview opens;
- print-oriented profiles use white background/black text;
- dark reading falls back to print-safe colors;
- content is not clipped by the viewer shell.

### Network isolation

Open `documents/remote-resource.mdocss` and, where practical, watch the browser's network panel.

Expected:

- document resources are not automatically fetched from remote origins;
- visible document content remains available.

## Obsidian reader

### Install

1. Extract `mdocss-obsidian-0.1.0.zip`.
2. Copy `main.js`, `manifest.json`, and `styles.css` to:
   `<Vault>/.obsidian/plugins/mdocss/`
3. Reload Obsidian.
4. Enable **MDOCSS** under Community Plugins.

### File association

Copy `documents/mdocss-style-demo.mdocss` into the vault and open it.

Expected:

- Obsidian opens the file through the MDOCSS view rather than as opaque binary data;
- the package is not permanently extracted into the vault;
- the title and rendered content appear.

### Style switching

Switch among several profiles.

Expected:

- CSS changes without altering `root.md`;
- the selected style is remembered locally for that vault path;
- `defaultStylesheet` inside the archive does not change.

### Rename preference

Choose a non-default style, rename the `.mdocss` file in Obsidian, close it, and reopen it.

Expected: the reader-local style preference follows the renamed file.

### Print

Use the plugin's **Print** button.

Expected: Electron/browser print preview opens with the active stylesheet's print rules.

## Safety cases

Attempt to open representative invalid fixtures from the smoke kit's `hostile/` directory:

- `invalid-path-traversal.mdocss`
- `invalid-absolute-path.mdocss`
- `invalid-backslash-path.mdocss`
- `invalid-root-utf8.mdocss`
- `invalid-manifest-json.mdocss`

Expected:

- the host remains responsive;
- no file is written outside the intended environment;
- the document is rejected or safely fails;
- an understandable error is shown where practical.

## Cross-render comparison

Render `documents/mdocss-style-demo.mdocss` with the same profile in both the browser viewer and Obsidian.

Compare:

- semantic order;
- text content;
- heading hierarchy;
- title-page treatment;
- reference hanging indents;
- figure/table roles;
- print preview.

Pixel-identical output is not required. Semantic structure and stylesheet intent should agree.

## Passing the gate

The v0.4/v0.5 manual gate passes when:

1. browser and Obsidian runtime tests complete without data loss or unsafe behavior;
2. the same package and style produce materially consistent semantic rendering;
3. style switching leaves canonical Markdown unchanged;
4. any differences are either fixed or documented as acceptable host-renderer variation.

Record results as a comment on GitHub issue #2 and then update `ROADMAP.md`.
