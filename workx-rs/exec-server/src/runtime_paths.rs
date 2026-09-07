use std::path::PathBuf;

use workx_utils_absolute_path::AbsolutePathBuf;

/// Runtime paths needed by exec-server child processes.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ExecServerRuntimePaths {
    /// Stable path to the Workx executable used to launch hidden helper modes.
    pub workx_self_exe: AbsolutePathBuf,
    /// Path to the Linux sandbox helper alias used when the platform sandbox
    /// needs to re-enter Workx by argv0.
    pub workx_linux_sandbox_exe: Option<AbsolutePathBuf>,
}

impl ExecServerRuntimePaths {
    pub fn from_optional_paths(
        workx_self_exe: Option<PathBuf>,
        workx_linux_sandbox_exe: Option<PathBuf>,
    ) -> std::io::Result<Self> {
        let workx_self_exe = workx_self_exe.ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Workx executable path is not configured",
            )
        })?;
        Self::new(workx_self_exe, workx_linux_sandbox_exe)
    }

    pub fn new(
        workx_self_exe: PathBuf,
        workx_linux_sandbox_exe: Option<PathBuf>,
    ) -> std::io::Result<Self> {
        Ok(Self {
            workx_self_exe: absolute_path(workx_self_exe)?,
            workx_linux_sandbox_exe: workx_linux_sandbox_exe.map(absolute_path).transpose()?,
        })
    }
}

fn absolute_path(path: PathBuf) -> std::io::Result<AbsolutePathBuf> {
    AbsolutePathBuf::from_absolute_path(path.as_path())
        .map_err(|err| std::io::Error::new(std::io::ErrorKind::InvalidInput, err))
}
