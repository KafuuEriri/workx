use super::auth::AuthModeWidget;
use super::auth::SignInState;
use super::keys;
use crate::config_update::replace_config_value;
use crate::config_update::write_config_batch;
use crate::key_hint::KeyBindingListExt;
use crossterm::event::KeyCode;
use crossterm::event::KeyEvent;
use crossterm::event::KeyModifiers;
use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use ratatui::style::Stylize;
use ratatui::text::Line;
use ratatui::widgets::Paragraph;
use ratatui::widgets::Widget;
use ratatui::widgets::Wrap;
use serde_json::json;
use workx_model_provider_info::WireApi;

/// Provider selection and endpoint configuration before provider-owned authentication.
/// 在 provider 认证前完成 provider 选择和端点配置。
#[derive(Clone)]
pub(super) enum ProviderSetup {
    Select(usize),
    Configure {
        protocol: WireApi,
        values: [String; 4],
        field: usize,
    },
    Saving,
}

impl ProviderSetup {
    pub(super) fn is_text_entry(&self) -> bool {
        matches!(self, Self::Configure { .. })
    }

    pub(super) fn paste(&mut self, text: &str) {
        if let Self::Configure { values, field, .. } = self {
            values[*field].extend(text.chars().filter(|c| !c.is_control()));
        }
    }

    pub(super) fn render(&self, area: Rect, buf: &mut Buffer, error: Option<String>) {
        let mut lines: Vec<Line> = vec!["  Choose a model provider".bold().into(), "".into()];
        match self {
            Self::Select(selected) => {
                for (index, label) in [
                    "OpenAI — ChatGPT, device code, or API key",
                    "Custom endpoint — Responses (default)",
                    "Custom endpoint — detect protocol from URL",
                    "Chat Completions-compatible endpoint",
                ]
                .iter()
                .enumerate()
                {
                    let line = format!(
                        "{} {}. {label}",
                        if index == *selected { ">" } else { " " },
                        index + 1
                    );
                    lines.push(if index == *selected {
                        line.cyan().into()
                    } else {
                        line.into()
                    });
                    lines.push("".into());
                }
                lines.push("  ↑/↓ choose · Enter continue".dim().into());
            }
            Self::Configure {
                protocol,
                values,
                field,
            } => {
                lines.push(format!("  Protocol: {protocol}").into());
                lines.push("".into());
                for (index, label) in [
                    "Base URL or complete endpoint URL",
                    "Model ID (optional; otherwise use the fetched list)",
                    "API key (optional, saved locally)",
                    "Models endpoint (default /v1/models)",
                ]
                .iter()
                .enumerate()
                {
                    lines.push(format!("  {label}").into());
                    let value = format!(
                        "{} {}",
                        if index == *field { ">" } else { " " },
                        if index == 2 {
                            "•".repeat(values[index].chars().count().min(24))
                        } else {
                            values[index].clone()
                        }
                    );
                    lines.push(if index == *field {
                        value.cyan().into()
                    } else {
                        value.into()
                    });
                    lines.push("".into());
                }
                lines.push(
                    "  The API key is saved locally and hidden in this screen."
                        .dim()
                        .into(),
                );
                lines.push(
                    "  Auto: /chat/completions selects Chat; other URLs use Responses."
                        .dim()
                        .into(),
                );
                lines.push(
                    "  Tab/↑/↓ switch field · Enter continue/save · Esc back"
                        .dim()
                        .into(),
                );
            }
            Self::Saving => lines.push("  Saving provider configuration…".into()),
        }
        if let Some(error) = error {
            lines.push(error.red().into());
        }
        Paragraph::new(lines)
            .wrap(Wrap { trim: false })
            .render(area, buf);
    }
}

