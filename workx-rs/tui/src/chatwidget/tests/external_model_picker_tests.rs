use super::*;

#[tokio::test]
async fn external_model_picker_waits_for_catalog_and_clears_stale_results() {
    let (mut chat, _events, _ops) = make_chatwidget_manual(Some("gpt-5.2")).await;
    chat.thread_id = Some(ThreadId::new());
    chat.config.model_provider.name = "custom".into();
    chat.config.model_provider.requires_openai_auth = false;
    let mut models = chat.model_catalog.try_list_models().unwrap();
    models.truncate(1);
    models[0].id = "current-provider-model".into();
    models[0].model = "current-provider-model".into();
    chat.open_model_popup();
    assert_chatwidget_snapshot!(
        "external_model_picker_loading",
        render_bottom_popup(&chat, 80)
    );
    let request = chat.model_popup_request_id.unwrap();
    assert!(chat.on_models_loaded(request, Ok(models.clone())));
    assert_eq!(chat.model_catalog.try_list_models().unwrap(), models);
    chat.handle_key_event(KeyEvent::from(KeyCode::Esc));
    chat.open_model_popup();
    let request = chat.model_popup_request_id.unwrap();
    assert!(chat.on_models_loaded(request, Ok(Vec::new())));
    assert!(chat.model_catalog.try_list_models().unwrap().is_empty());
    assert!(chat.no_modal_or_popup_active());
}
