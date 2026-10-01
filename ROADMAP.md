# Roadmap to MDOCSS 1.0

This roadmap keeps the project intentionally narrow: a portable Markdown document container with separable, hot-swappable CSS presentation, open metadata, assets, and predictable interoperability.

Milestones are release gates rather than branch names. The current draft PR already implements much of the v0.1 and v0.2 scope; features are not considered complete until their exit conditions and conformance tests are satisfied.

## v0.1 — Container foundation

**Goal:** establish the smallest viable open format.

- ZIP-compatible `.mdocss` container
- required UTF-8 `root.md`
- optional `manifest.json`
- optional `root.css`
- archive-relative assets
- path traversal and active-content security rules
- reference CLI: pack, unpack, inspect, validate
- baseline JSON Schema
- CI and basic conformance test
- initial Obsidian integration scaffold

**Exit condition:** a third party can implement a basic reader from `SPEC.md` without reading the reference code.

## v0.2 — Stylesheet profiles and semantic contract

**Goal:** make presentation genuinely replaceable.

- named stylesheet entries in `manifest.json`
- `defaultStylesheet`
- conventional `styles/` directory
- runtime/hot-swappable style selection
- active style treated as reader state, not a content mutation
- Core Semantic Class Profile
- CLI stylesheet enumeration and validation
- examples with multiple presentations

**Exit condition:** one `root.md` can be rendered through at least three bundled styles without changing canonical content.

## v0.3 — Conformance corpus

**Draft status:** implemented; the committed 20-case corpus currently passes the reference CLI in CI.

**Goal:** make independent implementations predictable.

- valid minimal fixtures
- valid multi-style fixtures
- invalid manifests
- duplicate stylesheet IDs
- missing stylesheet targets
- malformed UTF-8 fixtures
- ZIP-slip/path traversal fixtures
- oversized/decompression-abuse guidance
- unknown-file and unknown-manifest-field preservation tests
- documented expected behavior for each fixture

**Exit condition:** reference CLI passes the complete public conformance corpus. **Met in the current draft.**

## v0.4 — Reference renderer

**Draft status:** browser reference implementation is present and builds in CI. Final exit verification still requires a manual cross-render smoke test against an editor integration.

**Goal:** prove interoperable rendering outside the CLI.

- small browser/reference viewer
- Markdown rendering
- scoped CSS application
- runtime style picker
- archive asset resolution
- safe URL handling
- no network dependency for a self-contained document
- print preview

**Exit condition:** the same MDOCSS fixture renders consistently in the reference viewer and one editor integration.

## v0.5 — Obsidian reader MVP

**Draft status:** reader MVP is implemented and type-checks/builds against the current Obsidian API in CI. Manual in-app smoke testing remains before this gate is marked complete.

**Goal:** make MDOCSS useful in an existing Markdown ecosystem.

- open `.mdocss` directly
- render `root.md`
- resolve local assets
- enumerate styles
- hot-swap styles without rewriting the archive
- remember optional user-local style preference
- CSS isolation from Obsidian chrome

**Exit condition:** a user can read and restyle a portable MDOCSS document in Obsidian without extracting it manually.

## v0.6 — Round-trip editing

**Draft status:** reference CLI editing path is implemented and covered by preservation/atomicity tests. Rich in-app editing remains future UX work, but the release-gate behaviors are present in reference tooling.

**Goal:** make MDOCSS a working document, not merely a publication bundle.

- edit `root.md`
- explicit editing of manifest metadata
- add/remove/rename bundled styles
- preserve unknown archive members
- preserve unknown manifest fields
- atomic repacking/saving
- recovery behavior for interrupted writes
- tests proving no unrelated content is lost during save

**Exit condition:** open → edit → save → reopen preserves both known and unknown package content. **Met in the current reference CLI tests.**

## v0.7 — Standard style library

**Goal:** demonstrate the value of semantic/presentation separation.

Candidate reference styles:

- APA 7
- MLA 9
- Chicago-style manuscript
- business report
- clean reading
- dark reading
- accessible large print

Style-profile identifiers SHOULD be stable and implementation-neutral. Bundled CSS remains authoritative when present.

Reference academic styles are implementation aids, not claims of endorsement by the organizations associated with those style guides.

**Exit condition:** standard fixtures can switch among academic and general-purpose profiles without changing semantic content.

## v0.8 — Accessibility and print interoperability

**Goal:** ensure style flexibility does not sacrifice usability.

- accessibility guidance for stylesheet authors
- keyboard-accessible style switching
- high-contrast considerations
- reduced-motion expectations
- print CSS guidance
- predictable page-break behavior
- image alternative-text guidance using normal Markdown semantics
- graceful fallback when fonts or advanced CSS features are unavailable

**Exit condition:** accessibility and print requirements are documented and represented in test/example styles.

## v0.9 — Release candidate

**Goal:** freeze the 1.0 contract and search for interoperability failures.

- normative-language audit
- security review
- schema/spec consistency audit
- version negotiation rules
- MIME-type strategy finalized
- semantic profile reviewed for unnecessary classes
- public implementation guide
- migration notes from all 0.x drafts
- at least two independently functioning reader implementations or code paths tested against the same corpus
- release-candidate feedback period

**Exit condition:** no known breaking changes required for ordinary 0.9 documents to become 1.0 documents.

# v1.0 — Stable MDOCSS Core

MDOCSS 1.0 should ship only when all of the following are true:

1. The container specification is stable and versioned.
2. `root.md` remains independently recoverable with ordinary ZIP tooling.
3. Multiple named CSS presentations are standardized and hot-swappable.
4. The Core Semantic Class Profile is stable.
5. The manifest has a published JSON Schema.
6. A public conformance corpus exists.
7. The reference CLI passes the corpus.
8. At least one rich reader/editor integration exists.
9. Round-trip preservation behavior is tested.
10. Security guidance covers archive extraction, CSS isolation, raw HTML, URLs, and decompression abuse.
11. Backward/forward compatibility behavior is documented.
12. The specification and reference implementation remain royalty-free and application-independent.

## Explicit non-goals before 1.0

To prevent scope drift, the following are not part of the MDOCSS 1.0 core:

- executable scripting
- macros
- DRM
- encryption
- collaborative editing protocols
- a new Markdown dialect
- a proprietary font format
- embedded application logic
- cloud synchronization
- a mandatory online style registry
- replacement of PDF, DOCX, ODT, HTML, OpenType, or other established formats

These may be explored later as separate specifications, extensions, or entirely separate projects without changing the MDOCSS core.
