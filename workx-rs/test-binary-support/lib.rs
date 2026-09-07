use std::path::Path;

use tempfile::TempDir;
use workx_arg0::Arg0DispatchPaths;
use workx_arg0::Arg0PathEntryGuard;
use workx_arg0::arg0_dispatch;

pub struct TestBinaryDispatchGuard {
    _workx_home: TempDir,
    arg0: Arg0PathEntryGuard,
    _previous_workx_home: Option<std::ffi::OsString>,
}

impl TestBinaryDispatchGuard {
    pub fn paths(&self) -> &Arg0DispatchPaths {
        self.arg0.paths()
    }
}

pub enum TestBinaryDispatchMode {
    DispatchArg0Only,
    Skip,
    InstallAliases,
}

pub fn configure_test_binary_dispatch<F>(
    workx_home_prefix: &str,
    classify: F,
) -> Option<TestBinaryDispatchGuard>
where
    F: FnOnce(&str, Option<&str>) -> TestBinaryDispatchMode,
{
    let mut args = std::env::args_os();
    let argv0 = args.next().unwrap_or_default();
    let exe_name = Path::new(&argv0)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("");
    let argv1 = args.next();
    match classify(exe_name, argv1.as_deref().and_then(|arg| arg.to_str())) {
        TestBinaryDispatchMode::DispatchArg0Only => {
            let _ = arg0_dispatch();
            None
        }
        TestBinaryDispatchMode::Skip => None,
        TestBinaryDispatchMode::InstallAliases => {
            let workx_home = match tempfile::Builder::new().prefix(workx_home_prefix).tempdir() {
                Ok(workx_home) => workx_home,
                Err(error) => panic!("failed to create test WORKX_HOME: {error}"),
            };
            let previous_workx_home = std::env::var_os("WORKX_HOME");
            // Safety: this runs from a test ctor before test threads begin.
            unsafe {
                std::env::set_var("WORKX_HOME", workx_home.path());
            }

            let arg0 = match arg0_dispatch() {
                Some(arg0) => arg0,
                None => panic!("failed to configure arg0 dispatch aliases for test binary"),
            };
            match previous_workx_home.as_ref() {
                Some(value) => unsafe {
                    std::env::set_var("WORKX_HOME", value);
                },
                None => unsafe {
                    std::env::remove_var("WORKX_HOME");
                },
            }

            Some(TestBinaryDispatchGuard {
                _workx_home: workx_home,
                arg0,
                _previous_workx_home: previous_workx_home,
            })
        }
    }
}
