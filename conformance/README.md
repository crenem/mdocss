# MDOCSS Conformance Corpus

This directory is the public conformance corpus for the MDOCSS draft specification.

The corpus is intentionally small and explicit. Each fixture tests one interoperability or safety rule that an independent implementation should be able to reproduce.

## Contents

- `cases.json` — machine-readable case inventory and expected result.
- `fixtures/` — committed `.mdocss` archives, including malformed and hostile examples.
- `run.js` — reference harness that executes the MDOCSS CLI against the corpus.

Run the corpus with:

```bash
npm run conformance
```

The harness exits nonzero if the reference validator accepts a fixture marked invalid, rejects a fixture marked valid, or fails the preservation check.

## Valid cases

The valid fixtures cover:

- the absolute minimum document containing only `root.md`;
- conventional `root.css` fallback behavior without a manifest;
- multiple declared stylesheets with a valid default;
- unknown archive members and unknown manifest properties.

The unknown-content case also checks round-trip preservation by unpacking, repacking, and revalidating the archive.

## Invalid cases

The invalid fixtures cover:

- missing canonical content;
- malformed or structurally invalid manifests;
- duplicate stylesheet IDs;
- missing stylesheet targets;
- invalid default-style references;
- non-CSS stylesheet targets;
- malformed UTF-8 in canonical content, metadata, and CSS;
- archive path traversal;
- absolute, backslash, and drive-letter paths;
- stylesheet traversal outside the archive;
- symbolic-link archive members;
- duplicate archive member names;
- an invalid v0.1 entrypoint.

## Resource-exhaustion cases

The repository deliberately does **not** commit operational ZIP bombs or other fixtures intended to consume extreme memory, CPU, disk, or decompression time.

Those protections are still required by the security guidance, but resource ceilings are implementation policy rather than a single portable byte-for-byte conformance case in v0.3. See `../SECURITY.md`.

## Expected behavior

A conforming validator should reject every `invalid-*.mdocss` fixture before treating it as a safe, conforming MDOCSS document.

A reader may still choose to offer safe recovery of `root.md` from some malformed documents, but doing so does not make the container conforming.

## Adding cases

New cases should be narrowly scoped. Prefer one reason for rejection per invalid fixture so that failures identify an ambiguous or incorrectly implemented rule rather than a bundle of unrelated defects.

Each new fixture must receive an entry in `cases.json` and must be exercised by `run.js`.
