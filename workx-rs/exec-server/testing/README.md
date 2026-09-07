# Windows exec-server fixture

This directory contains the small Windows exec-server binary used by
foreign-OS tests. It links only `workx-exec-server` because the full Workx
Windows graph does not yet cross-build with Bazel.
