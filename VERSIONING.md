# MDOCSS Versioning and Compatibility

MDOCSS separates **format versioning** from implementation versioning.

A viewer, CLI, or plugin can have its own software version. The value in `manifest.json` describes the MDOCSS format contract used by the package.

## Format version syntax

When present, `specVersion` uses three numeric components:

```text
MAJOR.MINOR.PATCH
```

Example:

```json
{
  "specVersion": "0.1.0"
}
```

## Compatibility meaning

### Major version

A major-version change may introduce incompatible format semantics.

A reader that encounters a higher unsupported major version SHOULD:

- warn that the package uses a newer format;
- avoid interpreting unknown semantics as though they were understood;
- still offer safe access to `root.md` when archive and text safety checks permit.

### Minor version

Within a stable major version, a minor release is expected to be backward-compatible for existing conforming documents.

A reader supporting the same major version SHOULD process the fields and files it understands and preserve or ignore unknown safe additions according to the core forward-compatibility rules.

### Patch version

Patch releases clarify wording, repair schemas or examples, or make changes that do not intentionally alter the interoperable document model.

## The 0.x draft period

All pre-1.0 releases are drafts.

Breaking changes may occur between 0.x format revisions when necessary to correct the architecture before 1.0. Such changes must be documented in `MIGRATION.md`.

The current manifest schema is intentionally scoped to the 0.1 family.

## Documents without a manifest

A package containing only `root.md` does not need a version declaration.

This is intentional: the minimum recoverable MDOCSS document is simply a safe ZIP container with canonical Markdown at the archive root.

A reader encountering no manifest must not assume optional features that require metadata.

## Manifests without specVersion

During the 0.x draft period, `specVersion` remains optional for compatibility with the minimal/open-container design.

Authors and tools that emit a manifest SHOULD include `specVersion`.

### 1.0 decision

For MDOCSS 1.0, **if `manifest.json` is present, it MUST declare `specVersion`**.

A no-manifest package containing only the minimum core files remains valid.

This requirement lets a future reader select the correct manifest contract without weakening the format's minimum-document principle. A candidate schema is published as `schema/manifest-1.0-draft.schema.json` until the 1.0 contract is frozen.

## Unknown fields and files

Unknown safe archive members do not invalidate a document.

Unknown manifest properties do not invalidate a document unless they conflict with a normative security or conformance rule.

Editors SHOULD preserve both when round-tripping.

## Version negotiation algorithm

A reader can use the following practical algorithm:

1. no manifest: process the minimum container contract;
2. manifest without `specVersion`: process only understood fields conservatively;
3. supported version: process normally;
4. same major, newer minor: process understood fields and preserve/ignore unknown safe additions;
5. newer unsupported major: warn and fall back to safe canonical-content access;
6. older supported major: use the corresponding compatibility path.

## Reference validation behavior

The reference CLI distinguishes **reading compatibility** from **authoring conformance**.

With no target option, `mdocss validate` negotiates the package version:

- unversioned manifests are treated as legacy 0.1 draft manifests;
- 0.1.x manifests use the 0.1 schema;
- 1.x manifests use the 1.0 baseline contract, including same-major newer-minor forward compatibility;
- unsupported higher major versions return a distinct unsupported-version result while preserving safe `root.md` recovery.

For authoring, an implementation may validate against an exact target contract. The reference CLI supports:

```text
mdocss validate document.mdocss --target 1.0
```

Under the 1.0 target, a package without `manifest.json` remains valid, but a present manifest MUST declare a 1.0.x `specVersion`. A 1.1 or later declaration is not valid *as 1.0-authored output*, even though a 1.0 reader may process its understood fields forward-compatibly.

This distinction prevents a reader from rejecting safe same-major evolution while still allowing writers and CI systems to prove that emitted packages conform to a specific release contract.

## Implementation versions

Reference implementation releases may use semantic software versions independently from `specVersion`.

For example, an Obsidian plugin version `0.6.2` may read MDOCSS format `0.1.0`. Those numbers describe different things and must not be conflated.
