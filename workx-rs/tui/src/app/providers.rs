use super::*;
use crate::config_update::replace_config_value;
use crate::config_update::write_config_batch;
use workx_models_manager::manager::RefreshStrategy;

impl App {
    pub(super) async fn save_provider(
        &mut self,
        tui: &mut tui::Tui,
        app_server: &mut AppServerSession,
        id: String,
        provider: ModelProviderInfo,
        model: Option<String>,
    ) -> Result<()> {
        if provider.uses_external_models()
            && self.config.forced_login_method
                == Some(workx_protocol::config_types::ForcedLoginMethod::Chatgpt)
        {
            return Err(color_eyre::eyre::eyre!(
                "Custom provider setup is disabled by the login policy."
            ));
        }
        let mut selected_model = model;
        let mut catalog = None;
        if provider.uses_external_models() {
            let runtime = create_model_provider(provider.clone(), None);
            let manager = runtime.models_manager_without_cache(None);
            let models = manager
                .list_models(RefreshStrategy::Online, self.config.http_client_factory())
                .await;
            if models.is_empty() {
                return Err(color_eyre::eyre::eyre!(
                    "The models endpoint returned no usable models or could not be reached. Check the URL and API key in /provider."
                ));
            }
            if let Some(model) = &selected_model {
                if !models.iter().any(|preset| &preset.model == model) {
                    return Err(color_eyre::eyre::eyre!(
                        "The selected model is absent from this provider's model catalog."
                    ));
                }
            } else {
                selected_model = models.first().map(|preset| preset.model.clone());
            }
            catalog = Some(models);
        }
        let mut edits = vec![
            replace_config_value("model_provider", serde_json::json!(id)),
            replace_config_value("model", serde_json::json!(selected_model)),
            replace_config_value("model_reasoning_effort", serde_json::Value::Null),
            replace_config_value("service_tier", serde_json::Value::Null),
        ];
        if provider.uses_external_models() {
            let mut definition = serde_json::to_value(provider)?;
            if let Some(fields) = definition.as_object_mut() {
                fields.retain(|_, value| !value.is_null());
            }
            edits.push(replace_config_value(
                format!("model_providers.{id}"),
                definition,
            ));
        }
        write_config_batch(app_server.request_handle(), edits).await?;
        self.refresh_in_memory_config_from_disk().await?;
        if self.config.model_provider_id != id {
            return Err(color_eyre::eyre::eyre!(
                "Provider was saved, but a profile or command-line override keeps another provider active."
            ));
        }
        let models = match catalog {
            Some(models) => models,
            None => {
                let response = app_server
                    .request_handle()
                    .request_typed::<workx_app_server_protocol::ModelListResponse>(
                        workx_app_server_protocol::ClientRequest::ModelList {
                            request_id: workx_app_server_protocol::RequestId::String(format!(
                                "provider-models-{}",
                                uuid::Uuid::new_v4()
                            )),
                            params: workx_app_server_protocol::ModelListParams {
                                cursor: None,
                                limit: None,
                                include_hidden: Some(true),
                            },
                        },
                    )
                    .await?;
                response
                    .data
                    .into_iter()
                    .map(crate::app_server_session::model_preset_from_api_model)
                    .collect()
            }
        };
        self.model_catalog = Arc::new(ModelCatalog::new(models.clone()));
        app_server.set_available_models(models);
        self.chat_widget.set_service_tier(None);
        self.start_fresh_session_with_summary_hint(tui, app_server, None, None, None)
            .await;
        self.chat_widget.open_model_popup();
        Ok(())
    }
}
