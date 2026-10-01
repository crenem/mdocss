# MDOCSS Pre-1.0 Audit

**Status:** living release-readiness record  
**Target:** v0.9 release candidate, then v1.0

This document tracks issues that should be settled before the core format is declared stable.

## Normative language

Current status: **first-pass audit complete; final RC review pending**

- `SPEC.md` uses MUST/SHOULD/MAY terminology.
- `SPEC.md` now explicitly references BCP 14 / RFC 2119 and RFC 8174.
- Normative rules remain in `SPEC.md`; implementation guidance is separated into companion documents.

## Schema/spec consistency

Current status: **strong, still under audit**

- manifest examples validate through the reference CLI;
- the conformance corpus exercises schema failures and cross-field stylesheet rules;
- stylesheet IDs, targets, defaults, UTF-8, and entrypoint rules are checked in reference tooling;
- JSON Schema alone cannot express every package-level relationship, so package validation remains necessary.

Remaining work:

- explicit schema/example/package-reference consistency tests now run in CI;
- the 1.0 decision is now frozen: a present `manifest.json` MUST contain `specVersion`;
- a candidate 1.0 manifest schema is published and must receive final RC review before losing its `-draft` status (issue #4);
- the reference CLI now performs explicit version negotiation, distinguishes unsupported major versions from invalid packages, and provides strict `--target 1.0` authoring validation;
- exact 1.0 authoring and forward-compatible 1.x reader schemas are now separate artifacts, avoiding ambiguity between conformance and compatibility;
- both reference readers accept same-major 1.x evolution while retaining recovery mode for unsupported higher majors.

## Security

Current status: **documented and tested, no external security review**

Covered:

- ZIP traversal and absolute-path attacks;
- duplicate archive member names and symbolic-link members;
- strict UTF-8;
- active-content prohibition;
- CSS isolation guidance;
- local-resource resolution;
- network-resource restrictions;
- decompression/resource-limit guidance;
- preservation of unknown content without executing it.

Remaining work:

- manual hostile-document smoke testing in the browser viewer and Obsidian host;
- independent review before a stable 1.0 release if feasible.

## Media type

Current status: **registration path frozen; submission prerequisites pending**

The `+zip` structured syntax suffix is registered for ZIP-based media types.

The exact subtype `application/vnd.mdocss+zip` is **not currently registered with IANA**.

Until registration is completed, MDOCSS tools should use `application/zip` as the interoperable fallback when a registered media type is required. Documentation may describe `application/vnd.mdocss+zip` as the candidate registration, but MUST NOT represent it as already registered.

Tracked in issue #3.

Before 1.0:

- publish a stable versioned 1.0 specification URL;
- complete registrant/contact and durable change-controller details;
- submit `application/vnd.mdocss+zip` through the IANA vendor-tree application path;
- update `SPEC.md` only after registration status is known.

## Semantic profile

Current status: **small and intentionally conservative**

The profile avoids redundant classes for native headings, paragraphs, lists, links, and normal tables.

Every authored core role is now exercised by the generated style-demo source, and CI checks that coverage. The renderer-generated `mdocss-document` shell is checked in both reference readers. Continue to remove unnecessary roles rather than expanding the vocabulary speculatively.

## Rendering interoperability

Current status: **multiple implementation paths present; runtime and third-party verification pending**

Implemented:

- standalone browser reference viewer;
- Obsidian custom `.mdocss` reader.

Both build in CI and share the same format contract. CI now packages both the browser viewer and the Obsidian reader for manual testing. `SMOKE_TEST.md` defines the cross-render procedure; completion is tracked in issue #2.

The repository now also contains a standard-library Python validator/recovery reader written from the specification rather than ported from the Node implementation. CI runs both implementations against the same public corpus. This provides implementation-language independence, but not independent-party review. A genuinely third-party implementation or external code review would still provide stronger evidence and remains tracked with the RC feedback period in issue #5.

## Round-trip editing

Current status: **reference gate met**

The CLI performs atomic validation-before-replace editing and tests preservation of unknown files and manifest properties.

Rich in-application editing remains product work rather than a blocker to defining the underlying preservation contract.

## Reference styles

Current status: **implemented**

The repository contains academic, professional, reading, dark, and large-print profiles.

Academic styles are reference presentation implementations, not validators of citation content and not endorsements by the organizations that publish the underlying style manuals.

## Accessibility and print

Current status: **documented and represented in tests**

Guidance covers keyboard operation, focus visibility, image alternative text, contrast, forced colors, reduced motion, reflow, print fallback, page breaks, and paged-media limitations.

## Licensing

Current status: **documented**

The repository uses the MIT License, and `SPEC.md` now states explicitly that compatible implementations may be created without permission from the project maintainers and that conformance does not require the reference implementation.

No broader patent or third-party-rights representation is implied by that statement.

## Release-candidate blockers

The current blockers to calling a release v0.9 RC are:

1. complete the browser/Obsidian runtime smoke test — issue #2;
2. finalize media-type registration strategy — issue #3;
3. finalize/promote the candidate 1.0 manifest schema and version-negotiation fixtures — issue #4;
4. independent implementation/interoperability exercise and RC feedback — issue #5;
5. perform final review of `IMPLEMENTATION.md`, `VERSIONING.md`, and `MIGRATION.md`;
6. perform a final normative/security/schema audit after the versioning decision.

Do not mark v0.9 or v1.0 complete while these remain unresolved.
