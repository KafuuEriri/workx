use super::*;
use pretty_assertions::assert_eq;
use std::collections::HashMap;

#[test]
fn provider_editor_masks_and_saves_key_with_responses_default() {
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
    let mut view = ProviderView::new(HashMap::new(), String::new(), AppEventSender::new(tx));
    view.edit("example".into(), ModelProviderInfo::default());
    view.values[1] = "https://example.test/v1".into();
    view.values[2] = "secret-test-key".into();
    let area = Rect::new(0, 0, 90, 18);
    let mut buffer = Buffer::empty(area);
    view.render(area, &mut buffer);
    let screen = buffer
        .content
        .chunks(area.width as usize)
        .map(|row| {
            row.iter()
                .map(ratatui::buffer::Cell::symbol)
                .collect::<String>()
        })
        .collect::<Vec<_>>()
        .join("\n");
    assert!(!screen.contains("secret-test-key"));
    insta::assert_snapshot!(screen);
    view.save();
    let AppEvent::SaveProvider {
        id,
        provider,
        model,
    } = rx.try_recv().unwrap()
    else {
        panic!("expected save");
    };
    assert_eq!(id, "example");
    assert_eq!(provider.wire_api, WireApi::Responses);
    assert_eq!(provider.models_endpoint.as_deref(), Some("/v1/models"));
    assert_eq!(
        provider.experimental_bearer_token.unwrap().as_str(),
        "secret-test-key"
    );
    assert_eq!(model, None);
}

#[test]
fn provider_picker_displays_active_origin_and_supports_editing() {
    let (tx, _rx) = tokio::sync::mpsc::unbounded_channel();
    let providers = HashMap::from([(
        "example".into(),
        ModelProviderInfo {
            name: "example".into(),
            base_url: Some("https://example.test/v1".into()),
            ..Default::default()
        },
    )]);
    let mut view = ProviderView::new(providers, "example".into(), AppEventSender::new(tx));
    let area = Rect::new(0, 0, 90, 10);
    let mut buffer = Buffer::empty(area);
    view.render(area, &mut buffer);
    let screen = buffer
        .content
        .chunks(area.width as usize)
        .map(|row| {
            row.iter()
                .map(ratatui::buffer::Cell::symbol)
                .collect::<String>()
        })
        .collect::<Vec<_>>()
        .join("\n");
    insta::assert_snapshot!(screen);
    view.handle_key_event(KeyEvent::new(KeyCode::Char('e'), KeyModifiers::NONE));
    assert_eq!(view.values[0], "example");
    assert_eq!(view.values[1], "https://example.test/v1");
}
