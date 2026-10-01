# MDOCSS Security Guidance

MDOCSS documents are ZIP containers containing Markdown, CSS, JSON, and arbitrary local assets. Implementations MUST treat every document as untrusted input.

This document complements the normative requirements in `SPEC.md`. It does not add executable features to the format.

## Archive extraction

Implementations MUST prevent archive members from escaping the intended extraction or virtual-document root.

At minimum, reject or safely neutralize:

- ambiguous legacy encoding of non-ASCII ZIP member names;
- `..` path traversal;
- absolute slash-prefixed paths;
- backslash-separated archive paths;
- drive-letter paths such as `C:/...`;
- symbolic-link tricks;
- NUL-containing names;
- other platform-specific absolute-path forms.

Do not rely solely on a ZIP library's normalized filename. Some libraries sanitize dangerous member names while retaining an original-name field; validation should examine the original archive name where available.

## Resource exhaustion

Readers SHOULD impose implementation-defined ceilings before or during decompression.

Useful policy dimensions include:

- maximum archive-member count;
- maximum uncompressed bytes for one member;
- maximum total uncompressed bytes;
- maximum accepted compression ratio;
- maximum nested-archive depth;
- time or CPU budget for parsing and rendering;
- image and media decoding limits.

The MDOCSS specification intentionally does not mandate universal numeric limits because appropriate ceilings differ among desktop, mobile, server, and embedded readers.

A reader should fail safely and explain that a document exceeded resource limits rather than attempting unlimited decompression.

## UTF-8

`root.md`, `manifest.json`, `root.css`, and declared MDOCSS stylesheets are UTF-8 text.

Validation should use a strict decoder rather than silently replacing malformed byte sequences with the Unicode replacement character.

## CSS isolation

Document CSS is untrusted.

Readers SHOULD:

- scope CSS to the rendered MDOCSS surface;
- prevent selectors from modifying host-application chrome or unrelated documents;
- prevent archive-relative resources from escaping the package;
- avoid remote CSS, fonts, images, or imports unless explicitly allowed by the user or host;
- consider sanitizing or disallowing CSS features that are incompatible with the host security model.

Switching styles must not execute scripts.

## Markdown and HTML

MDOCSS defines no scripting facility.

If a Markdown engine supports raw HTML, readers SHOULD sanitize dangerous elements, attributes, URLs, and embedded active content according to the security model of the host application.

A document containing script-like files does not gain permission to execute them merely because they are inside the archive.

## External URLs

Ordinary Markdown links may point outside the archive, but readers should apply normal host policies before navigating or fetching external resources.

Automatic network access should not be required to recover or render the canonical document.

## Unknown members

Unknown archive members are permitted for forward compatibility.

Readers should preserve unknown members when safely possible, but MUST NOT execute, load, or grant privileges to an unknown file merely because it is present.

## Conformance corpus

The public corpus under `conformance/` includes representative malicious path and malformed-text cases.

It intentionally excludes actual ZIP bombs and other resource-exhaustion payloads. Implementations should test resource ceilings independently using controlled local fixtures appropriate to their deployment environment.


## ZIP interoperability profile

MDOCSS deliberately uses a narrower ZIP subset than the full ZIP feature set.

Conforming core packages must be single-disk archives, must not require ZIP64, must not contain encrypted members, and must use only Store (method 0) or Deflate (method 8) compression for regular members. Non-ASCII member names use UTF-8 with ZIP's language-encoding flag so path identity is not dependent on a legacy code page.

This reduces parser diversity and prevents an archive from being formally “ZIP” while depending on a compression or addressing feature that common document readers cannot process consistently.

Readers should identify these profile violations before interpreting package semantics where practical. A host may still offer explicit recovery tooling, but a package outside the profile is not conforming MDOCSS core.
