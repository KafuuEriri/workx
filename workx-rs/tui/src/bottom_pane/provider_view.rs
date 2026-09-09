use super::BottomPaneView;
use super::CancellationEvent;
use crate::app_event::AppEvent;
use crate::app_event_sender::AppEventSender;
use crate::render::renderable::Renderable;
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
use workx_model_provider_info::ModelProviderInfo;
use workx_model_provider_info::WireApi;

/// Provider 目录及编辑界面；密钥只在编辑状态中保存，渲染时始终遮蔽。
pub(crate) struct ProviderView {
    providers: Vec<(String, ModelProviderInfo)>,
    active: String,
    selected: usize,
    editing: Option<ModelProviderInfo>,
    values: [String; 6],
    field: usize,
    error: Option<String>,
    complete: bool,
    tx: AppEventSender,
}

impl ProviderView {
    pub(crate) fn new(
        providers: std::collections::HashMap<String, ModelProviderInfo>,
        active: String,
        tx: AppEventSender,
    ) -> Self {
        let mut providers: Vec<_> = providers.into_iter().collect();
        providers.sort_by(|a, b| a.0.cmp(&b.0));
        let selected = providers
            .iter()
            .position(|(id, _)| id == &active)
            .unwrap_or_default();
        Self {
            providers,
            active,
            selected,
            editing: None,
            values: Default::default(),
            field: 0,
            error: None,
            complete: false,
            tx,
        }
    }

    fn edit(&mut self, id: String, provider: ModelProviderInfo) {
        self.values = [
            id,
            provider.base_url.clone().unwrap_or_default(),
            provider
                .experimental_bearer_token
                .as_ref()
                .map(|key| key.to_string())
                .unwrap_or_default(),
            provider
                .models_endpoint
                .clone()
                .unwrap_or_else(|| "/v1/models".to_string()),
            provider.wire_api.to_string(),
            String::new(),
        ];
        self.editing = Some(provider);
        self.field = 0;
        self.error = None;
    }

    fn save(&mut self) {
        let id = self.values[0].trim();
        if id.is_empty()
            || !id
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-'))
        {
            self.error = Some("Provider ID must contain letters, numbers, _ or -.".into());
            return;
        }
        let Ok(url) = url::Url::parse(self.values[1].trim()) else {
            self.error = Some("Enter an HTTP(S) API URL.".into());
            return;
        };
        if !matches!(url.scheme(), "https" | "http")
            || url.host_str().is_none()
            || !url.username().is_empty()
            || url.password().is_some()
            || url.query().is_some()
            || url.fragment().is_some()
        {
            self.error =
                Some("Use an HTTP(S) API URL without credentials or query parameters.".into());
            return;
        }
        let endpoint = self.values[3].trim();
        if endpoint.is_empty()
            || !(endpoint.starts_with('/')
                || endpoint.starts_with("https://")
                || endpoint.starts_with("http://"))
            || url.join(endpoint).is_err()
        {
            self.error = Some("Models endpoint must be an absolute path or HTTP(S) URL.".into());
            return;
        }
        let protocol = match self.values[4].trim() {
            "" | "responses" => WireApi::Responses,
            "chat" | "chat_completions" => WireApi::ChatCompletions,
            "auto" => WireApi::Auto,
            _ => {
                self.error = Some("Protocol must be responses, chat, or auto.".into());
                return;
            }
        };
        let Some(mut provider) = self.editing.clone() else {
            return;
        };
        provider.name = id.to_string();
        provider.base_url = Some(url.to_string());
        provider.models_endpoint = Some(endpoint.to_string());
        provider.experimental_bearer_token =
            (!self.values[2].is_empty()).then(|| self.values[2].clone().into());
        provider.env_key = None;
        provider.env_key_instructions = None;
        provider.auth = None;
        provider.requires_openai_auth = false;
        provider.wire_api = protocol;
        let model = (!self.values[5].trim().is_empty()).then(|| self.values[5].trim().to_string());
        self.tx.send(AppEvent::SaveProvider {
            id: id.to_string(),
            provider,
            model,
        });
        self.complete = true;
    }
}

