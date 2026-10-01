# Draft IANA Media-Type Registration

**Status:** preparation draft; not submitted  
**Candidate:** `application/vnd.mdocss+zip`

The exact MDOCSS media type is not currently registered with IANA. This document prepares the information needed for a future registration and MUST NOT be treated as evidence that registration has occurred.

The vendor tree is a plausible registration path because RFC 6838 permits vendor-tree registrations for publicly available products and explicitly construes “vendor”/“producer” broadly enough to include non-commercial entities that are not recognized standards organizations.

The `+zip` suffix is already registered in the IANA Structured Syntax Suffix registry.

## IANA form draft

### Registrant

**Full name:** [complete before submission]  
**E-mail:** [complete before submission]

### Type Name

```text
application
```

### Subtype Name

Vendor-tree prefix:

```text
vnd.
```

Subtype field:

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

MDOCSS is a ZIP-based document container and inherits security concerns associated with processing ZIP archives, including path traversal, ambiguous or duplicate entries, symbolic links, decompression/resource-exhaustion attacks, malformed archive metadata, and potentially encrypted entries.

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

The core specification does not define ZIP-level encryption and does not require readers to support encrypted entries.

See `SECURITY.md` in the published specification repository.

### Interoperability Considerations

An MDOCSS file is a conforming ZIP archive containing exactly one root-level `root.md` as canonical semantic content.

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

MDOCSS 1.0 is not expected to define additional media-type-level fragment identifier semantics.

The `+zip` structured syntax suffix follows the fragment-identifier considerations defined for that suffix. At present, `application/zip` does not define a generic fragment syntax.

Links and fragment identifiers inside rendered Markdown are document-level semantics and are not a media-type fragment specification.

### Restrictions on Usage

N/A.

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

## Pre-submission checklist

Before filing the IANA form:

1. freeze the 1.0 media-type spelling;
2. publish a stable versioned specification URL;
3. complete registrant and contact identity fields;
4. review security text against the final 1.0 specification;
5. confirm the change controller;
6. request community/media-types review if useful;
7. submit through the IANA media-type application form;
8. update `SPEC.md` only after actual registration status is known.

Tracking issue: https://github.com/crenem/mdocss/issues/3
