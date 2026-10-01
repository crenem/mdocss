# MDOCSS 0.1 Specification

**Status:** Draft  
**Version:** 0.1.0  
**File extension:** `.mdocss`

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, and **MAY** in this document are to be interpreted as described in BCP 14 (RFC 2119 and RFC 8174) when, and only when, they appear in all capitals.

## 1. Purpose

MDOCSS is an open document-container format for packaging Markdown content, CSS presentation rules, metadata, and related assets into one portable file.

The canonical semantic content is Markdown. A conforming archive MUST remain intelligible when extracted with an ordinary ZIP utility.

MDOCSS deliberately separates content from presentation. The same `root.md` MAY be rendered through multiple named stylesheets without changing the Markdown content.

## 2. Container

An MDOCSS document:

1. MUST be a valid ZIP archive.
2. MUST use the file extension `.mdocss`.
3. MUST contain `root.md` at the archive root.
4. MAY contain `root.css` as the conventional fallback stylesheet.
5. MAY contain `manifest.json`.
6. MAY contain additional CSS files, conventionally beneath `styles/`.
7. MAY contain local assets, conventionally beneath `assets/`.
8. MAY contain other files subject to the path and security requirements below.

Readers MUST NOT depend on ZIP member ordering.

## 3. Canonical content

### 3.1 root.md

`/root.md` is REQUIRED.

It MUST:

- be a regular file;
- be UTF-8 text;
- contain Markdown.

Readers MUST treat `root.md` as canonical semantic content.

MDOCSS 0.1 does not mandate one Markdown dialect. A manifest MAY declare `markdownProfile`. If none is declared, readers SHOULD provide a CommonMark-compatible baseline where practical.

## 4. Stylesheets

### 4.1 root.css

`/root.css` is OPTIONAL.

If present, it MUST be UTF-8 CSS text.

`root.css` is the conventional fallback for simple documents and for readers that do not implement named stylesheet selection.

Failure to load CSS MUST NOT prevent access to `root.md`.

### 4.2 Named stylesheets

A document MAY declare multiple selectable stylesheets in `manifest.json`:

```json
{
  "stylesheets": [
    {
      "id": "default",
      "label": "Default",
      "href": "root.css"
    },
    {
      "id": "dark",
      "label": "Dark",
      "href": "styles/dark.css"
    }
  ],
  "defaultStylesheet": "default"
}
```

Each stylesheet entry MUST contain:

- `id`: a stable identifier unique within the document;
- `label`: a human-readable name;
- `href`: an archive-relative path to a CSS file.

A stylesheet entry MAY contain:

- `description`: human-readable explanatory text;
- `profile`: an implementation-independent style-profile identifier, such as a future standardized academic or organizational style profile.

Every declared `href` MUST resolve to a regular CSS file inside the archive.

If `defaultStylesheet` is present, it MUST equal the `id` of one declared stylesheet.

### 4.3 Runtime style selection

A style-aware reader SHOULD expose named stylesheets when more than one is available.

The initial active stylesheet SHOULD be chosen in this order:

1. reader-local user preference for that document, if supported;
2. `defaultStylesheet`;
3. a declared stylesheet whose `href` is `root.css`;
4. the first declared stylesheet;
5. undeclared `root.css`, if present;
6. no document stylesheet.

Switching the active stylesheet is presentation state. It MUST NOT require modification of `root.md`.

An editor MUST NOT rewrite `defaultStylesheet` merely because the user temporarily selected a different style. Changing the author-defined default is a separate explicit edit.

Readers SHOULD be able to hot-swap the active stylesheet without reparsing or rewriting canonical Markdown solely for style selection.

### 4.4 CSS isolation

CSS MUST be treated as untrusted document data.

Readers SHOULD scope document CSS so it cannot style the host application's chrome or unrelated documents.

Relative CSS resources are resolved inside the archive. Readers MUST NOT resolve archive-relative references outside the archive and SHOULD NOT fetch remote CSS, fonts, images, or other network resources without explicit user or host-application permission.

## 5. Semantic class profile

MDOCSS defines a companion Core Semantic Class Profile in `SEMANTICS.md`.

