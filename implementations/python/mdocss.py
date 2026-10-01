#!/usr/bin/env python3
"""Independent Python implementation of the MDOCSS container validator.

This implementation is intentionally written against SPEC.md / VERSIONING.md
and the public conformance corpus. It does not import or shell out to the
JavaScript reference implementation.
"""

from __future__ import annotations

import argparse
import json
import re
import stat
import struct
import sys
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


VERSION_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")
STYLE_ID_RE = re.compile(r"^[A-Za-z][A-Za-z0-9._-]*$")
DRIVE_RE = re.compile(r"^[A-Za-z]:")


class InvalidDocument(Exception):
    """The package violates a conformance or safety requirement."""


class UnsupportedVersion(Exception):
    """The package is structurally safe but declares an unsupported version."""

    def __init__(self, version: str):
        super().__init__(version)
        self.version = version


@dataclass(frozen=True)
class ValidationResult:
    status: str
    errors: tuple[str, ...] = ()
    version: str | None = None

    @property
    def exit_code(self) -> int:
        return {"valid": 0, "invalid": 1, "unsupported": 2}[self.status]


def dangerous_path(name: str) -> bool:
    if not name or "\x00" in name:
        return True
    if name.startswith(("/", "\\")):
        return True
    if DRIVE_RE.match(name):
        return True
    if "\\" in name:
        return True
    return ".." in name.split("/")


def is_symlink(info: zipfile.ZipInfo) -> bool:
    mode = (info.external_attr >> 16) & 0xFFFF
    return stat.S_IFMT(mode) == stat.S_IFLNK


def _extra_has_zip64(extra: bytes) -> bool:
    cursor = 0
    while cursor + 4 <= len(extra):
        header_id, size = struct.unpack_from("<HH", extra, cursor)
        if header_id == 0x0001:
            return True
        cursor += 4 + size
    return False


def zip_profile_errors(path: str | Path, infos: Iterable[zipfile.ZipInfo]) -> list[str]:
    errors: list[str] = []
    raw = Path(path).read_bytes()

    eocd = raw.rfind(b"PK\x05\x06", max(0, len(raw) - 22 - 0xFFFF))
    if eocd >= 0 and eocd + 22 <= len(raw):
        disk_number, central_disk, entries_disk, total_entries = struct.unpack_from(
            "<HHHH", raw, eocd + 4
        )
        central_size, central_offset = struct.unpack_from("<II", raw, eocd + 12)

        if disk_number != 0 or central_disk != 0 or entries_disk != total_entries:
            errors.append("Multi-disk/spanned ZIP archives are not allowed")

        if (
            entries_disk == 0xFFFF
            or total_entries == 0xFFFF
            or central_size == 0xFFFFFFFF
            or central_offset == 0xFFFFFFFF
            or (eocd >= 20 and raw[eocd - 20:eocd - 16] == b"PK\x06\x07")
        ):
            errors.append("ZIP64 features are not allowed by the MDOCSS 1.0 ZIP profile")

    zip64_seen = False
    for info in infos:
        if info.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
            errors.append(
                f"Unsupported ZIP compression method {info.compress_type}: {info.filename}"
            )
        if info.flag_bits & 0x0001:
            errors.append(f"Encrypted ZIP member is not allowed: {info.filename}")

        if _extra_has_zip64(info.extra):
            zip64_seen = True

        offset = info.header_offset
        if offset + 30 <= len(raw) and raw[offset:offset + 4] == b"PK\x03\x04":
            compressed_size, uncompressed_size = struct.unpack_from("<II", raw, offset + 18)
            name_len, extra_len = struct.unpack_from("<HH", raw, offset + 26)
            extra_start = offset + 30 + name_len
            extra_end = extra_start + extra_len
            local_extra = raw[extra_start:extra_end]

            if (
                compressed_size == 0xFFFFFFFF
                or uncompressed_size == 0xFFFFFFFF
                or _extra_has_zip64(local_extra)
            ):
                zip64_seen = True

    if zip64_seen and not any("ZIP64 features" in error for error in errors):
        errors.append("ZIP64 features are not allowed by the MDOCSS 1.0 ZIP profile")

    return errors


def read_utf8(zf: zipfile.ZipFile, name: str) -> str:
    try:
        return zf.read(name).decode("utf-8", errors="strict")
    except UnicodeDecodeError as exc:
        raise InvalidDocument(f"{name} is not valid UTF-8") from exc


def exactly_one_regular(infos: Iterable[zipfile.ZipInfo], name: str) -> zipfile.ZipInfo | None:
    matches = [info for info in infos if info.filename == name]
    if not matches:
        return None
    if len(matches) != 1:
        raise InvalidDocument(f"Duplicate archive member name: {name}")
    if matches[0].is_dir() or is_symlink(matches[0]):
        raise InvalidDocument(f"{name} must be a regular file")
    return matches[0]


