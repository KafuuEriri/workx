#!/usr/bin/env python3
"""Update the Homebrew tap formula for a published Workx release.

The formula keeps two download variants:

* Apple Silicon uses the prebuilt `workx-package-aarch64-apple-darwin.tar.gz`
  release asset.
* Intel falls back to the GitHub source archive for the same release tag.

This script rewrites the version, both tag URLs, and both SHA-256 digests in
`Formula/workx.rb`. It fails if any expected line is missing rather than
silently producing an incomplete formula.
"""

import argparse
import re
import sys
from pathlib import Path

VERSION_LINE = re.compile(r'(?m)^(\s*version\s+")[^"]+(")$')
ARM_URL_RE = re.compile(
    r'(releases/download/)rust-v[^/"]+(/workx-package-aarch64-apple-darwin\.tar\.gz)'
)
SOURCE_URL_RE = re.compile(r'(archive/refs/tags/)rust-v[^/"]+(\.tar\.gz)')
SHA256_LINE = re.compile(r'(?m)^(\s*sha256\s+")[0-9a-f]{64}(")$')
SHA256_VALUE = re.compile(r"^[0-9a-f]{64}$")


def replace_one(
    text: str, pattern: re.Pattern[str], replacement: str, label: str
) -> str:
    updated, count = pattern.subn(replacement, text, count=1)
    if count != 1:
        raise RuntimeError(f"Could not find exactly one {label} in formula.")
    return updated


def replace_nth_sha256(text: str, digest: str, ordinal: int) -> str:
    matches = list(SHA256_LINE.finditer(text))
    if len(matches) < ordinal:
        raise RuntimeError(
            f"Formula has {len(matches)} sha256 lines, expected at least {ordinal}."
        )
    match = matches[ordinal - 1]
    return f"{text[: match.start()]}{match.group(1)}{digest}{match.group(2)}{text[match.end() :]}"


def update_formula(
    formula: Path, version: str, tag: str, arm64_sha256: str, source_sha256: str
) -> bool:
    original = formula.read_text(encoding="utf-8")
    text = replace_one(original, VERSION_LINE, rf"\g<1>{version}\g<2>", "version line")
    text = replace_one(text, ARM_URL_RE, rf"\g<1>{tag}\g<2>", "arm64 release URL")
    text = replace_one(text, SOURCE_URL_RE, rf"\g<1>{tag}\g<2>", "source archive URL")
    text = replace_nth_sha256(text, arm64_sha256, 1)
    text = replace_nth_sha256(text, source_sha256, 2)
    if text == original:
        return False
    formula.write_text(text, encoding="utf-8")
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--formula", type=Path, required=True, help="Path to Formula/workx.rb."
    )
    parser.add_argument("--version", required=True, help="Release version, e.g. 0.0.3.")
    parser.add_argument("--tag", required=True, help="Release tag, e.g. rust-v0.0.3.")
    parser.add_argument(
        "--arm64-sha256", required=True, help="SHA-256 of the arm64 package asset."
    )
    parser.add_argument(
        "--source-sha256", required=True, help="SHA-256 of the source tarball."
    )
    args = parser.parse_args()

    if SHA256_VALUE.fullmatch(args.arm64_sha256) is None:
        print(f"Invalid arm64 SHA-256: {args.arm64_sha256!r}", file=sys.stderr)
        return 2
    if SHA256_VALUE.fullmatch(args.source_sha256) is None:
        print(f"Invalid source SHA-256: {args.source_sha256!r}", file=sys.stderr)
        return 2
    if not args.formula.is_file():
        print(f"Formula file not found: {args.formula}", file=sys.stderr)
        return 2

    changed = update_formula(
        args.formula.resolve(),
        args.version,
        args.tag,
        args.arm64_sha256,
        args.source_sha256,
    )
    print("formula already up to date" if not changed else f"updated {args.formula}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