The profile provides stable CSS hooks for document roles that ordinary Markdown does not identify reliably, including title-page fields, abstracts, references, figures, tables, notes, and appendices.

Semantic classes are OPTIONAL for core document conformance. A document without them remains valid MDOCSS.

Stylesheets claiming compatibility with the MDOCSS Core Semantic Class Profile SHOULD target those classes rather than application-specific DOM classes for essential formatting.

Ordinary Markdown structures SHOULD continue to use native rendered elements such as `h1`–`h6`, `p`, `blockquote`, lists, links, and tables instead of redundant MDOCSS classes.

## 6. Manifest

`/manifest.json` is OPTIONAL.

If present, it MUST:

- be UTF-8;
- be valid JSON;
- contain a top-level object;
- conform to the schema for the declared specification version.

Recognized fields include:

- `specVersion`
- `title`
- `language`
- `markdownProfile`
- `entrypoint`
- `stylesheets`
- `defaultStylesheet`
- `created`
- `modified`
- `authors`

For MDOCSS 0.1, `entrypoint`, if supplied, MUST equal `root.md`.

During the 0.x draft period, `specVersion` is OPTIONAL. Authors and tools that emit a manifest SHOULD include it. The version-compatibility model is defined in `VERSIONING.md`.

The frozen MDOCSS 1.0 rule is that a package MAY still omit `manifest.json`, but when a manifest is present in a 1.0-authored package it MUST declare a 1.0.x `specVersion`. Same-major newer-minor 1.x documents are read forward-compatibly according to `VERSIONING.md`; that reading rule does not make a 1.1 document conforming output for an exact 1.0 authoring target.

Unknown manifest fields SHOULD be preserved by editors and MUST NOT cause rejection unless they violate a security or conformance requirement.

## 7. Assets and path resolution

Supporting resources SHOULD be stored beneath `/assets/`.

Alternate presentation styles SHOULD be stored beneath `/styles/`.

Relative references in `root.md` are resolved relative to `root.md`. Relative references in a CSS file are resolved relative to that CSS file.

Example Markdown:

```markdown
![Diagram](assets/diagram.svg)
```

Example CSS in `styles/print.css`:

```css
.hero {
  background-image: url("../assets/background.png");
}
```

Readers MUST NOT resolve archive-relative paths outside the archive.

## 8. Reserved root names

MDOCSS 0.1 reserves:

- `root.md`
- `root.css`
- `manifest.json`
- `assets/`
- `styles/`

Future versions MAY reserve additional names.

Readers SHOULD ignore unknown, non-dangerous archive members.

## 9. Path and archive security

Archive member paths:

- MUST use forward slashes (`/`) as separators;
- MUST be relative;
- MUST NOT begin with `/`;
- MUST NOT escape the archive root through `..` traversal;
- MUST NOT be symbolic-link entries.

A conforming archive MUST NOT contain duplicate member names. Readers MUST reject or safely disambiguate ambiguous duplicate entries before interpreting canonical files.

The MDOCSS 0.1 core defines no ZIP-level encryption. A conforming core document MUST NOT require encrypted ZIP entries to access `root.md`, `manifest.json`, declared stylesheets, or other content necessary to interpret the package. Readers MAY reject encrypted archives or encrypted members.

Writers SHOULD avoid archive paths that differ only by case when those files could collide on case-insensitive filesystems. Extracting readers SHOULD defend against platform-normalized path collisions.

Readers MUST defend against ZIP-slip/path-traversal attacks.

Readers SHOULD impose reasonable limits on:

- total uncompressed size;
- per-file uncompressed size;
- member count;
- compression ratio;
- recursive/nested archive processing.

MDOCSS documents MUST be treated as untrusted data.

## 10. Active content

MDOCSS 0.1 defines no executable scripting facility.

Readers MUST NOT execute scripts merely because script-like files or markup are present.

If raw HTML is supported in Markdown, readers SHOULD sanitize dangerous HTML and URLs according to the host application's security model.

## 11. Media type

MDOCSS uses ZIP as its underlying representation. The registered `+zip` structured syntax suffix is therefore appropriate for a future MDOCSS-specific media-type registration.

