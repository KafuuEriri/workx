#!/bin/bash

# Set "chatgpt.cliExecutable": "/Users/<USERNAME>/code/workx/scripts/debug-workx.sh" in VSCode settings to always get the 
# latest workx-rs binary when debugging Workx Extension.


set -euo pipefail

WORKX_RS_DIR=$(realpath "$(dirname "$0")/../workx-rs")
(cd "$WORKX_RS_DIR" && cargo run --quiet --bin workx -- "$@")