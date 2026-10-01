#!/usr/bin/env python3
"""Run the public MDOCSS corpus against the independent Python implementation."""

from __future__ import annotations

import json
import sys
import tempfile
import zipfile
from pathlib import Path

from mdocss import InvalidDocument, recover_root, validate_package


HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
CASES = REPO / "conformance" / "cases.json"
FIXTURES = REPO / "conformance" / "fixtures"


def fixture_for(case: dict) -> Path:
    if case.get("file"):
        return FIXTURES / case["file"]

    generated = case.get("generated")
    if not isinstance(generated, dict):
        raise ValueError(f"Conformance case {case['id']} has no fixture")

    directory = Path(tempfile.mkdtemp(prefix="mdocss-py-generated-"))
    fixture = directory / f"{case['id']}.mdocss"

    with zipfile.ZipFile(fixture, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "root.md",
            generated.get("root", "# Generated MDOCSS fixture\n"),
        )
        if "manifest" in generated:
            zf.writestr(
                "manifest.json",
                json.dumps(generated["manifest"], indent=2) + "\n",
            )
        for name, content in generated.get("files", {}).items():
            zf.writestr(name, str(content))

    return fixture


def main() -> int:
    cases = json.loads(CASES.read_text(encoding="utf-8"))
    failures = 0

    for case in cases:
        fixture = fixture_for(case)
        result = validate_package(fixture, target=case.get("target"))
        expected = case["expected"]
        ok = result.status == expected
        detail = ""

        if ok and case.get("recoverRoot"):
            try:
                root = recover_root(fixture)
                if not root.strip():
                    raise InvalidDocument("recovered root.md was empty")
            except Exception as exc:  # corpus harness should report all failures
                ok = False
                detail = f"safe root recovery failed: {exc}"

        if not ok:
            failures += 1
            if not detail:
                detail = (
                    f"got {result.status!r}, expected {expected!r}; "
                    f"errors={list(result.errors)!r}, version={result.version!r}"
                )
            print(
                f"FAIL {case['id']} {case.get('file', '[generated]')}: {detail}",
                file=sys.stderr,
            )
        else:
            print(
                f"PASS {case['id']} {case.get('file', '[generated]')} "
                f"({case['expected']})"
            )

    if failures:
        print(f"\n{failures} Python conformance case(s) failed.", file=sys.stderr)
        return 1

    print(f"\nAll {len(cases)} MDOCSS cases passed in the independent Python implementation.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