impl BottomPaneView for ProviderView {
    fn handle_key_event(&mut self, key: KeyEvent) {
        if self.editing.is_some() {
            match key.code {
                KeyCode::Esc => self.editing = None,
                KeyCode::Tab | KeyCode::Down => self.field = (self.field + 1) % 6,
                KeyCode::BackTab | KeyCode::Up => self.field = (self.field + 5) % 6,
                KeyCode::Enter if self.field == 5 => self.save(),
                KeyCode::Enter => self.field += 1,
                KeyCode::Backspace => {
                    self.values[self.field].pop();
                }
                KeyCode::Char('u') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                    self.values[self.field].clear()
                }
                KeyCode::Char(c)
                    if !key
                        .modifiers
                        .intersects(KeyModifiers::CONTROL | KeyModifiers::ALT)
                        && !c.is_control() =>
                {
                    self.values[self.field].push(c)
                }
                _ => {}
            }
        } else {
            match key.code {
                KeyCode::Char('n') => self.edit(String::new(), ModelProviderInfo::default()),
                KeyCode::Up if !self.providers.is_empty() => {
                    self.selected =
                        (self.selected + self.providers.len() - 1) % self.providers.len()
                }
                KeyCode::Down if !self.providers.is_empty() => {
                    self.selected = (self.selected + 1) % self.providers.len()
                }
                KeyCode::Char('e') => {
                    if let Some((id, provider)) = self.providers.get(self.selected).cloned() {
                        if provider.uses_external_models() {
                            self.edit(id, provider);
                        } else {
                            self.error = Some("Use n to add a custom endpoint; OpenAI sign-in is managed separately.".into());
                        }
                    }
                }
                KeyCode::Enter => {
                    if let Some((id, provider)) = self.providers.get(self.selected).cloned() {
                        self.tx.send(AppEvent::SaveProvider {
                            id,
                            provider,
                            model: None,
                        });
                        self.complete = true;
                    }
                }
                KeyCode::Esc => self.complete = true,
                _ => {}
            }
        }
    }
    fn handle_paste(&mut self, pasted: String) -> bool {
        if self.editing.is_none() {
            return false;
        }
        self.values[self.field].extend(pasted.chars().filter(|c| !c.is_control()));
        true
    }
    fn prefer_esc_to_handle_key_event(&self) -> bool {
        true
    }
    fn on_ctrl_c(&mut self) -> CancellationEvent {
        self.complete = true;
        CancellationEvent::Handled
    }
    fn is_complete(&self) -> bool {
        self.complete
    }
}

impl Renderable for ProviderView {
    fn desired_height(&self, _width: u16) -> u16 {
        if self.editing.is_some() {
            18
        } else {
            (self.providers.len() + 8).min(24) as u16
        }
    }
    fn render(&self, area: Rect, buf: &mut Buffer) {
        let mut lines: Vec<Line> = vec!["Model providers".bold().into(), "".into()];
        if self.editing.is_some() {
            for (i, label) in [
                "Provider ID",
                "API URL",
                "API key (saved locally)",
                "Models endpoint",
                "Protocol (responses / chat)",
                "Default model / custom models (comma-separated, blank: first available)",
            ]
            .iter()
            .enumerate()
            {
                let value = if i == 2 {
                    "•".repeat(self.values[i].chars().count().min(24))
                } else {
                    self.values[i].clone()
                };
                let line = format!(
                    "{} {label}: {value}",
                    if i == self.field { ">" } else { " " }
                );
                lines.push(if i == self.field {
                    line.cyan().into()
                } else {
                    line.into()
                });
                lines.push("".into());
            }
            lines.push(
                "Tab switch · Ctrl-U clear · Enter next/save · Esc back"
                    .dim()
                    .into(),
            );
        } else {
            for (i, (id, provider)) in self.providers.iter().enumerate() {
                let line = format!(
                    "{} {}{} — {}",
                    if i == self.selected { ">" } else { " " },
                    id,
                    if id == &self.active { " (active)" } else { "" },
                    provider
                        .base_url
                        .as_deref()
                        .unwrap_or("OpenAI managed service")
                );
                lines.push(if i == self.selected {
                    line.cyan().into()
                } else {
                    line.into()
                });
            }
            lines.push("".into());
            lines.push(
                "Enter switch/refresh · n add · e view/edit · Esc close"
                    .dim()
                    .into(),
            );
            lines.push(
                "Switching starts a new session; existing sessions remain saved."
                    .dim()
                    .into(),
            );
        }
        if let Some(error) = &self.error {
            lines.push(error.clone().red().into());
        }
        Paragraph::new(lines)
            .wrap(Wrap { trim: false })
            .render(area, buf);
    }
}

#[cfg(test)]
#[path = "provider_view_tests.rs"]
mod tests;
