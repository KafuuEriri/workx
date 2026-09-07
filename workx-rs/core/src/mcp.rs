use std::collections::HashMap;
use std::sync::Arc;

use crate::config::Config;
use crate::environment_selection::ThreadEnvironments;
use workx_config::DEFAULT_MCP_SERVER_ENVIRONMENT_ID;
use workx_config::McpServerConfig;
use workx_connectors::ConnectorRuntimeManager;
use workx_connectors::ConnectorSnapshot;
use workx_connectors::PluginConnectorSource;
use workx_core_plugins::PluginsManager;
use workx_exec_server::ExecutorCapabilityDiscoverySnapshot;
use workx_extension_api::ExtensionData;
use workx_extension_api::ExtensionDataInit;
use workx_extension_api::ExtensionRegistry;
use workx_extension_api::McpServerContribution;
use workx_extension_api::McpServerContributionContext;
use workx_extension_api::SelectedPluginIdentity;
use workx_extension_api::SelectedPluginSnapshot;
use workx_features::Feature;
use workx_login::WorkxAuth;
use workx_mcp::EffectiveMcpServer;
use workx_mcp::McpConfig;
use workx_mcp::McpEnvironmentAuthority;
use workx_mcp::McpPluginAttribution;
use workx_mcp::McpServerRegistration;
use workx_mcp::McpToolCatalogCache;
use workx_mcp::ToolInfo;
use workx_mcp::WORKX_APPS_MCP_SERVER_NAME;
use workx_mcp::configured_mcp_servers;
use workx_mcp::effective_mcp_servers;
use workx_mcp::workx_apps_mcp_server_config;
use workx_plugin::AppConnectorId;
use workx_protocol::capabilities::SelectedCapabilityRoot;
use workx_protocol::protocol::EnvironmentConfigState;
use workx_protocol::protocol::SessionSource;
use workx_protocol::protocol::TurnEnvironmentSelection;

const LEGACY_WORKX_APPS_REGISTRATION_ID: &str = "legacy_workx_apps";

/// MCP configuration and capability availability derived from the same inputs.
#[derive(Clone)]
pub(crate) struct McpRuntimeProjection {
    pub(crate) config: McpConfig,
    pub(crate) plugins_available: bool,
    pub(crate) selected_plugins: SelectedPluginSnapshot,
}

pub(crate) enum McpEnvironmentScope<'a> {
    /// Controller-level operations without an associated thread.
    HostOnly,
    /// Initial thread selections before the live environment store exists.
    Initial(&'a [TurnEnvironmentSelection]),
    /// Current attachment state for an existing thread.
    Live(&'a ThreadEnvironments),
}

pub(crate) struct McpThreadIdentity<'a> {
    pub(crate) session_source: &'a SessionSource,
    pub(crate) originator: &'a str,
    pub(crate) environments: McpEnvironmentScope<'a>,
}

enum OrderedMcpOverlay {
    Set(Box<McpServerRegistration>),
    Remove {
        contributor_id: &'static str,
        contribution_order: usize,
        name: String,
    },
}

#[derive(Clone)]
pub struct McpManager {
    plugins_manager: Arc<PluginsManager>,
    extensions: Arc<ExtensionRegistry<Config>>,
    workx_apps_tools_cache: ConnectorRuntimeManager<ToolInfo>,
    tool_catalog_cache: McpToolCatalogCache,
}

impl McpManager {
    pub fn new(plugins_manager: Arc<PluginsManager>) -> Self {
        Self::new_with_extensions(
            plugins_manager,
            workx_extension_api::empty_extension_registry(),
            ConnectorRuntimeManager::default(),
        )
    }

    /// Creates a manager that resolves host-installed MCP contributions.
    pub fn new_with_extensions(
        plugins_manager: Arc<PluginsManager>,
        extensions: Arc<ExtensionRegistry<Config>>,
        workx_apps_tools_cache: ConnectorRuntimeManager<ToolInfo>,
    ) -> Self {
        Self {
            plugins_manager,
            extensions,
            workx_apps_tools_cache,
            tool_catalog_cache: McpToolCatalogCache::default(),
        }
    }

    pub fn workx_apps_tools_cache(&self) -> ConnectorRuntimeManager<ToolInfo> {
        self.workx_apps_tools_cache.clone()
    }

