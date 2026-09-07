use anyhow::Result;
use predicates::str::contains;
use std::path::Path;
use tempfile::TempDir;

fn workx_command(workx_home: &Path) -> Result<assert_cmd::Command> {
    let mut cmd = assert_cmd::Command::new(workx_utils_cargo_bin::cargo_bin("workx")?);
    cmd.env("WORKX_HOME", workx_home);
    Ok(cmd)
}

#[cfg(debug_assertions)]
#[tokio::test]
async fn update_does_not_start_interactive_prompt() -> Result<()> {
    let workx_home = TempDir::new()?;

    workx_command(workx_home.path())?
        .arg("update")
        .assert()
        .failure()
        .stderr(contains("`workx update` is not available in debug builds"));

    Ok(())
}
