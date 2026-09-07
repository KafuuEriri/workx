use super::ProviderSetup;
use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use workx_model_provider_info::WireApi;

fn render(state: &ProviderSetup) -> String {
    let area = Rect::new(0, 0, 96, 24);
    let mut buffer = Buffer::empty(area);
    state.render(area, &mut buffer, None);
    let mut lines = (0..area.height)
        .map(|row| {
            (0..area.width)
                .map(|column| buffer[(column, row)].symbol())
                .collect::<String>()
                .trim_end()
                .to_string()
        })
        .collect::<Vec<_>>();
    while lines.last().is_some_and(String::is_empty) {
        lines.pop();
    }
    lines.join("\n")
}

#[test]
fn provider_selection_snapshot() {
    insta::assert_snapshot!(render(&ProviderSetup::Select(0)));
}

#[test]
fn custom_provider_configuration_snapshot() {
    insta::assert_snapshot!(render(&ProviderSetup::Configure {
        protocol: WireApi::ChatCompletions,
        values: [
            "https://gateway.example/v1".to_string(),
            "my-model".to_string(),
            "secret-test-key".to_string(),
            "/v1/models".to_string()
        ],
        field: 2,
    }));
}

#[test]
fn provider_fields_accept_paste_without_control_characters() {
    let mut state = ProviderSetup::Configure {
        protocol: WireApi::Auto,
        values: Default::default(),
        field: 0,
    };
    state.paste("https://gateway.example/v1\n\r");
    assert!(state.is_text_entry());
    let ProviderSetup::Configure { values, .. } = state else {
        panic!("expected configuration")
    };
    pretty_assertions::assert_eq!(values[0], "https://gateway.example/v1");
}

#[tokio::test]
async fn provider_setup_persists_configuration_and_reports_write_failures() {
    use crate::onboarding::auth::SignInState;
    use crossterm::event::KeyCode;
    use crossterm::event::KeyEvent;
    use crossterm::event::KeyModifiers;
    use std::time::Duration;
    for fail_write in [false, true] {
        let (mut widget, home) = crate::onboarding::auth::tests::widget_forced_chatgpt().await;
        widget.auth_config.forced_login_method = None;
        if fail_write {
            std::fs::create_dir(home.path().join("config.toml")).unwrap();
        }
        *widget.sign_in_state.write().unwrap() = SignInState::Provider(ProviderSetup::Configure {
            protocol: WireApi::ChatCompletions,
            values: [
                "https://gateway.example/v1".to_string(),
                "my-model".to_string(),
                "secret-test-key".to_string(),
                "/catalog".to_string(),
            ],
            field: 3,
        });
        assert!(
            widget.handle_provider_key_event(&KeyEvent::new(KeyCode::Enter, KeyModifiers::NONE))
        );
        tokio::time::timeout(Duration::from_secs(10), async {
            while matches!(
                *widget.sign_in_state.read().unwrap(),
                SignInState::Provider(ProviderSetup::Saving)
            ) {
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .unwrap();
        if fail_write {
            assert!(matches!(
                *widget.sign_in_state.read().unwrap(),
                SignInState::Provider(ProviderSetup::Configure { .. })
            ));
            assert!(
                widget
                    .error
                    .read()
                    .unwrap()
                    .as_ref()
                    .is_some_and(|error| error.contains("Could not save provider"))
            );
        } else {
            assert!(matches!(
                *widget.sign_in_state.read().unwrap(),
                SignInState::ProviderConfigured
            ));
            let config: toml::Value =
                toml::from_str(&std::fs::read_to_string(home.path().join("config.toml")).unwrap())
                    .unwrap();
            pretty_assertions::assert_eq!(config["model"].as_str(), Some("my-model"));
            pretty_assertions::assert_eq!(config["model_provider"].as_str(), Some("custom"));
            pretty_assertions::assert_eq!(
                config["model_providers"]["custom"]["wire_api"].as_str(),
                Some("chat")
            );
            pretty_assertions::assert_eq!(
                config["model_providers"]["custom"]["requires_openai_auth"].as_bool(),
                Some(false)
            );
        }
    }
}

#[tokio::test]
async fn managed_login_policy_prevents_custom_provider_setup() {
    use crate::onboarding::auth::SignInState;
    use crossterm::event::KeyCode;
    use crossterm::event::KeyEvent;
    use crossterm::event::KeyModifiers;
    let (mut widget, _home) = crate::onboarding::auth::tests::widget_forced_chatgpt().await;
    *widget.sign_in_state.write().unwrap() = SignInState::Provider(ProviderSetup::Select(3));
    widget.handle_provider_key_event(&KeyEvent::new(KeyCode::Enter, KeyModifiers::NONE));
    assert!(matches!(
        *widget.sign_in_state.read().unwrap(),
        SignInState::Provider(ProviderSetup::Select(3))
    ));
    assert!(widget.error.read().unwrap().is_some());
}
