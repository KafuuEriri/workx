use std::sync::Arc;

use pretty_assertions::assert_eq;
use workx_config::McpServerTransportConfig;
use workx_core::McpManager;
use workx_core::config::Config;
use workx_core::config::ConfigBuilder;
use workx_core::plugins_manager_for_config;
use workx_extension_api::ExtensionRegistryBuilder;
use workx_extension_api::McpServerContribution;
use workx_extension_api::McpServerContributionContext;
use workx_extension_api::McpServerContributor;
use workx_login::AuthManager;
use workx_login::WorkxAuth;
use workx_login::test_support::auth_manager_from_optional_auth;
use workx_mcp::WORKX_APPS_MCP_SERVER_NAME;

type TestResult = Result<(), Box<dyn std::error::Error>>;

#[tokio::test]
async fn contributes_hosted_plugin_runtime_without_an_executor() -> TestResult {
    let workx_home = tempfile::tempdir()?;
    let config = ConfigBuilder::default()
        .workx_home(workx_home.path().to_path_buf())
        .fallback_cwd(Some(workx_home.path().to_path_buf()))
        .cli_overrides(vec![
            ("features.apps".to_string(), true.into()),
            ("chatgpt_base_url".to_string(), "https://chatgpt.com".into()),
        ])
        .build()
        .await?;
    let auth = WorkxAuth::create_dummy_chatgpt_auth_for_testing();
    let manager = installed_manager(&config, Some(auth.clone()));

    let servers = manager.effective_servers(&config, Some(&auth)).await;
    let server = servers
        .get(WORKX_APPS_MCP_SERVER_NAME)
        .ok_or("hosted plugin runtime should be contributed as a configured server")?
        .config();
    let McpServerTransportConfig::StreamableHttp { url, .. } = &server.transport else {
        panic!("hosted plugin runtime should use streamable HTTP");
    };
    assert_eq!(url, "https://chatgpt.com/backend-api/ps/mcp");

    Ok(())
}

#[tokio::test]
async fn runtime_overlay_preserves_disabled_server() -> TestResult {
    let workx_home = tempfile::tempdir()?;
    let config = ConfigBuilder::default()
        .workx_home(workx_home.path().to_path_buf())
        .fallback_cwd(Some(workx_home.path().to_path_buf()))
        .cli_overrides(vec![
            ("features.apps".to_string(), true.into()),
            (
                "mcp_servers.workx_apps.url".to_string(),
                "https://example.com/mcp".into(),
            ),
            ("mcp_servers.workx_apps.enabled".to_string(), false.into()),
        ])
        .build()
        .await?;
    let auth = WorkxAuth::create_dummy_chatgpt_auth_for_testing();
    let manager = installed_manager(&config, Some(auth.clone()));

    let servers = manager.effective_servers(&config, Some(&auth)).await;
    let server = servers
        .get(WORKX_APPS_MCP_SERVER_NAME)
        .ok_or("hosted plugin runtime should remain configured")?;

    assert!(!server.enabled());
    Ok(())
}

#[tokio::test]
async fn default_fallback_overwrites_reserved_config_without_an_extension() -> TestResult {
    let workx_home = tempfile::tempdir()?;
    let config = ConfigBuilder::default()
        .workx_home(workx_home.path().to_path_buf())
        .fallback_cwd(Some(workx_home.path().to_path_buf()))
        .cli_overrides(vec![
            ("features.apps".to_string(), true.into()),
            (
                "mcp_servers.workx_apps.url".to_string(),
                "https://example.com/mcp".into(),
            ),
        ])
        .build()
        .await?;
    let auth = WorkxAuth::create_dummy_chatgpt_auth_for_testing();
    let manager = McpManager::new(Arc::new(plugins_manager_for_config(
        &config,
        AuthManager::from_auth_for_testing(auth.clone()),
    )));

    let servers = manager.effective_servers(&config, Some(&auth)).await;
    let server = servers
        .get(WORKX_APPS_MCP_SERVER_NAME)
        .ok_or("default Apps MCP should be present")?
        .config();
    let McpServerTransportConfig::StreamableHttp { url, .. } = &server.transport else {
        panic!("default Apps MCP should use streamable HTTP");
    };
    assert_eq!(url, "https://chatgpt.com/backend-api/ps/mcp");

    Ok(())
}

