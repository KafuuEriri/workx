# Workx CLI Runtime for Python SDK

Platform-specific runtime package consumed by the published `workx`.

This package is staged during release so the SDK can pin an exact Workx CLI
version without checking platform binaries into the repo.

`workx-cli-bin` is intentionally wheel-only. Do not build or publish an
sdist for this package.
