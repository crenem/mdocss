# MDOCSS 0.1 Specification

**Status:** Draft  
**Version:** 0.1.0  
**File extension:** `.mdocss`

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, and **MAY** are to be interpreted as normative requirements.

## 1. Purpose

MDOCSS is an open document-container format for packaging Markdown content, CSS presentation rules, metadata, and related assets into one portable file.

The canonical content of an MDOCSS document is Markdown. A conforming archive MUST remain intelligible when extracted with a generic ZIP utility.

## 2. Container

An MDOCSS file:

1. MUST be a valid ZIP archive.
2. MUST use the file extension `.mdocss`.
3. MUST contain `root.md` at the archive root.
4. MAY contain `root.css` at the archive root.
5. MAY contain `manifest.json` at the archive root.
6. MAY contain arbitrary additional files and directories, subject to the path and security requirements in this specification.

Readers MUST NOT require archive members to be stored in any particular order.

## 3. Required document

### 3.1 root.md

`/root.md` is REQUIRED.

It MUST:

- be a regular file;
- be encoded as UTF-8;
- contain Markdown text.

An implementation MUST treat `root.md` as the canonical semantic content of the document.

MDOCSS 0.1 does not mandate a single Markdown dialect. A manifest MAY declare a Markdown profile. If no profile is declared, readers SHOULD support a CommonMark-compatible baseline where practical.

## 4. Optional stylesheet

### 4.1 root.css

`/root.css` is OPTIONAL.

If present, it MUST be UTF-8 encoded CSS text.

A rendering implementation MAY apply `root.css` to the rendered representation of `root.md`. An implementation that cannot or chooses not to process CSS MUST still expose the Markdown content.

The absence or failure of `root.css` MUST NOT make the document unreadable.

CSS processing MUST be treated as untrusted input. Readers SHOULD prevent CSS from escaping the document rendering context or affecting the host application's chrome.

## 5. Optional manifest

### 5.1 manifest.json

`/manifest.json` is OPTIONAL.

If present, it MUST:

- be valid UTF-8 JSON;
- contain a top-level JSON object;
- conform to the MDOCSS manifest schema for the declared specification version.

Unknown manifest fields SHOULD be preserved by editors when rewriting an archive and MUST NOT cause a reader to reject an otherwise readable document unless they violate a normative security rule.

Recommended fields include:

- `specVersion`
- `title`
- `language`
- `markdownProfile`
- `entrypoint`
- `stylesheet`
- `created`
- `modified`
- `authors`

For MDOCSS 0.1, `entrypoint`, if supplied, MUST equal `root.md`. `stylesheet`, if supplied, MUST equal `root.css`.

## 6. Assets and relative paths

Supporting resources SHOULD be stored beneath `/assets/`, although other non-reserved directories MAY be used.

Relative references in `root.md` and `root.css` are resolved relative to the file containing the reference.

Examples:

```markdown
![Diagram](assets/diagram.svg)
```

```css
.hero {
  background-image: url("assets/background.png");
}
```

Readers MUST NOT resolve an archive-relative path outside the archive.

## 7. Reserved root names

The following archive-root names are reserved by MDOCSS 0.1:

- `root.md`
- `root.css`
- `manifest.json`
- `assets/`

Future versions MAY reserve additional names.

Readers SHOULD ignore unknown, non-dangerous archive members.

## 8. Path rules and security

Archive member paths:

- MUST use forward slashes (`/`) as separators;
- MUST be relative;
- MUST NOT begin with `/`;
- MUST NOT contain path traversal segments that escape the archive root;
- MUST NOT rely on symbolic links.

Readers MUST defend against ZIP-slip/path-traversal attacks when extracting archives.

Readers SHOULD impose reasonable limits on:

- total uncompressed size;
- per-file uncompressed size;
- archive member count;
- compression ratio;
- recursive or nested archive processing.

MDOCSS documents MUST be treated as untrusted data.

## 9. Scripts and active content

MDOCSS 0.1 defines no executable scripting facility.

Readers MUST NOT execute scripts merely because script-like files or markup are present in an archive.

If a Markdown renderer supports raw HTML, implementations SHOULD sanitize dangerous HTML and URLs according to the security model of the host application.

## 10. Media types

The proposed media type is:

```text
application/vnd.mdocss+zip
```

Until formally registered, implementations MAY use:

```text
application/zip
```

while identifying the format by extension or archive contents.

## 11. Conformance

### 11.1 Conforming document

A conforming MDOCSS 0.1 document MUST:

- be a valid ZIP archive;
- contain exactly one root-level `root.md`;
- satisfy the UTF-8 and path requirements of this specification.

### 11.2 Conforming reader

A conforming reader MUST:

- locate and expose `root.md`;
- function when `root.css` and `manifest.json` are absent;
- ignore unsupported optional files where safe;
- reject or safely handle dangerous paths.

### 11.3 Conforming editor

A conforming editor MUST meet reader requirements and SHOULD preserve unknown archive members and unknown manifest fields when saving, unless the user explicitly removes them.

## 12. Forward compatibility

Readers MUST NOT reject a document solely because it contains unknown files or unknown manifest properties.

If `manifest.json` declares a future major specification version that the reader does not support, the reader SHOULD warn the user but SHOULD still offer access to `root.md` when it can do so safely.

## 13. Example

```text
paper.mdocss
├── root.md
├── root.css
├── manifest.json
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
  "stylesheet": "root.css",
  "authors": [
    { "name": "Example Author" }
  ]
}
```

## 14. Design principle

A conforming MDOCSS document MUST degrade gracefully. Loss of MDOCSS-specific presentation support may reduce visual fidelity, but MUST NOT prevent recovery of the canonical Markdown content.
