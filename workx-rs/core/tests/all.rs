#![allow(clippy::expect_used)]

// Single integration test binary that aggregates all test modules.
// The submodules live in `tests/all/`.
pub use workx_protocol::error;

mod suite;