    pub fn tool_catalog_cache(&self) -> McpToolCatalogCache {
        self.tool_catalog_cache.clone()
    }

    /// Returns the MCP config after applying compatibility built-ins and
    /// runtime-only extension overlays.
    pub async fn runtime_config(&self, config: &Config) -> McpConfig {
        self.runtime_config_with_context(
            McpServerContributionContext::global(config),
            // Threadless discovery and control-plane paths have no effective thread
            // originator; active-thread tool calls use runtime_config_for_step below.
            /*originator*/
            None,
            McpEnvironmentScope::HostOnly,
        )
        .await
        .config
    }

    #[tracing::instrument(name = "mcp.runtime_config.project_for_step", skip_all)]
    pub(crate) async fn runtime_config_for_step(
        &self,
        config: &Config,
        thread_init: &ExtensionDataInit,
        thread_store: &ExtensionData,
        identity: McpThreadIdentity<'_>,
        ready_selected_capability_roots: &[SelectedCapabilityRoot],
        executor_capability_discovery: Option<&ExecutorCapabilityDiscoverySnapshot>,
    ) -> McpRuntimeProjection {
        self.runtime_config_with_context(
            McpServerContributionContext::for_step(
                config,
                thread_init,
                thread_store,
                identity.originator,
                ready_selected_capability_roots,
                executor_capability_discovery,
            )
            .with_session_source(identity.session_source),
            Some(identity.originator),
            identity.environments,
        )
        .await
    }