#[tokio::test]
async fn later_extension_can_remove_same_name_registration() -> TestResult {
    let workx_home = tempfile::tempdir()?;
    let config = ConfigBuilder::default()
        .workx_home(workx_home.path().to_path_buf())
        .fallback_cwd(Some(workx_home.path().to_path_buf()))
        .cli_overrides(vec![("features.apps".to_string(), true.into())])
        .build()
        .await?;
    let auth = WorkxAuth::create_dummy_chatgpt_auth_for_testing();
    let mut builder = ExtensionRegistryBuilder::new();
    workx_mcp_extension::install(&mut builder);
    builder.mcp_server_contributor(Arc::new(RemoveWorkxApps));
    let manager = McpManager::new_with_extensions(
        Arc::new(plugins_manager_for_config(
            &config,
            AuthManager::from_auth_for_testing(auth.clone()),
        )),
        Arc::new(builder.build()),
        workx_core::WorkxAppsToolsCache::default(),
    );

    let servers = manager.effective_servers(&config, Some(&auth)).await;

    assert!(!servers.contains_key(WORKX_APPS_MCP_SERVER_NAME));
    Ok(())
}

#[tokio::test]
async fn hosted_apps_mcp_requires_chatgpt_auth() -> TestResult {
    let workx_home = tempfile::tempdir()?;
    let config = ConfigBuilder::default()
        .workx_home(workx_home.path().to_path_buf())
        .fallback_cwd(Some(workx_home.path().to_path_buf()))
        .cli_overrides(vec![("features.apps".to_string(), true.into())])
        .build()
        .await?;
    let auth = WorkxAuth::from_api_key("test");
    let manager = installed_manager(&config, Some(auth.clone()));

    let servers = manager.effective_servers(&config, Some(&auth)).await;
    assert!(!servers.contains_key(WORKX_APPS_MCP_SERVER_NAME));

    Ok(())
}

#[tokio::test]
async fn disabled_apps_remove_reserved_server_config_for_all_hosts() -> TestResult {
    let workx_home = tempfile::tempdir()?;
    let config = ConfigBuilder::default()
        .workx_home(workx_home.path().to_path_buf())
        .fallback_cwd(Some(workx_home.path().to_path_buf()))
        .cli_overrides(vec![
            ("features.apps".to_string(), false.into()),
            (
                "mcp_servers.workx_apps.url".to_string(),
                "https://example.com/mcp".into(),
            ),
        ])
        .build()
        .await?;
    let managers = [
        installed_manager(&config, /*auth*/ None),
        McpManager::new(Arc::new(plugins_manager_for_config(
            &config,
            auth_manager_from_optional_auth(/*auth*/ None),
        ))),
    ];
    for manager in managers {
        let servers = manager.runtime_servers(&config).await;
        assert!(!servers.contains_key(WORKX_APPS_MCP_SERVER_NAME));
    }
    Ok(())
}

fn installed_manager(config: &Config, auth: Option<WorkxAuth>) -> McpManager {
    let mut builder = ExtensionRegistryBuilder::new();
    workx_mcp_extension::install(&mut builder);
    McpManager::new_with_extensions(
        Arc::new(plugins_manager_for_config(
            config,
            auth_manager_from_optional_auth(auth),
        )),
        Arc::new(builder.build()),
        workx_core::WorkxAppsToolsCache::default(),
    )
}

struct RemoveWorkxApps;

impl McpServerContributor<Config> for RemoveWorkxApps {
    fn id(&self) -> &'static str {
        "remove_workx_apps"
    }

    fn contribute<'a>(
        &'a self,
        _context: McpServerContributionContext<'a, Config>,
    ) -> workx_extension_api::ExtensionFuture<'a, Vec<McpServerContribution>> {
        Box::pin(async move {
            vec![McpServerContribution::Remove {
                name: WORKX_APPS_MCP_SERVER_NAME.to_string(),
            }]
        })
    }
}