def parse_version(value: Any) -> tuple[int, int, int, str] | None:
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise InvalidDocument("manifest.json /specVersion must be a string")
    match = VERSION_RE.fullmatch(value)
    if not match:
        raise InvalidDocument(f"Invalid specVersion: {value}")
    return (
        int(match.group(1)),
        int(match.group(2)),
        int(match.group(3)),
        value,
    )


def validation_family(manifest: dict[str, Any], target: str | None) -> str:
    parsed = parse_version(manifest.get("specVersion"))

    if target is not None:
        normalized = {"0.1.0": "0.1", "1.0.0": "1.0"}.get(target, target)
        if normalized not in {"0.1", "1.0"}:
            raise InvalidDocument(f"Unsupported validation target: {target}")

        if normalized == "1.0" and parsed is None:
            raise InvalidDocument(
                "manifest.json must declare specVersion for the 1.0 authoring target"
            )

        if parsed is not None:
            major, minor, _patch, raw = parsed
            matches = (
                (normalized == "0.1" and major == 0 and minor == 1)
                or (normalized == "1.0" and major == 1 and minor == 0)
            )
            if not matches:
                raise InvalidDocument(
                    f"specVersion {raw} does not match validation target {normalized}"
                )
        return normalized

    if parsed is None:
        return "0.1"

    major, minor, _patch, raw = parsed
    if major == 0 and minor == 1:
        return "0.1"
    if major == 1:
        return "1.x"
    raise UnsupportedVersion(raw)


def require_string(manifest: dict[str, Any], key: str) -> None:
    if key in manifest and not isinstance(manifest[key], str):
        raise InvalidDocument(f"manifest.json /{key} must be a string")


def validate_manifest_shape(manifest: dict[str, Any], family: str) -> None:
    for key in ("title", "language", "markdownProfile", "created", "modified"):
        require_string(manifest, key)

    if manifest.get("entrypoint", "root.md") != "root.md":
        raise InvalidDocument("manifest.json /entrypoint must equal root.md")

    if family == "1.0":
        parsed = parse_version(manifest.get("specVersion"))
        if parsed is None or not (parsed[0] == 1 and parsed[1] == 0):
            raise InvalidDocument("manifest.json must declare a 1.0.x specVersion")

    if family == "1.x":
        parsed = parse_version(manifest.get("specVersion"))
        if parsed is None or parsed[0] != 1:
            raise InvalidDocument("manifest.json must declare a 1.x specVersion")

    styles = manifest.get("stylesheets")
    if styles is not None:
        if not isinstance(styles, list) or not styles:
            raise InvalidDocument("manifest.json /stylesheets must be a non-empty array")
        for index, style in enumerate(styles):
            if not isinstance(style, dict):
                raise InvalidDocument(
                    f"manifest.json /stylesheets/{index} must be an object"
                )
            for key in ("id", "label", "href"):
                if key not in style or not isinstance(style[key], str) or not style[key]:
                    raise InvalidDocument(
                        f"manifest.json /stylesheets/{index}/{key} must be a non-empty string"
                    )
            if not STYLE_ID_RE.fullmatch(style["id"]):
                raise InvalidDocument(
                    f"manifest.json /stylesheets/{index}/id has invalid syntax"
                )
            for optional in ("description", "profile"):
                if optional in style and not isinstance(style[optional], str):
                    raise InvalidDocument(
                        f"manifest.json /stylesheets/{index}/{optional} must be a string"
                    )

    default = manifest.get("defaultStylesheet")
    if default is not None:
        if not isinstance(default, str) or not STYLE_ID_RE.fullmatch(default):
            raise InvalidDocument(
                "manifest.json /defaultStylesheet must be a valid stylesheet id"
            )

    authors = manifest.get("authors")
    if authors is not None:
        if not isinstance(authors, list):
            raise InvalidDocument("manifest.json /authors must be an array")
        for index, author in enumerate(authors):
            if isinstance(author, str):
                continue
            if not isinstance(author, dict):
                raise InvalidDocument(
                    f"manifest.json /authors/{index} must be a string or object"
                )
            if not isinstance(author.get("name"), str):
                raise InvalidDocument(
                    f"manifest.json /authors/{index}/name must be a string"
                )
            for optional in ("email", "url"):
                if optional in author and not isinstance(author[optional], str):
                    raise InvalidDocument(
                        f"manifest.json /authors/{index}/{optional} must be a string"
                    )