    async fn runtime_config_with_context(
        &self,
        context: McpServerContributionContext<'_, Config>,
        originator: Option<&str>,
        environment_scope: McpEnvironmentScope<'_>,
    ) -> McpRuntimeProjection {
        let config = context.config();
        let mut selected_plugin_available = false;
        let mut selected_plugin_connector_sources = Vec::new();
        let mut selected_plugin_registrations = Vec::new();
        let mut selected_plugins = Vec::new();
        let mut disabled_plugin_roots = Vec::new();
        let mut overlays = Vec::new();
        // A contributor can emit multiple ordered actions, so order each action globally rather
        // than enumerating contributors.
        let mut contribution_order = 0;
        for contributor in self.extensions.mcp_server_contributors() {
            for contribution in contributor.contribute(context).await {
                match contribution {
                    McpServerContribution::Set { name, config } => {
                        overlays.push(OrderedMcpOverlay::Set(Box::new(
                            McpServerRegistration::from_extension(
                                name,
                                contributor.id(),
                                contribution_order,
                                *config,
                            ),
                        )));
                    }
                    McpServerContribution::HostedApps { config } => {
                        overlays.push(OrderedMcpOverlay::Set(Box::new(
                            McpServerRegistration::from_hosted_apps(
                                contributor.id(),
                                contribution_order,
                                *config,
                            ),
                        )));
                    }
                    McpServerContribution::SelectedPlugin {
                        name,
                        plugin_id,
                        plugin_display_name,
                        selection_order,
                        config,
                    } => selected_plugin_registrations.push(
                        McpServerRegistration::from_selected_plugin(
                            name,
                            McpPluginAttribution::new(plugin_id, plugin_display_name),
                            selection_order,
                            *config,
                        ),
                    ),
                    McpServerContribution::SelectedPluginPackage {
                        selected_root_id, ..
                    } if !config.features.enabled(Feature::Plugins) => {
                        disabled_plugin_roots.push(selected_root_id);
                    }
                    McpServerContribution::SelectedPluginPackage {
                        selected_root_id,
                        plugin_id,
                        plugin_display_name,
                        connector_ids,
                    } => {
                        selected_plugin_available = true;
                        selected_plugins.push(SelectedPluginIdentity {
                            selected_root_id,
                            plugin_id: plugin_id.clone(),
                        });
                        if !connector_ids.is_empty() {
                            selected_plugin_connector_sources.push(
                                PluginConnectorSource::from_connector_ids(
                                    plugin_id,
                                    plugin_display_name,
                                    connector_ids.into_iter().map(AppConnectorId),
                                ),
                            );
                        }
                    }
                    McpServerContribution::Remove { name } => {
                        overlays.push(OrderedMcpOverlay::Remove {
                            contributor_id: contributor.id(),
                            contribution_order,
                            name,
                        });
                    }
                }
                contribution_order += 1;
            }
        }

        let loaded_plugins = self
            .plugins_manager
            .plugins_for_config(&config.plugins_config_input())
            .await;
        let plugins_available =
            selected_plugin_available || !loaded_plugins.capability_summaries().is_empty();
        let mut mcp_config = config
            .to_mcp_config_with_loaded_plugins(&loaded_plugins, selected_plugin_registrations);
        let mut catalog = mcp_config.mcp_server_catalog.to_builder();
        if mcp_config.apps_enabled {
            catalog.register(McpServerRegistration::from_compatibility(
                WORKX_APPS_MCP_SERVER_NAME.to_string(),
                LEGACY_WORKX_APPS_REGISTRATION_ID,
                workx_apps_mcp_server_config(
                    &mcp_config.chatgpt_base_url,
                    mcp_config.apps_mcp_product_sku.as_deref(),
                    originator,
                ),
            ));
        } else {
            catalog.remove_compatibility(
                WORKX_APPS_MCP_SERVER_NAME.to_string(),
                LEGACY_WORKX_APPS_REGISTRATION_ID,
            );
        }

        for overlay in overlays {
            match overlay {
                OrderedMcpOverlay::Set(registration) => catalog.register(*registration),
                OrderedMcpOverlay::Remove {
                    contributor_id,
                    contribution_order,
                    name,
                } => catalog.remove_extension(name, contributor_id, contribution_order),
            }
        }
        let selections = match environment_scope {
            McpEnvironmentScope::HostOnly => None,
            McpEnvironmentScope::Initial(selections) => Some(selections.to_vec()),
            McpEnvironmentScope::Live(environments) => Some(environments.selections()),
        };
        let catalog = catalog.build_with_environment_authority(|environment_id| {
            let Some(selections) = selections.as_ref() else {
                return McpEnvironmentAuthority::Unrestricted;
            };
            let Some(selection) = selections
                .iter()
                .find(|selection| selection.environment_id == environment_id)
            else {
                return if environment_id == DEFAULT_MCP_SERVER_ENVIRONMENT_ID {
                    McpEnvironmentAuthority::Unrestricted
                } else {
                    McpEnvironmentAuthority::SelectedPluginsOnly
                };
            };

            match &selection.config {
                EnvironmentConfigState::FromThread => McpEnvironmentAuthority::Unrestricted,
                EnvironmentConfigState::Pending | EnvironmentConfigState::Failed(_) => {
                    McpEnvironmentAuthority::Unavailable
                }
                EnvironmentConfigState::Ready(config) => config
                    .mcp_policy
                    .as_ref()
                    .map_or(McpEnvironmentAuthority::Unrestricted, |policy| {
                        McpEnvironmentAuthority::Restricted(policy)
                    }),
            }
        });
        for conflict in catalog.conflicts() {
            tracing::warn!(
                server = conflict.name,
                outcome = ?conflict.outcome,
                contenders = ?conflict.contenders,
                "conflicting MCP server actions; using resolved catalog outcome"
            );
        }
        mcp_config.mcp_server_catalog = catalog;
        mcp_config.connector_snapshot =
            mcp_config
                .connector_snapshot
                .merged_with(&ConnectorSnapshot::from_plugin_sources(
                    selected_plugin_connector_sources,
                ));
        McpRuntimeProjection {
            config: mcp_config,
            plugins_available,
            selected_plugins: SelectedPluginSnapshot {
                plugins: selected_plugins,
                disabled_plugin_roots,
            },
        }
    }

    /// Returns config- and plugin-backed servers without runtime contributions.
    pub async fn configured_servers(&self, config: &Config) -> HashMap<String, McpServerConfig> {
        let mcp_config = config.to_mcp_config(self.plugins_manager.as_ref()).await;
        configured_mcp_servers(&mcp_config)
    }

    /// Returns configured and host-contributed servers before auth gating.
    pub async fn runtime_servers(&self, config: &Config) -> HashMap<String, McpServerConfig> {
        let mcp_config = self.runtime_config(config).await;
        configured_mcp_servers(&mcp_config)
    }

    /// Returns runtime servers after auth gating and compatibility built-ins.
    pub async fn effective_servers(
        &self,
        config: &Config,
        auth: Option<&WorkxAuth>,
    ) -> HashMap<String, EffectiveMcpServer> {
        let mcp_config = self.runtime_config(config).await;
        effective_mcp_servers(&mcp_config, auth)
    }
}
