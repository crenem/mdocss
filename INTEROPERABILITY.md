# MDOCSS Interoperability Report

**Status:** pre-1.0 release-candidate evidence  
**Date:** 2026-10-01

This report records interoperability evidence collected while preparing the MDOCSS 1.0 release candidate.

## Implementations exercised

The repository currently contains three distinct implementation paths:

1. **Node reference CLI** — structural validation, packing, unpacking, inspection, stylesheet management, and round-trip editing.
2. **Browser/Obsidian readers** — rich rendering paths with Markdown rendering, CSS isolation, local asset resolution, style switching, and recovery behavior.
3. **Independent Python validator/recovery reader** — a standard-library-only implementation under `implementations/python/`.

The Python implementation was written from `SPEC.md`, `VERSIONING.md`, and the public conformance corpus. It does not import, execute, or port the JavaScript validator.

This provides implementation-language independence inside the repository. It is not equivalent to third-party organizational independence.

## Shared conformance result

Both the Node reference validator and the Python implementation execute the same machine-readable case inventory in:

```text
conformance/cases.json
```

At the time of this report, the shared corpus contains **38 cases** covering:

- minimum valid packages;
- optional fallback CSS;
- named hot-swappable styles;
- unknown safe files and manifest fields;
- malformed JSON and invalid manifest shapes;
- stylesheet identifier/default/target failures;
- malformed UTF-8;
- path traversal, absolute paths, backslashes, drive-letter paths, and symlinks;
- duplicate archive members;
- fixed `root.md` entrypoint behavior;
- unsupported future versions with safe canonical-content recovery;
- the restricted ZIP interoperability profile, including rejection of BZIP2-compressed and ZIP64 packages;
- exact 1.0 authoring;
- the no-manifest 1.0 minimum document;
- same-major newer-minor 1.x reading;
- target-specific rejection of unversioned manifests and later-minor declarations as exact 1.0 output;
- rejection of abbreviated two-component manifest versions so every implementation negotiates the same `MAJOR.MINOR.PATCH` syntax;
- shared validation of RFC 3339 date-time, author email, and author URI metadata;
- deterministic non-ASCII ZIP filename decoding through the ZIP UTF-8 language flag.

CI runs both implementations against this inventory.

## Interoperability finding: reading compatibility vs authoring conformance

Building the second implementation exposed an ambiguity that was easy to miss in a single implementation:

> Is a document declaring `specVersion: "1.1.0"` valid to a 1.0 implementation?

The answer depends on the operation.

A **1.0 reader** should process understood fields from a later 1.x document and preserve or ignore unknown safe additions.

A **1.0 authoring validator** must not claim that a 1.1 document is exact 1.0-authored output.

The project resolved this by separating the contracts:

```text
schema/manifest-1.0-draft.schema.json
    exact candidate 1.0 authoring contract

schema/manifest-1.x-reader.schema.json
    1.0-baseline reader contract for same-major forward compatibility
```

The reference CLI exposes the same distinction:

```bash
mdocss validate document.mdocss
mdocss validate document.mdocss --target 1.0
```

This clarification is now documented in `VERSIONING.md`, represented in both implementations, and exercised by the shared corpus.

## Interoperability finding: canonical recovery must remain separate from conformance

Both implementations independently converged on another important distinction.

An unsupported future major version is not reported as a valid current-version package. However, when archive safety and UTF-8 requirements allow it, `root.md` remains recoverable.

That means applications can preserve the core MDOCSS principle:

> unsupported presentation or metadata semantics must not trap canonical Markdown.

The conformance harness therefore distinguishes:

- valid;
- invalid;
- unsupported but safely recoverable.

## Interoperability finding: package-level rules exceed JSON Schema

The manifest JSON Schema can validate individual field shapes, but several MDOCSS requirements are relationships between the manifest and ZIP members.

Examples include:

- stylesheet IDs must be unique;
- every declared stylesheet must exist as a regular CSS file;
- `defaultStylesheet` must name a declared style;
- archive paths must remain safe;
- duplicate ZIP members are forbidden;
- `root.md` must exist exactly once.

Both implementations therefore use package-level validation in addition to manifest-schema validation.

This is now treated as an architectural property of MDOCSS rather than an implementation accident.

## Current result

The multi-language conformance exercise has not identified a breaking change required to the core container architecture.

The exercise did identify and resolve the version-negotiation ambiguity above and strengthened the public corpus so that the resolution is executable rather than prose-only.

The automated interoperability evidence currently supports:

- container structure and the Store/Deflate, non-ZIP64 interoperability profile;
- path safety;
- strict UTF-8 handling;
- manifest/style relationships;
- version negotiation;
- unsupported-version recovery.

## Evidence still required before stable 1.0

The following work remains intentionally open:

1. **Manual runtime smoke test** of the standalone browser viewer and the Obsidian reader against the same representative packages.
2. **Independent-party review or implementation.** The Python path is independently authored from the JavaScript implementation, but it is still maintained in the same project repository.
3. **Documented release-candidate feedback period** after the 1.0 contract is frozen.
4. Resolution of any interoperability ambiguity discovered during those exercises.

No claim of third-party interoperability should be made until item 2 occurs.

## Reproduction

From the repository root:

```bash
npm test
python3 implementations/python/run_conformance.py
python3 -m unittest discover -s implementations/python -p "test_*.py"
```

The GitHub Actions workflow executes these gates automatically on pushes and pull requests.
