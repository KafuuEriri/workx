#!/usr/bin/env python3
"""Write or update the Homebrew cask for the Workx desktop app.

The cask installs the desktop app and depends on the `workx` formula so a
single `brew install --cask workx` provides both the app and the CLI. The file
is created from the bundled template when the tap does not have it yet.
"""

import argparse
import re
import sys
from pathlib import Path

VERSION_LINE = re.compile(r'(?m)^(\s*version\s+")[^"]+(")$')
SHA256_LINE = re.compile(r'(?m)^(\s*sha256\s+")[0-9a-f]{64}(")$')
SHA256_VALUE = re.compile(r"^[0-9a-f]{64}$")

TEMPLATE = """cask "workx" do
  version "{version}"
  sha256 "{sha256}"

  url "https://github.com/RonanXiao/workx/releases/download/rust-v#{{version}}/Workx-#{{version}}-arm64.dmg"
  name "Workx"
  desc "Independent coding agent derived from OpenAI Codex"
  homepage "https://github.com/RonanXiao/workx"

  depends_on formula: "workx"
  depends_on macos: :monterey

  app "Workx.app"

  # The app is ad-hoc signed until a Developer ID is configured, and macOS
  # reports quarantined ad-hoc apps as damaged. Strip the quarantine flag so
  # the installed app opens.
  postflight_steps do
    run "/usr/bin/xattr", args: ["-dr", "com.apple.quarantine", "{{{{appdir}}}}/Workx.app"]
  end
end
"""


def update_cask(cask: Path, version: str, sha256: str) -> bool:
    if not cask.is_file():
        cask.parent.mkdir(parents=True, exist_ok=True)
        cask.write_text(
            TEMPLATE.format(version=version, sha256=sha256), encoding="utf-8"
        )
        return True

    original = cask.read_text(encoding="utf-8")
    text, version_count = VERSION_LINE.subn(rf"\g<1>{version}\g<2>", original, count=1)
    if version_count != 1:
        raise RuntimeError("Could not find exactly one version line in cask.")
    text, sha_count = SHA256_LINE.subn(rf"\g<1>{sha256}\g<2>", text, count=1)
    if sha_count != 1:
        raise RuntimeError("Could not find exactly one sha256 line in cask.")
    if text == original:
        return False
    cask.write_text(text, encoding="utf-8")
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--cask", type=Path, required=True, help="Path to Casks/workx.rb."
    )
    parser.add_argument("--version", required=True, help="Release version, e.g. 0.1.0.")
    parser.add_argument(
        "--sha256", required=True, help="SHA-256 of the arm64 DMG asset."
    )
    args = parser.parse_args()

    if SHA256_VALUE.fullmatch(args.sha256) is None:
        print(f"Invalid SHA-256: {args.sha256!r}", file=sys.stderr)
        return 2

    changed = update_cask(args.cask.resolve(), args.version, args.sha256)
    print("cask already up to date" if not changed else f"updated {args.cask}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
