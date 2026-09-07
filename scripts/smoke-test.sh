#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export WORKX_REPO_ROOT="$PWD"
python3 - <<'PYTHON'
from pathlib import Path
import re

missing = []
for source in Path("workx-rs").rglob("*.rs"):
    for reference in re.finditer(r'include_(?:str|bytes)!\(\s*"([^"\n]+)"\s*\)', source.read_text()):
        if not (source.parent / reference[1]).exists():
            missing.append(f"{source}: {reference[1]}")
if missing:
    raise SystemExit("Missing embedded resources:\n" + "\n".join(missing))
PYTHON
cargo metadata --manifest-path workx-rs/Cargo.toml --no-deps --format-version 1 > /dev/null
python3 -m unittest discover -s scripts/workx_package -t scripts -p 'test_*.py'
python3 -m unittest discover -s scripts/install -p 'test_*.py'
python3 -m unittest discover -s third_party/voice -p 'test_assemble_package.py'
node --check workx-cli/bin/workx.js
bash -n scripts/install/install.sh
