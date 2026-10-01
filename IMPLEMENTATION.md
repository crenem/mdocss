# MDOCSS Implementation Guide

This guide translates the normative requirements in `SPEC.md` into a practical reader/editor workflow. It is informative unless a requirement is repeated from the specification.

## Reader pipeline

A basic reader can be implemented in the following order.

### 1. Identify the package

Treat the file as a ZIP container.

Do not infer conformance from the `.mdocss` extension alone, and do not reject otherwise conforming package bytes solely because no filename or a different filename is available. A conforming document is identified by the structural and safety rules in `SPEC.md`.

For core interoperability, reject packages that require split/spanned ZIP volumes, ZIP64 features, encryption, or compression methods other than Store (0) and Deflate (8). This narrow ZIP profile is intentional: an MDOCSS reader should not need a specialist archive stack merely to recover a document.

### 2. Inspect archive member names before extraction

Validate original ZIP member names when the ZIP library exposes them.

Reject or safely handle:

- non-ASCII ZIP member names that are not marked with ZIP's UTF-8 language-encoding flag;
- ASCII control characters in member names;
- `.`, `..`, and empty interior path segments;
- absolute paths;
- `..` traversal;
- backslash-separated paths;
- drive-letter paths;
- NUL-containing names;
- symbolic-link or platform-specific escape mechanisms.

When writing non-ASCII member names, use UTF-8 and set the ZIP UTF-8 flag. Writers should prefer NFC-normalized path text while readers should still treat the exact decoded path as authoritative.

Apply resource ceilings before or during decompression. See `SECURITY.md`.

### 3. Locate canonical content

Locate exactly one root-level `root.md`.

Decode it as strict UTF-8. Failure to decode means the package is not conforming.

A reader that chooses to offer recovery from a malformed package should clearly distinguish recovery from conformance.

### 4. Parse optional metadata

If `manifest.json` exists:

1. decode it as strict UTF-8;
2. parse JSON;
3. require a top-level object;
4. validate known fields against the schema for the supported specification version;
5. preserve unknown fields in an editor.

If no manifest exists, the reader can still render `root.md` and optionally `root.css`.

### 5. Negotiate the format version

Treat reading compatibility and authoring conformance as separate operations.

For reading:

1. no manifest means the minimum container contract;
2. an unversioned manifest is legacy 0.1 draft behavior;
3. 0.1.x uses the 0.1 contract;
4. 1.x uses the 1.0 reader baseline and processes understood same-major fields forward compatibly;
5. an unsupported major enters recovery mode rather than being interpreted as understood.

For exact authoring validation, require the requested target contract. In particular, a package authored to 1.0 may omit the manifest entirely, but a present manifest must declare a 1.0.x `specVersion`.

See `VERSIONING.md` and the shared version cases in `conformance/cases.json`.

### 6. Determine the Markdown profile

If `markdownProfile` is declared and supported, use it.

Otherwise use the application's documented baseline. The current reference renderer uses GFM-compatible rendering, while the MDOCSS 0.x core intentionally does not require one universal Markdown dialect.

### 7. Render semantic content

Render `root.md` to the application's document model.

Where applicable:

- preserve safe standards-based HTML from the Markdown source;
- preserve MDOCSS Core Semantic Profile classes;
- wrap the rendered result in `.mdocss-document`.

Sanitize dangerous active content according to the host environment.

### 8. Resolve local resources

Resolve relative references from the file containing the reference.

Examples:

- a Markdown image in `root.md` resolves from the archive root;
- `url("../assets/image.png")` in `styles/print.css` resolves from `styles/`;
- local CSS `@import` resolves from the importing stylesheet.

Never allow resolution outside the archive.

A self-contained document must not require automatic network access.

### 9. Enumerate stylesheets

If the manifest contains `stylesheets`, validate each declared target and expose supported entries to the user.

If there are no declared entries but `root.css` exists, treat `root.css` as the conventional fallback style.

Choose the initial style according to the preference order in `SPEC.md`.

### 10. Hot-swap presentation

Changing the active stylesheet should replace presentation only.

Do not rewrite or reparse `root.md` solely because the user selected a different style.

A reader-local style preference may be persisted outside the package. It must not silently change the author-defined `defaultStylesheet`.

### 11. Print or export

Use the selected stylesheet's print rules when supported.

See `PRINT.md` for page-layout limitations and portability guidance.

## Editor pipeline

A conforming editor should follow a preservation-first model.

### 1. Load the complete package

Keep unknown safe archive members, not just files the editor understands.

Keep unknown manifest fields.

### 2. Modify only the requested component

Examples:

- editing prose replaces `root.md`;
- editing metadata replaces known manifest fields while preserving unknown ones;
- adding a style adds a CSS member and one manifest entry;
- a temporary style choice does not edit the manifest.

### 3. Validate the proposed package

Before replacing the original file:

- run structural validation;
- run path validation;
- validate strict UTF-8 text members;
- validate the manifest;
- validate stylesheet declarations and defaults.

### 4. Save atomically

Write a complete replacement package to a temporary file in the destination directory.

Only after the new package is complete and valid should the editor replace the original.

If writing fails, the original package should remain intact.

The reference CLI implements this behavior for `set-root`, `set-manifest`, `add-style`, `rename-style`, and `remove-style`.

## Minimum reader checklist

A small conforming reader needs only to:

1. safely open ZIP;
2. locate and strictly decode `root.md`;
3. expose its content;
4. safely ignore unsupported optional members;
5. reject or safely handle dangerous archive paths.

CSS, manifests, semantic classes, style pickers, and rich asset rendering are progressive capabilities rather than prerequisites for recovering canonical content.

## Interoperability testing

Implementations should test against:

- the public corpus under `conformance/`, including target-specific generated version cases;
- `examples/basic/`;
- `examples/semantic-paper/`;
- the generated multi-profile style demo.

A reader claiming style-aware support should verify that switching among styles leaves canonical Markdown bytes unchanged.

The repository maintains `INTEROPERABILITY.md` as the release-readiness record for multi-implementation findings.
