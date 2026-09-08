//! 供应商保存回归测试：模型发现提供默认值，显式模型 ID 不受目录限制。

use super::*;
use pretty_assertions::assert_eq;
use wiremock::Mock;
use wiremock::MockServer;
use wiremock::ResponseTemplate;
use wiremock::matchers::method;
use wiremock::matchers::path;

/// 验证未公开模型、空目录和不支持模型发现的供应商均可保存并用于新会话。
#[tokio::test]
async fn save_provider_preserves_explicit_model_and_discovers_default() -> Result<()> {
    for (status, data, requested, expected) in [
        (
            200,
            serde_json::json!([{"id": "public-model"}]),
            Some("ds-preview"),
            "ds-preview",
        ),
        (200, serde_json::json!([]), Some("ds-preview"), "ds-preview"),
        (404, serde_json::json!([]), Some("ds-preview"), "ds-preview"),
        (
            200,
            serde_json::json!([{"id": "public-model"}]),
            None,
            "public-model",
        ),
    ] {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/v1/models"))
            .respond_with(
                ResponseTemplate::new(status).set_body_json(serde_json::json!({"data": data})),
            )
            .mount(&server)
            .await;
        let (mut app, _events, _ops) = make_test_app_with_channels().await;
        let mut app_server = start_config_write_test_app_server(&app).await?;
        let mut tui = crate::tui::test_support::make_test_tui()?;
        let provider = serde_json::from_value(serde_json::json!({
            "name": "Preview provider",
            "base_url": format!("{}/v1", server.uri()),
            "wire_api": "chat",
            "experimental_bearer_token": "test-key",
            "requires_openai_auth": false
        }))?;

        Box::pin(app.save_provider(
            &mut tui,
            &mut app_server,
            "preview".to_string(),
            provider,
            requested.map(str::to_string),
        ))
        .await?;

        assert_eq!(
            (
                app.config.model_provider_id.as_str(),
                app.config.model.as_deref()
            ),
            ("preview", Some(expected))
        );
        assert_eq!(app.chat_widget.current_model(), expected);
        if status == 200 && requested.is_some() && !data.as_array().unwrap().is_empty() {
            insta::assert_snapshot!(
                "provider_saved_with_unlisted_model",
                render_bottom_popup(&app.chat_widget, /*width*/ 80)
            );
        }
        let saved: toml::Value = toml::from_str(&std::fs::read_to_string(
            app.config.workx_home.join("config.toml"),
        )?)?;
        assert_eq!(saved["model"].as_str(), Some(expected));
    }
    Ok(())
}
