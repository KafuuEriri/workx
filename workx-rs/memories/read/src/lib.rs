//! Read-path helpers for Workx memories.
//!
//! This crate owns memory injection, memory citation parsing, and telemetry
//! classification for read access to the memory folder. It intentionally does
//! not depend on the memory write pipeline.

pub mod citations;
mod metrics;
pub mod usage;

use workx_utils_absolute_path::AbsolutePathBuf;

pub fn memory_root(workx_home: &AbsolutePathBuf) -> AbsolutePathBuf {
    workx_home.join("memories")
}
