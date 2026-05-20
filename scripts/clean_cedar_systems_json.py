#!/usr/bin/env python3
"""
Clean CEDAR system summary JSON exports corrupted by pasted ISO timestamps.

Some exports accidentally insert timestamps into the middle of keys and values, e.g.
  "ictObjectI2026-03-31T16:04:35.409172087Z d" instead of "ictObjectId"
  "Health Plan2026-03-31T16:04:35.409172087Z Management System"

Usage:
  python3 scripts/clean_cedar_systems_json.py path/to/systems.json
  python3 scripts/clean_cedar_systems_json.py impl.json prod.json -o cleaned/
  python3 scripts/clean_cedar_systems_json.py systems.json --in-place
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

# Timestamps accidentally pasted during copy/export (any ISO-8601 UTC with fractional seconds).
TIMESTAMP_PATTERN = re.compile(r"20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z")

# Spaces left in UUIDs when a timestamp sat between hex segments (e.g. "3193C9 0E117E").
UUID_SEGMENT_GAP = re.compile(
    r"(\{?[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]*)"
    r" ([0-9A-Fa-f]{4,}\}?)"
)


def clean_string(value: str) -> tuple[str, bool]:
    """Remove timestamp fragments and repair UUID spacing. Returns (cleaned, changed)."""
    original = value
    cleaned = TIMESTAMP_PATTERN.sub("", value)
    prev = None
    while prev != cleaned:
        prev = cleaned
        cleaned = UUID_SEGMENT_GAP.sub(r"\1\2", cleaned)
    cleaned = re.sub(r"(-) +", r"\1", cleaned)
    cleaned = re.sub(r" +(-)", r"\1", cleaned)
    return cleaned, cleaned != original


def clean_system_object(obj: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    """Return a cleaned system object and human-readable change notes."""
    changes: list[str] = []
    cleaned: dict[str, Any] = {}

    for key, value in obj.items():
        new_key, key_changed = clean_string(key)
        if key_changed:
            changes.append(f"key {key!r} -> {new_key!r}")

        if isinstance(value, str):
            new_value, value_changed = clean_string(value)
            if value_changed:
                label = new_key if not key_changed else f"{key!r} (field)"
                preview = value if len(value) <= 60 else value[:57] + "..."
                changes.append(f"{label}: removed timestamp from value ({preview!r})")
        else:
            new_value = value

        if new_key in cleaned and cleaned[new_key] != new_value:
            raise ValueError(
                f"duplicate key after cleaning: {new_key!r} "
                f"(existing {cleaned[new_key]!r}, new {new_value!r})"
            )
        cleaned[new_key] = new_value

    return cleaned, changes


def load_systems(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError(f"{path}: expected a JSON array of system objects")
    for index, item in enumerate(data):
        if not isinstance(item, dict):
            raise ValueError(f"{path}: item {index} is not an object")
    return data


def audit(data: list[dict[str, Any]]) -> list[str]:
    """Return descriptions of remaining timestamp corruption."""
    issues: list[str] = []
    for index, obj in enumerate(data):
        for key, value in obj.items():
            if TIMESTAMP_PATTERN.search(key):
                issues.append(f"[{index}] key still has timestamp: {key!r}")
            if isinstance(value, str) and TIMESTAMP_PATTERN.search(value):
                system = obj.get("acronym") or obj.get("name") or obj.get("id")
                issues.append(f"[{index}] {system}: field {key!r} still has timestamp")
    return issues


def write_systems(path: Path, data: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def process_file(
    input_path: Path,
    output_path: Path,
    *,
    dry_run: bool,
    verbose: bool,
) -> int:
    systems = load_systems(input_path)
    cleaned_systems: list[dict[str, Any]] = []
    systems_with_changes = 0
    all_changes: list[str] = []

    for index, system in enumerate(systems):
        cleaned, changes = clean_system_object(system)
        cleaned_systems.append(cleaned)
        if changes:
            systems_with_changes += 1
            acronym = system.get("acronym") or system.get("name") or f"index {index}"
            for change in changes:
                all_changes.append(f"{acronym}: {change}")

    remaining = audit(cleaned_systems)

    if verbose or dry_run:
        print(f"{input_path}:", file=sys.stderr)
        print(f"  systems: {len(systems)}", file=sys.stderr)
        print(f"  systems with fixes: {systems_with_changes}", file=sys.stderr)
        if verbose and all_changes:
            for note in all_changes:
                print(f"  - {note}", file=sys.stderr)
        if remaining:
            print(f"  remaining issues: {len(remaining)}", file=sys.stderr)
            for issue in remaining:
                print(f"    ! {issue}", file=sys.stderr)

    if remaining:
        print(f"error: {input_path} still has corruption after cleaning", file=sys.stderr)
        return 1

    if dry_run:
        print(f"dry run: would write {output_path}", file=sys.stderr)
        return 0

    write_systems(output_path, cleaned_systems)
    print(f"wrote {output_path}", file=sys.stderr)
    return 0


def resolve_output_path(input_path: Path, output_dir: Path | None, in_place: bool) -> Path:
    if in_place:
        return input_path
    if output_dir is not None:
        return output_dir / input_path.name
    return input_path.with_name(input_path.stem + "_cleaned" + input_path.suffix)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Remove pasted ISO timestamps from CEDAR systems JSON exports.",
    )
    parser.add_argument(
        "inputs",
        nargs="+",
        type=Path,
        help="One or more JSON files (array of system summary objects)",
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        type=Path,
        help="Directory for cleaned files (default: <name>_cleaned.json next to input)",
    )
    parser.add_argument(
        "--in-place",
        action="store_true",
        help="Overwrite input files instead of writing new paths",
    )
    parser.add_argument(
        "-n",
        "--dry-run",
        action="store_true",
        help="Report changes without writing files",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Print per-field fix details",
    )
    args = parser.parse_args()

    if args.in_place and args.output_dir is not None:
        print("error: use either --in-place or --output-dir, not both", file=sys.stderr)
        return 2

    exit_code = 0
    for input_path in args.inputs:
        if not input_path.is_file():
            print(f"error: not a file: {input_path}", file=sys.stderr)
            exit_code = 1
            continue
        output_path = resolve_output_path(input_path, args.output_dir, args.in_place)
        exit_code = max(exit_code, process_file(
            input_path,
            output_path,
            dry_run=args.dry_run,
            verbose=args.verbose,
        ))

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
