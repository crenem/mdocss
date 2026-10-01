# MDOCSS Release-Candidate Feedback Guide

Use this guide after an MDOCSS v0.9 / candidate-1.0 release has been published.

The goal of RC feedback is to find ambiguities or interoperability failures in the **format contract**, not merely cosmetic differences among applications.

## What reviewers should test

At minimum, try one or more of the following:

- implement a small reader, validator, writer, or converter from `SPEC.md` without reading the reference implementation first;
- run the public conformance corpus;
- open representative packages in more than one MDOCSS implementation;
- create a package in one implementation and consume it in another;
- switch bundled styles without changing canonical `root.md`;
- round-trip a package containing unknown safe files or manifest fields;
- test unsupported future-version recovery;
- inspect path, duplicate-member, malformed UTF-8, and other hostile fixtures;
- compare print behavior while distinguishing host-renderer differences from format ambiguity.

## High-value questions

Reviewers should specifically report when the specification leaves any of these unclear:

1. whether a package is valid, invalid, or unsupported;
2. whether a rule applies to readers, writers, editors, or all implementations;
3. how a relative archive resource path resolves;
4. whether canonical Markdown may be modified by a presentation operation;
5. whether unknown safe data must be ignored, preserved, or rejected;
6. whether a version rule concerns reading compatibility or exact authoring conformance;
7. whether two conforming implementations can reasonably reach different structural interpretations.

## What is not automatically a format bug

The following may be normal implementation variation when semantics remain intact:

- font metrics;
- line wrapping;
- browser/Electron print pagination;
- antialiasing;
- unsupported optional CSS features;
- Markdown-renderer differences when no shared `markdownProfile` is declared.

Report these when they materially affect interoperability, but distinguish them from container or semantic-contract failures.

## Reporting

Use the GitHub RC feedback issue template.

Include:

- implementation name/version or commit;
- operating system/runtime;
- MDOCSS RC version/commit;
- exact document or fixture used;
- expected behavior;
- observed behavior;
- whether canonical `root.md` changed;
- minimal reproduction if possible;
- proposed clarification, if the issue is specification ambiguity.

## RC exit criteria

The release candidate may advance to stable 1.0 when:

- runtime smoke testing is complete;
- no unresolved ambiguity requires a breaking core change;
- independent review has exercised the public corpus or implemented the format;
- reported security/conformance defects are resolved or explicitly dispositioned;
- migration notes cover any intentional 0.x break;
- the final normative/security/schema audit is complete.

A cosmetic renderer difference alone does not block 1.0 unless it exposes an ambiguity in the normative contract.
