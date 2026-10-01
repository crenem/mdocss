# MDOCSS Pre-1.0 Audit

**Status:** living release-readiness record  
**Target:** v0.9 release candidate, then v1.0

This document tracks issues that should be settled before the core format is declared stable.

## Normative language

Current status: **in progress**

- `SPEC.md` uses MUST/SHOULD/MAY terminology.
- The specification should explicitly reference BCP 14 / RFC 2119 and RFC 8174 before the release candidate.
- Normative rules should remain in `SPEC.md`; implementation guidance belongs in companion documents.

## Schema/spec consistency

Current status: **strong, still under audit**

- manifest examples validate through the reference CLI;
- the conformance corpus exercises schema failures and cross-field stylesheet rules;
- stylesheet IDs, targets, defaults, UTF-8, and entrypoint rules are checked in reference tooling;
- JSON Schema alone cannot express every package-level relationship, so package validation remains necessary.

Remaining work:

- add an explicit schema/example consistency test across every checked-in manifest;
- review whether `specVersion` becomes mandatory when a manifest exists in 1.0;
- publish a 1.0 schema only after the versioning decision is frozen.

## Security

Current status: **documented and tested, no external security review**

Covered:

- ZIP traversal and absolute-path attacks;
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

Current status: **registration pending**

The `+zip` structured syntax suffix is registered for ZIP-based media types.

The exact subtype `application/vnd.mdocss+zip` is **not currently registered with IANA**.

Until registration is completed, MDOCSS tools should use `application/zip` as the interoperable fallback when a registered media type is required. Documentation may describe `application/vnd.mdocss+zip` as the candidate registration, but MUST NOT represent it as already registered.

Before 1.0:

- prepare the IANA media-type registration;
- confirm final subtype spelling and change-control contact;
- update `SPEC.md` only after registration status is known.

## Semantic profile

Current status: **small and intentionally conservative**

The profile avoids redundant classes for native headings, paragraphs, lists, links, and normal tables.

Before 1.0, review each core class for demonstrated use in at least one fixture or reference style. Remove unnecessary roles rather than expanding the vocabulary speculatively.

## Rendering interoperability

Current status: **two reference code paths implemented, runtime verification pending**

Implemented:

- standalone browser reference viewer;
- Obsidian custom `.mdocss` reader.

Both build in CI and share the same format contract. The browser viewer and Obsidian reader still require manual runtime smoke testing with the same representative packages before the v0.4/v0.5 exit gates are marked complete.

A genuinely independent third-party implementation would provide stronger evidence than two code paths maintained in this repository.

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

Current status: **MIT repository license**

The repository currently uses the MIT License. Before 1.0, the project should state unambiguously in the stable specification that independent implementations may implement the format royalty-free.

## Release-candidate blockers

The current blockers to calling a release v0.9 RC are:

1. manual browser-viewer smoke test;
2. manual Obsidian in-app smoke test;
3. final version-negotiation decision for 1.0;
4. media-type registration strategy;
5. normative-language audit;
6. schema/spec consistency audit;
7. implementation guide review;
8. migration-note review;
9. release-candidate feedback period.

Do not mark v0.9 or v1.0 complete while these remain unresolved.
