#!/usr/bin/env python3
from __future__ import annotations

import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from mdocss import recover_root, validate_package


class VersioningTests(unittest.TestCase):
    def make_package(self, manifest=...):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        path = Path(tmp.name) / "test.mdocss"
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("root.md", "# Test\n")
            if manifest is not ...:
                zf.writestr(
                    "manifest.json",
                    json.dumps(manifest, indent=2) + "\n",
                )
        return path

    def test_minimal_package_is_valid_for_1_0_target(self):
        self.assertEqual(
            validate_package(self.make_package(), target="1.0").status,
            "valid",
        )

    def test_present_1_0_manifest_requires_version(self):
        result = validate_package(
            self.make_package({"title": "No version"}),
            target="1.0",
        )
        self.assertEqual(result.status, "invalid")

    def test_1_0_target_accepts_patch_release(self):
        result = validate_package(
            self.make_package({"specVersion": "1.0.4"}),
            target="1.0",
        )
        self.assertEqual(result.status, "valid")

    def test_1_0_target_rejects_1_1_output(self):
        result = validate_package(
            self.make_package({"specVersion": "1.1.0"}),
            target="1.0",
        )
        self.assertEqual(result.status, "invalid")

    def test_reader_accepts_same_major_newer_minor(self):
        result = validate_package(
            self.make_package({"specVersion": "1.8.0"})
        )
        self.assertEqual(result.status, "valid")

    def test_reader_marks_future_major_unsupported_but_recovers_root(self):
        path = self.make_package({"specVersion": "9.0.0"})
        result = validate_package(path)
        self.assertEqual(result.status, "unsupported")
        self.assertEqual(recover_root(path), "# Test\n")


if __name__ == "__main__":
    unittest.main()
