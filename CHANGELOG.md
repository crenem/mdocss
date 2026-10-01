# Changelog

## 0.1.0-draft

- Defined ZIP-based MDOCSS container.
- Required `root.md` canonical content.
- Defined optional `root.css`, `manifest.json`, and asset handling.
- Added named, hot-swappable stylesheet profiles through `stylesheets` and `defaultStylesheet`.
- Defined runtime style selection as presentation state that does not modify `root.md`.
- Added conventional `styles/` directory for alternate presentations.
- Added the MDOCSS Core Semantic Class Profile in `SEMANTICS.md`.
- Added a scoped roadmap from the current draft through v1.0.
- Added stylesheet existence, ID, and default-reference validation to the CLI.
- Added CLI `styles` command.
- Added multi-style examples and tests.
- Added path traversal and active-content security requirements.
- Added manifest JSON Schema.
- Added reference Node.js CLI.
- Added a 20-case public conformance corpus covering valid documents, malformed manifests, stylesheet errors, malformed UTF-8, path attacks, and forward-compatible unknown content.
- Added round-trip preservation testing for unknown members and manifest fields.
- Added security guidance for ZIP extraction, decompression limits, CSS isolation, external resources, and strict UTF-8 handling.
- Hardened the reference validator for original ZIP member names, Windows-style paths, and strict UTF-8 decoding.
- Added CI workflow.
- Added browser reference renderer with local asset resolution, sanitized HTML, sandboxed CSS, runtime style switching, and print preview.
- Added a working Obsidian reader MVP with `.mdocss` extension registration, hot-swappable styles, local style preference, local asset resolution, and sandboxed rendering.
- Added CI builds/type checks for both the reference viewer and Obsidian integration.
- Added atomic CLI editing for `root.md` and `manifest.json`.
- Added CLI commands to add, rename/move, and remove bundled stylesheet declarations.
- Added tests proving unknown members/manifest fields survive edits and invalid edits do not replace the original archive.
- Added CI packaging and downloadable artifact generation for the Obsidian reader.