The candidate media type is:

```text
application/vnd.mdocss+zip
```

This exact MDOCSS subtype is **not registered with IANA in the 0.1 draft** and MUST NOT be represented as registered.

Until an MDOCSS-specific media type is formally registered, implementations SHOULD use:

```text
application/zip
```

when a registered media type is required, while identifying MDOCSS through the `.mdocss` extension and package conformance checks.

## 12. Conformance

### 12.1 Conforming document

A conforming MDOCSS 0.1 document MUST:

- be a valid ZIP archive;
- contain exactly one root-level `root.md`;
- satisfy the UTF-8 and path requirements;
- use unique IDs for declared stylesheets;
- ensure every declared stylesheet resolves to a regular CSS file within the archive;
- ensure `defaultStylesheet`, when present, names a declared stylesheet.

### 12.2 Conforming reader

A conforming reader MUST:

- locate and expose `root.md`;
- function when CSS and `manifest.json` are absent;
- ignore unsupported optional files where safe;
- reject or safely handle dangerous paths.

A style-aware reader SHOULD enumerate declared styles and support runtime style switching without modifying `root.md`.

### 12.3 Conforming editor

A conforming editor MUST meet reader requirements.

It SHOULD preserve:

- unknown archive members;
- unknown manifest fields;
- recognized and unknown MDOCSS semantic classes that it can safely round-trip.

A style-aware editor SHOULD distinguish temporary active-style selection from an explicit edit to `defaultStylesheet`.

## 13. Forward compatibility

Readers MUST NOT reject a document solely because it contains unknown files or unknown manifest properties.

Version negotiation follows `VERSIONING.md`.

A reader that supports the same major version SHOULD process fields it understands and preserve or ignore unknown safe additions.

If `manifest.json` declares a future unsupported major specification version, a reader SHOULD warn the user, SHOULD avoid pretending to understand unknown package semantics, and SHOULD still offer safe access to `root.md` when archive and text safety checks permit.

## 14. Example

```text
paper.mdocss
├── root.md
├── root.css
├── manifest.json
├── styles/
│   ├── dark.css
│   └── manuscript.css
└── assets/
    └── chart.svg
```

Example manifest:

```json
{
  "specVersion": "0.1.0",
  "title": "Example MDOCSS Document",
  "language": "en",
  "markdownProfile": "CommonMark",
  "entrypoint": "root.md",
  "stylesheets": [
    {
      "id": "default",
      "label": "Default",
      "href": "root.css"
    },
    {
      "id": "dark",
      "label": "Dark",
      "href": "styles/dark.css"
    },
    {
      "id": "manuscript",
      "label": "Manuscript",
      "href": "styles/manuscript.css"
    }
  ],
  "defaultStylesheet": "default",
  "authors": [
    { "name": "Example Author" }
  ]
}
```

## 15. Design principle

MDOCSS MUST degrade gracefully.

Loss of MDOCSS-specific presentation support may reduce visual fidelity, but MUST NOT prevent recovery of canonical Markdown.

Presentation MUST remain separable from semantic content: changing a stylesheet MUST NOT require changing `root.md`.


## 16. Implementability and licensing

The MDOCSS specification and reference materials in this repository are published under the repository's MIT License.

Implementers do not need permission from the MDOCSS project maintainers to create compatible readers, writers, validators, editors, converters, stylesheet libraries, or other implementations of the documented format.

Conformance does not require use of the reference implementation.

## 17. References

- RFC 2119, *Key words for use in RFCs to Indicate Requirement Levels*: https://www.rfc-editor.org/rfc/rfc2119
- RFC 8174, *Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words*: https://www.rfc-editor.org/rfc/rfc8174
- RFC 6838, *Media Type Specifications and Registration Procedures*: https://www.rfc-editor.org/rfc/rfc6838
- RFC 6839, *Additional Media Type Structured Syntax Suffixes*: https://www.rfc-editor.org/rfc/rfc6839
- IANA Structured Syntax Suffix Registry: https://www.iana.org/assignments/media-type-structured-suffix/
