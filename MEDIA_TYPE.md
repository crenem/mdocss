# Draft IANA Media-Type Registration

**Status:** preparation draft; not submitted  
**Candidate:** `application/vnd.mdocss+zip`

The exact MDOCSS media type is not currently registered with IANA. This document prepares the information needed for a future registration and MUST NOT be treated as evidence that registration has occurred.

The registration strategy is the **vendor tree**. RFC 6838 permits vendor-tree registrations for publicly available products and explicitly construes “vendor”/“producer” broadly enough to include non-commercial entities that are not recognized standards organizations. Vendor-tree requests are submitted directly to IANA and undergo Expert Review.

Official process references:

- IANA media-type application form: https://www.iana.org/form/media-types
- RFC 6838 registration procedures: https://www.rfc-editor.org/rfc/rfc6838
- IANA Structured Syntax Suffix registry: https://www.iana.org/assignments/media-type-structured-suffix

The `+zip` suffix is already registered in the IANA Structured Syntax Suffix registry. Its registered fragment behavior delegates to `application/zip` when generic ZIP fragment semantics exist; currently `application/zip` defines no generic fragment syntax.

The current IANA application form separates the tree prefix from the subtype text and instructs registrants to omit the selected prefix from the subtype text field. For this registration, select the `vnd.` prefix and enter `mdocss+zip` as the subtype value.

## IANA form draft

### Registrant

**Full name:** [complete before submission]  
**E-mail:** [complete before submission]

### Type Name

```text
application
```

### Subtype Name

Vendor-tree prefix selection:

```text
vnd.
```

Subtype text field:

```text
mdocss+zip
```

Result:

```text
application/vnd.mdocss+zip
```

### Required Parameters

N/A.

### Optional Parameters

N/A.

### Encoding Considerations

Binary.

MDOCSS uses ZIP as its underlying representation.

### Security Considerations

MDOCSS is a ZIP-based document container and inherits security concerns associated with processing ZIP archives, including path traversal, ambiguous or duplicate entries, symbolic links, decompression/resource-exhaustion attacks, malformed archive metadata, and unsupported archive features.

A conforming MDOCSS core document contains canonical Markdown in `root.md` and may contain JSON metadata, CSS stylesheets, and arbitrary local assets.

MDOCSS defines no executable scripting facility. The presence of script-like files or raw markup does not grant permission to execute code.

Implementations are expected to:

- validate archive member paths before extraction;
- reject or safely handle duplicate members, symbolic links, and path collisions;
- impose resource ceilings on member count, compressed/uncompressed sizes, compression ratio, and nested processing;
- strictly decode required/declared UTF-8 text members;
- sanitize dangerous raw HTML when the Markdown renderer permits HTML;
- isolate document CSS from host-application UI;
- prevent archive-relative resource resolution from escaping the package;
- avoid automatic network fetching of remote document resources unless explicitly permitted.

The MDOCSS core format does not provide confidentiality, authentication, digital signatures, or integrity protection. Those services, when required, must be provided by the transport, storage system, or another external security mechanism.

The core specification makes encrypted ZIP members nonconforming. It also restricts conforming packages to single-disk, non-ZIP64 archives whose regular file members use Store or Deflate compression.

See `SECURITY.md` in the published specification repository.

### Interoperability Considerations

An MDOCSS file is a conforming single-disk, non-ZIP64 ZIP archive containing exactly one root-level `root.md` as canonical semantic content. Core packages use only Store or Deflate compression for regular members and contain no encrypted members.

A minimal document has no required manifest or stylesheet.

Optional `manifest.json` metadata can declare multiple CSS presentations. Unknown safe members and manifest properties are designed for forward compatibility.

Markdown rendering may differ among implementations when no common `markdownProfile` is declared. The canonical Markdown source remains recoverable independently of renderer differences.

CSS and paged-media behavior can also vary among rendering engines. Presentation differences do not alter canonical Markdown semantics.

Readers encountering an unsupported future major MDOCSS version should avoid interpreting unknown semantics as understood while still offering safe access to `root.md` where possible.

### Published Specification

Current draft:

```text
https://github.com/crenem/mdocss/blob/main/SPEC.md
```

Before submission, replace or supplement this with a stable versioned specification URL/tag.

Repository:

```text
https://github.com/crenem/mdocss
```

### Application Usage

MDOCSS is intended for document authoring, reading, interchange, archiving, note-taking, publishing workflows, and applications that benefit from independently recoverable Markdown content with replaceable CSS presentation.

Reference implementations include a standalone browser viewer, a CLI, and an Obsidian reader.

### Fragment Identifier Considerations

MDOCSS 1.0 does not define additional media-type-level fragment identifier semantics.

The `+zip` structured syntax suffix follows the fragment-identifier considerations defined for that suffix. At present, `application/zip` does not define a generic fragment syntax.

Links and fragment identifiers inside rendered Markdown are document-level semantics and are not a media-type fragment specification.

### Restrictions on Usage

N/A.

MDOCSS does not require network retrieval to interpret its core package. Canonical Markdown, declared stylesheets, metadata, and required local resources are package members. Documents may contain ordinary hyperlinks, but a conforming reader does not need to dereference those links to identify or recover the media type.

### Provisional Registration

No.

Vendor-tree registrations are not provisional standards-tree registrations.

### Additional Information

**Deprecated aliases:** N/A.

**Magic number(s):** ZIP signatures may be present (for example, the local-file-header signature `PK\x03\x04`), but ZIP magic alone does not uniquely identify MDOCSS. MDOCSS identification requires package conformance checks, including a root-level `root.md`.

**File extension(s):**

```text
.mdocss
```

**Macintosh File Type Code(s):** N/A.

**Object Identifier(s):** N/A.

### Intended Usage

COMMON.

### Contact Person

**Contact name:** [complete before submission]  
**Contact email:** [complete before submission]

### Author / Change Controller

Proposed:

```text
MDOCSS project maintainers
https://github.com/crenem/mdocss
```

Confirm the final change-controller wording and contact details before submission.

## Registration path decision

The planned registration is:

```text
application/vnd.mdocss+zip
```

Tree: vendor  
Review policy: Expert Review  
Structured syntax suffix: `+zip`  
Provisional registration: No

This strategy is frozen for the 1.0 release candidate unless IANA Expert Review identifies a reason to change it.

## Pre-submission checklist

Before filing the IANA form:

1. publish a stable versioned 1.0 specification URL;
2. complete registrant and contact identity fields;
3. review security text against the final 1.0 specification;
4. finalize the named author/change controller and durable contact path;
5. optionally request pre-submission review through the media-types discussion channel described by RFC 6838;
6. submit through https://www.iana.org/form/media-types;
7. update `SPEC.md` only after actual registration status is known.

Tracking issue: https://github.com/crenem/mdocss/issues/3
