#[cfg(workx_bazel)]
pub use code_mode_proto::workx::code_mode::v1::*;

#[cfg(not(workx_bazel))]
tonic::include_proto!("workx.code_mode.v1");

pub const MAX_IDENTIFIER_BYTES: usize = 256;
