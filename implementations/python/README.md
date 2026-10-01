# Independent Python implementation

This directory contains a small, standard-library-only implementation of the MDOCSS container contract.

It is intentionally **not** a port of `src/cli.js`. It was written from `SPEC.md`, `VERSIONING.md`, and the public conformance corpus to provide a second implementation path and expose ambiguities in the written format contract.

## Scope

The implementation provides:

- ZIP container and path-safety validation;
- canonical `root.md` validation and recovery;
- UTF-8 validation;
- manifest structural validation;
- named stylesheet/default relationships;
- 0.1 legacy behavior;
- 1.x same-major reader compatibility;
- strict `--target 1.0` authoring validation;
- unsupported-major recovery behavior;
- execution of the repository's public conformance corpus.

It intentionally does not render Markdown or CSS.

## Run

From the repository root:

```bash
python3 implementations/python/mdocss.py validate document.mdocss
python3 implementations/python/mdocss.py validate document.mdocss --target 1.0
python3 implementations/python/mdocss.py recover-root document.mdocss
python3 implementations/python/run_conformance.py
python3 -m unittest discover -s implementations/python -p "test_*.py"
```

The Python implementation has no third-party dependencies.