def validate_package(path: str | Path, target: str | None = None) -> ValidationResult:
    errors: list[str] = []
    unsupported: str | None = None

    try:
        with zipfile.ZipFile(path, "r") as zf:
            infos = zf.infolist()
            errors.extend(zip_profile_errors(path, infos))

            seen: set[str] = set()
            for info in infos:
                name = info.filename
                if name in seen:
                    errors.append(f"Duplicate archive member name: {name}")
                seen.add(name)

                if dangerous_path(name):
                    errors.append(f"Dangerous archive path: {name}")
                if is_symlink(info):
                    errors.append(f"Symbolic-link archive member is not allowed: {name}")

            root = exactly_one_regular(infos, "root.md")
            if root is None:
                errors.append("Missing required root.md")
            else:
                try:
                    read_utf8(zf, "root.md")
                except InvalidDocument as exc:
                    errors.append(str(exc))

            root_css = exactly_one_regular(infos, "root.css")
            if root_css is not None:
                try:
                    read_utf8(zf, "root.css")
                except InvalidDocument as exc:
                    errors.append(str(exc))

            manifest_info = exactly_one_regular(infos, "manifest.json")
            if manifest_info is not None:
                try:
                    raw = read_utf8(zf, "manifest.json")
                    manifest = json.loads(raw)
                    if not isinstance(manifest, dict):
                        raise InvalidDocument(
                            "manifest.json must contain a top-level JSON object"
                        )

                    try:
                        family = validation_family(manifest, target)
                    except UnsupportedVersion as exc:
                        unsupported = exc.version
                        family = None

                    if family is not None:
                        validate_manifest_shape(manifest, family)

                        styles = manifest.get("stylesheets") or []
                        ids: set[str] = set()
                        for style in styles:
                            style_id = style["id"]
                            href = style["href"]

                            if style_id in ids:
                                errors.append(f"Duplicate stylesheet id: {style_id}")
                            ids.add(style_id)

                            if dangerous_path(href):
                                errors.append(f"Dangerous stylesheet path: {href}")
                                continue
                            if not href.lower().endswith(".css"):
                                errors.append(
                                    f"Stylesheet does not reference a .css file: {href}"
                                )

                            matches = [i for i in infos if i.filename == href]
                            if len(matches) != 1 or matches[0].is_dir() or is_symlink(matches[0]):
                                errors.append(f"Declared stylesheet not found: {href}")
                            else:
                                try:
                                    read_utf8(zf, href)
                                except InvalidDocument as exc:
                                    errors.append(str(exc).replace(
                                        f"{href} is not valid UTF-8",
                                        f"Stylesheet is not valid UTF-8: {href}",
                                    ))

                        default = manifest.get("defaultStylesheet")
                        if default is not None and default not in ids:
                            errors.append(
                                "defaultStylesheet does not match a declared "
                                f"stylesheet id: {default}"
                            )

                except (UnicodeDecodeError, json.JSONDecodeError, InvalidDocument) as exc:
                    errors.append(f"Invalid manifest.json: {exc}")

            if target == "1.0" and manifest_info is None:
                # The minimum no-manifest package remains valid under 1.0.
                pass

    except zipfile.BadZipFile as exc:
        errors.append(f"Invalid ZIP archive: {exc}")
    except InvalidDocument as exc:
        errors.append(str(exc))
    except OSError as exc:
        errors.append(f"Could not read document: {exc}")

    if errors:
        return ValidationResult("invalid", tuple(errors))
    if unsupported is not None:
        return ValidationResult("unsupported", version=unsupported)
    return ValidationResult("valid")


def recover_root(path: str | Path) -> str:
    """Recover canonical Markdown without interpreting unsupported semantics."""
    with zipfile.ZipFile(path, "r") as zf:
        infos = zf.infolist()
        profile_errors = zip_profile_errors(path, infos)
        if profile_errors:
            raise InvalidDocument(profile_errors[0])

        seen: set[str] = set()
        for info in infos:
            if info.filename in seen:
                raise InvalidDocument(
                    f"Duplicate archive member name: {info.filename}"
                )
            seen.add(info.filename)
            if dangerous_path(info.filename):
                raise InvalidDocument(f"Dangerous archive path: {info.filename}")
            if is_symlink(info):
                raise InvalidDocument(
                    f"Symbolic-link archive member is not allowed: {info.filename}"
                )

        root = exactly_one_regular(infos, "root.md")
        if root is None:
            raise InvalidDocument("Missing required root.md")
        return read_utf8(zf, "root.md")


def _validate_command(args: argparse.Namespace) -> int:
    result = validate_package(args.file, args.target)
    if result.status == "valid":
        suffix = f" {args.target}" if args.target else ""
        print(f"Valid MDOCSS{suffix} document")
    elif result.status == "unsupported":
        print(
            f"Unsupported MDOCSS version {result.version}; "
            "root.md may still be safely recoverable",
            file=sys.stderr,
        )
    else:
        for error in result.errors:
            print(f"- {error}", file=sys.stderr)
    return result.exit_code


def _recover_command(args: argparse.Namespace) -> int:
    try:
        root = recover_root(args.file)
    except (InvalidDocument, zipfile.BadZipFile, OSError) as exc:
        print(str(exc), file=sys.stderr)
        return 1

    if args.output:
        Path(args.output).write_text(root, encoding="utf-8")
    else:
        sys.stdout.write(root)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="mdocss-py",
        description="Independent Python MDOCSS validator and recovery reader",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    validate = sub.add_parser("validate")
    validate.add_argument("file")
    validate.add_argument("--target", choices=("0.1", "1.0"))
    validate.set_defaults(func=_validate_command)

    recover = sub.add_parser("recover-root")
    recover.add_argument("file")
    recover.add_argument("--output")
    recover.set_defaults(func=_recover_command)

    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
