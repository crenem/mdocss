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

Before 1.0 is frozen, the project will decide whether a v1 manifest must declare `specVersion`. A no-manifest minimal package will remain part of the core design.

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

## Implementation versions

Reference implementation releases may use semantic software versions independently from `specVersion`.

For example, an Obsidian plugin version `0.6.2` may read MDOCSS format `0.1.0`. Those numbers describe different things and must not be conflated.
