#![allow(clippy::expect_used)]

use std::process::Command;

use divan::Bencher;

fn main() {
    divan::main();
}

/// Exercises the Bazel-backed end-to-end benchmark path with a cheap,
/// deterministic Workx invocation. Richer scenarios can add separate
/// benchmark binaries without making the shared harness depend on them.
#[divan::bench(sample_count = 20, sample_size = 1)]
fn workx_help(bencher: Bencher) {
    let workx = workx_utils_cargo_bin::cargo_bin("workx")
        .expect("workx binary should be available through Bazel runfiles");

    bencher.bench_local(move || {
        let output = Command::new(&workx)
            .arg("--help")
            .output()
            .expect("workx --help should run");
        assert!(output.status.success(), "workx --help should succeed");
    });
}
