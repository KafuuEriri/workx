use anyhow::Context;
use anyhow::Result;
use workx_cloud_config::cloud_config_bundle_loader_for_storage;
use workx_config::CloudConfigBundleLoader;
use workx_config::ConfigLoadOptions;
use workx_core::config::Config;
use workx_core::config::ConfigBuilder;
use workx_core::config::LoaderOverrides;
use workx_core::config::bootstrap_auth_config;
use workx_core::config::find_workx_home;
use workx_core::config::load_config_toml_with_layer_stack;
use workx_utils_absolute_path::AbsolutePathBuf;
use workx_utils_cli::CliConfigOverrides;

pub(crate) async fn load_config(
    config_overrides: &CliConfigOverrides,
    loader_overrides: LoaderOverrides,
) -> Result<Config> {
    config_builder(config_overrides, loader_overrides)
        .await?
        .build()
        .await
        .context("failed to load configuration")
}

pub(crate) async fn config_builder(
    config_overrides: &CliConfigOverrides,
    loader_overrides: LoaderOverrides,
) -> Result<ConfigBuilder> {
    let cli_overrides = config_overrides
        .parse_overrides()
        .map_err(anyhow::Error::msg)?;
    let workx_home = find_workx_home().context("failed to resolve WORKX_HOME")?;
    let cwd = AbsolutePathBuf::current_dir().context("failed to resolve current directory")?;
    let bootstrap_config = load_config_toml_with_layer_stack(
        workx_home.as_path(),
        Some(&cwd),
        cli_overrides.clone(),
        ConfigLoadOptions {
            loader_overrides: loader_overrides.clone(),
            strict_config: false,
            cloud_config_bundle: CloudConfigBundleLoader::default(),
        },
    )
    .await
    .context("failed to load bootstrap configuration")?;
    let cloud_config_bundle = cloud_config_bundle_loader_for_storage(
        bootstrap_auth_config(workx_home.as_path(), &bootstrap_config)
            .context("failed to resolve cloud configuration authentication")?,
        /*enable_workx_api_key_env*/ false,
    )
    .await
    .context("failed to initialize cloud configuration authentication")?;

    Ok(ConfigBuilder::default()
        .workx_home(workx_home.to_path_buf())
        .cli_overrides(cli_overrides)
        .loader_overrides(loader_overrides)
        .cloud_config_bundle(cloud_config_bundle)
        .fallback_cwd(Some(cwd.to_path_buf())))
}
