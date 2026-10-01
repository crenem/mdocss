# MDOCSS Draft Migration Notes

This file records changes that affect documents or implementations during the pre-1.0 period.

Because 0.x is a draft series, early experiments may require migration. The project will avoid unnecessary breakage, but correcting the core contract takes precedence over preserving an accidental early design.

## Pre-specification sketches → 0.1

Very early design discussions used several provisional ideas that were never stable requirements.

### metadata.json → manifest.json

Use:

```text
manifest.json
```

The earlier `metadata.json` name was a concept sketch and is not part of the current draft.

### One stylesheet → named stylesheets

Early manifests used a single field resembling:

```json
{
  "stylesheet": "root.css"
}
```

The current draft uses:

```json
{
  "stylesheets": [
    {
      "id": "default",
      "label": "Default",
      "href": "root.css"
    }
  ],
  "defaultStylesheet": "default"
}
```

A package with no manifest and a root-level `root.css` remains valid and needs no migration.

### Alternate styles directory

Additional selectable styles conventionally live under:

```text
styles/
```

This is a convention rather than a requirement that every CSS file must live there.

## Semantic profile introduction

The Core Semantic Class Profile was added after the minimum container design.

Existing Markdown does not need to be rewritten merely to remain a valid MDOCSS document.

Semantic classes are optional and should be added only where a stylesheet or editor needs a stable role that ordinary Markdown/HTML does not already express.

## Reader-local style preference

A user's currently selected style is not document metadata.

Applications that previously considered writing the active style into the package should instead keep reader-local preference outside the archive unless the user explicitly changes the author-defined `defaultStylesheet`.

## Strict UTF-8 and path validation

Current conformance tooling rejects malformed UTF-8 in required/declared text files and rejects unsafe archive paths.

A package that depended on permissive replacement-character decoding or unsafe path normalization is not conforming and should be rebuilt from clean source files.

## Three-component specVersion syntax

Early draft tooling temporarily accepted abbreviated values such as:

```json
{
  "specVersion": "1.0"
}
```

The pre-1.0 audit aligned implementation behavior with the documented version model. Manifest versions now use exactly three numeric components:

```json
{
  "specVersion": "1.0.0"
}
```

Draft packages using two-component values should add an explicit patch component.

## 0.1 manifest → 1.0 manifest

The planned 1.0 rule requires `specVersion` whenever `manifest.json` exists.

A 0.1 package with a manifest that omits `specVersion` can migrate by adding:

```json
{
  "specVersion": "1.0.0"
}
```

after confirming that its manifest fields otherwise satisfy the final 1.0 schema.

A minimal package without `manifest.json` does not need a version field and remains compatible with the minimum-container design.

## Moving toward 1.0

Every intentional draft-format break before 1.0 should receive:

- an entry here;
- updated conformance fixtures where relevant;
- a reference migration path when automated migration is practical.

The goal for 1.0 is that ordinary 1.x documents do not require breaking migration within the major version.
