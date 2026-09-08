#!/usr/bin/env python3
"""Bump the shared Workx release version across package manifests.

Updates every manifest that carries the release version (Rust workspace,
npm CLI/TypeScript packages, Python SDK/runtime, and the README version
line) from the current [workspace.package] version to the requested one.

Exits non-zero if a manifest does not carry the expected current version,
so a release cannot silently skip a stale file.
"""

import argparse
import re
import sys
from pathlib import Path

WORKSPACE_VERSION_LINE = re.compile(r'^version\s*=\s*"([^"]+)"')
JSON_VERSION_LINE = re.compile(r'^(\s*"version"\s*:\s*)"[^"]*"(,?)\s*$')
README_VERSION_LINE = re.compile(r"^(- 当前项目版本：`)[^`]+(`)$")
SEMVER = re.compile(r"^\d+\.\d+\.\d+(-[0-9A-Za-z]+(\.[0-9A-Za-z]+)*)?$")


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def read_workspace_version(cargo_toml: Path) -> str:
    in_workspace_package = False
    for line in cargo_toml.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped == "[workspace.package]":
            in_workspace_package = True
            continue
        if in_workspace_package:
            if stripped.startswith("["):
                break
            match = WORKSPACE_VERSION_LINE.match(stripped)
            if match is not None:
                return match.group(1)
    raise RuntimeError(f"Could not find [workspace.package].version in {cargo_toml}")


def replace_workspace_version(cargo_toml: Path, old: str, new: str) -> bool:
    lines = cargo_toml.read_text(encoding="utf-8").splitlines(keepends=True)
    in_workspace_package = False
    changed = False
    for index, line in enumerate(lines):
        stripped = line.strip()
        if stripped == "[workspace.package]":
            in_workspace_package = True
            continue
        if in_workspace_package and stripped.startswith("["):
            break
        if in_workspace_package and stripped == f'version = "{old}"':
            lines[index] = line.replace(f'version = "{old}"', f'version = "{new}"', 1)
            changed = True
    if changed:
        cargo_toml.write_text("".join(lines), encoding="utf-8")
    return changed


def replace_json_version(path: Path, old: str, new: str) -> bool:
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    for index, line in enumerate(lines):
        match = JSON_VERSION_LINE.match(line)
        if match is not None and f'"{old}"' in line:
            lines[index] = f'{match.group(1)}"{new}"{match.group(2)}\n'
            path.write_text("".join(lines), encoding="utf-8")
            return True
    return False


def replace_pyproject_version(path: Path, old: str, new: str) -> bool:
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    for index, line in enumerate(lines):
        if line.strip() == f'version = "{old}"':
            lines[index] = line.replace(f'version = "{old}"', f'version = "{new}"', 1)
            path.write_text("".join(lines), encoding="utf-8")
            return True
    return False


def replace_readme_version(path: Path, old: str, new: str) -> bool:
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    for index, line in enumerate(lines):
        match = README_VERSION_LINE.match(line)
        if match is not None:
            lines[index] = f"{match.group(1)}{new}{match.group(2)}\n"
            path.write_text("".join(lines), encoding="utf-8")
            return True
    return False


def bump(root: Path, new_version: str) -> list[Path]:
    cargo_toml = root / "workx-rs" / "Cargo.toml"
    old_version = read_workspace_version(cargo_toml)
    if old_version == new_version:
        print(f"Workspace version is already {new_version}; nothing to bump.")
        return []

    manifests = [
        (cargo_toml, replace_workspace_version),
        (root / "workx-cli" / "package.json", replace_json_version),
        (root / "sdk" / "typescript" / "package.json", replace_json_version),
        (root / "sdk" / "python" / "pyproject.toml", replace_pyproject_version),
        (root / "sdk" / "python-runtime" / "pyproject.toml", replace_pyproject_version),
        (root / "README.md", replace_readme_version),
    ]

    changed: list[Path] = []
    for path, replacer in manifests:
        if not path.is_file():
            raise RuntimeError(f"Versioned manifest is missing: {path}")
        if not replacer(path, old_version, new_version):
            raise RuntimeError(
                f"{path} does not carry workspace version {old_version}; "
                "refusing to bump it partially."
            )
        changed.append(path)
        print(f"bumped {path.relative_to(root)}: {old_version} -> {new_version}")
    return changed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("version", help="New release version, e.g. 0.0.3")
    parser.add_argument(
        "--root",
        type=Path,
        default=repo_root(),
        help="Repository root (defaults to the directory above this script).",
    )
    args = parser.parse_args()
    if SEMVER.fullmatch(args.version) is None:
        print(f"Invalid version: {args.version!r}", file=sys.stderr)
        return 2
    bump(args.root.resolve(), args.version)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
