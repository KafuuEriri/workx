//! Measures local WORKX_HOME storage once at standalone app-server startup.
//!
//! The background scan sums regular-file lengths, without reading file contents or
//! following symlinks. Incomplete scans emit no samples, and shutdown cancels the scan.
//! The compression tag reflects the effective startup config, not compression completion.

use std::io;
use std::path::Path;
use tokio::task::JoinHandle;
use tokio_util::sync::CancellationToken;
use workx_core::config::Config;
use workx_features::Feature;
use workx_otel::MetricsClient;
use workx_rollout::ARCHIVED_SESSIONS_SUBDIR;
use workx_rollout::SESSIONS_SUBDIR;

const SIZE_BYTES_METRIC: &str = "workx.app_server.workx_home.size_bytes";
// Bucket sizes range from 1 MiB through 1 TiB; larger homes use the overflow bucket.
const SIZE_BYTES_BOUNDARIES: &[f64] = &[
    1_048_576.0,
    10_485_760.0,
    104_857_600.0,
    1_073_741_824.0,
    10_737_418_240.0,
    107_374_182_400.0,
    1_099_511_627_776.0,
];

pub(crate) fn spawn(
    config: &Config,
    metrics: MetricsClient,
    shutdown: CancellationToken,
) -> JoinHandle<()> {
    let workx_home = config.workx_home.to_path_buf();
    let compression_enabled = config
        .features
        .enabled(Feature::LocalThreadStoreCompression)
        .to_string();
    tokio::task::spawn_blocking(move || {
        let sizes = match directory_sizes(&workx_home, &shutdown) {
            Ok(sizes) => sizes,
            Err(error) => {
                tracing::debug!(error_kind = ?error.kind(), "Skipping WORKX_HOME size metrics");
                return;
            }
        };
        for (directory, bytes) in [
            ("workx_home", sizes.workx_home),
            (SESSIONS_SUBDIR, sizes.sessions),
            (ARCHIVED_SESSIONS_SUBDIR, sizes.archived_sessions),
        ] {
            let _ = metrics.histogram_with_boundaries(
                SIZE_BYTES_METRIC,
                i64::try_from(bytes).unwrap_or(i64::MAX),
                SIZE_BYTES_BOUNDARIES,
                &[
                    ("directory", directory),
                    ("compression_enabled", compression_enabled.as_str()),
                ],
            );
        }
    })
}

#[derive(Debug, Default, PartialEq, Eq)]
struct DirectorySizes {
    workx_home: u64,
    sessions: u64,
    archived_sessions: u64,
}

fn directory_sizes(workx_home: &Path, shutdown: &CancellationToken) -> io::Result<DirectorySizes> {
    let sessions = workx_home.join(SESSIONS_SUBDIR);
    let archived_sessions = workx_home.join(ARCHIVED_SESSIONS_SUBDIR);
    let mut sizes = DirectorySizes::default();
    let mut pending = vec![workx_home.to_path_buf()];
    while let Some(directory) = pending.pop() {
        if shutdown.is_cancelled() {
            return Err(io::ErrorKind::Interrupted.into());
        }
        for entry in std::fs::read_dir(directory)? {
            if shutdown.is_cancelled() {
                return Err(io::ErrorKind::Interrupted.into());
            }
            let entry = entry?;
            // DirEntry::metadata does not follow symbolic links.
            let metadata = entry.metadata()?;
            let path = entry.path();
            if metadata.is_dir() {
                pending.push(path);
            } else if metadata.is_file() {
                let bytes = metadata.len();
                sizes.workx_home = sizes.workx_home.saturating_add(bytes);
                if path.starts_with(&sessions) {
                    sizes.sessions = sizes.sessions.saturating_add(bytes);
                } else if path.starts_with(&archived_sessions) {
                    sizes.archived_sessions = sizes.archived_sessions.saturating_add(bytes);
                }
            }
        }
    }
    Ok(sizes)
}