impl AuthModeWidget {
    pub(super) fn handle_provider_key_event(&mut self, key: &KeyEvent) -> bool {
        let state = self
            .sign_in_state
            .read()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .clone();
        let SignInState::Provider(mut setup) = state else {
            return false;
        };
        if let ProviderSetup::Select(selected) = &mut setup {
            if keys::MOVE_UP.is_pressed(*key) {
                *selected = (*selected + 3) % 4;
            } else if keys::MOVE_DOWN.is_pressed(*key) {
                *selected = (*selected + 1) % 4;
            }
            let digit = match key.code {
                KeyCode::Char(c @ '1'..='4') => Some(c as usize - '1' as usize),
                _ => None,
            };
            if let Some(index) = digit {
                *selected = index;
            }
            if keys::CONFIRM.is_pressed(*key) || digit.is_some() {
                if *selected == 0 {
                    *self
                        .sign_in_state
                        .write()
                        .unwrap_or_else(std::sync::PoisonError::into_inner) = SignInState::PickMode;
                    self.request_frame.schedule_frame();
                    return true;
                }
                if !self
                    .auth_config
                    .is_login_method_allowed(workx_protocol::config_types::ForcedLoginMethod::Api)
                {
                    *self
                        .error
                        .write()
                        .unwrap_or_else(std::sync::PoisonError::into_inner) =
                        Some("Custom provider setup is disabled by the login policy.".to_string());
                } else {
                    let protocol = match *selected {
                        1 => WireApi::Responses,
                        3 => WireApi::ChatCompletions,
                        _ => WireApi::Auto,
                    };
                    setup = ProviderSetup::Configure {
                        protocol,
                        values: Default::default(),
                        field: 0,
                    };
                }
            }
        } else if let ProviderSetup::Configure {
            protocol,
            values,
            field,
        } = &mut setup
        {
            if keys::CANCEL.is_pressed(*key) {
                setup = ProviderSetup::Select(0);
            } else if matches!(key.code, KeyCode::Tab | KeyCode::Down) {
                *field = (*field + 1) % 4;
            } else if matches!(key.code, KeyCode::BackTab | KeyCode::Up) {
                *field = (*field + 3) % 4;
            } else if key.code == KeyCode::Backspace {
                values[*field].pop();
            } else if key.code == KeyCode::Enter {
                if *field < 3 {
                    *field += 1;
                } else {
                    let uri = values[0].trim();
                    let model = values[1].trim();
                    let api_key = values[2].trim();
                    let models_endpoint = if values[3].trim().is_empty() {
                        "/v1/models"
                    } else {
                        values[3].trim()
                    };
                    let url = url::Url::parse(uri);
                    let error = if !url.as_ref().is_ok_and(|url| {
                        matches!(url.scheme(), "http" | "https")
                            && url.host_str().is_some()
                            && url.username().is_empty()
                            && url.password().is_none()
                            && url.query().is_none()
                            && url.fragment().is_none()
                    }) {
                        Some(
                            "Enter an HTTP(S) URL without embedded credentials, query parameters, or fragments.",
                        )
                    } else if !(models_endpoint.starts_with('/')
                        || models_endpoint.starts_with("https://")
                        || models_endpoint.starts_with("http://"))
                    {
                        Some("Enter an absolute models path or HTTP(S) URL.")
                    } else {
                        None
                    };
                    if let Some(error) = error {
                        *self
                            .error
                            .write()
                            .unwrap_or_else(std::sync::PoisonError::into_inner) =
                            Some(error.to_string());
                    } else {
                        let mut provider = json!({"name": "Custom endpoint", "base_url": uri, "wire_api": protocol, "requires_openai_auth": false, "models_endpoint": models_endpoint});
                        if !api_key.is_empty() {
                            provider["experimental_bearer_token"] = json!(api_key);
                        }
                        let edits = vec![
                            replace_config_value("model_provider", json!("custom")),
                            replace_config_value(
                                "model",
                                json!((!model.is_empty()).then_some(model)),
                            ),
                            replace_config_value("model_providers.custom", provider),
                        ];
                        let handle = self.app_server_request_handle.clone();
                        let sign_in_state = self.sign_in_state.clone();
                        let errors = self.error.clone();
                        let request_frame = self.request_frame.clone();
                        let retry = setup.clone();
                        *self
                            .sign_in_state
                            .write()
                            .unwrap_or_else(std::sync::PoisonError::into_inner) =
                            SignInState::Provider(ProviderSetup::Saving);
                        tokio::spawn(async move {
                            match write_config_batch(handle, edits).await {
                                Ok(_) => {
                                    *sign_in_state
                                        .write()
                                        .unwrap_or_else(std::sync::PoisonError::into_inner) =
                                        SignInState::ProviderConfigured
                                }
                                Err(err) => {
                                    *errors
                                        .write()
                                        .unwrap_or_else(std::sync::PoisonError::into_inner) =
                                        Some(format!("Could not save provider: {err}"));
                                    *sign_in_state
                                        .write()
                                        .unwrap_or_else(std::sync::PoisonError::into_inner) =
                                        SignInState::Provider(retry);
                                }
                            }
                            request_frame.schedule_frame();
                        });
                        self.request_frame.schedule_frame();
                        return true;
                    }
                }
            } else if let KeyCode::Char(c) = key.code
                && !key
                    .modifiers
                    .intersects(KeyModifiers::CONTROL | KeyModifiers::ALT)
            {
                values[*field].push(c);
            }
        }
        *self
            .sign_in_state
            .write()
            .unwrap_or_else(std::sync::PoisonError::into_inner) = SignInState::Provider(setup);
        self.request_frame.schedule_frame();
        true
    }
}

#[cfg(test)]
#[path = "provider_tests.rs"]
mod tests;
