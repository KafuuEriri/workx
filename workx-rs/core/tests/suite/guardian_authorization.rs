//! Ensures Guardian authorization survives compaction and internal context, but not user changes.

use anyhow::Result;
use core_test_support::responses;
use core_test_support::skip_if_no_network;
use core_test_support::test_workx::test_workx;
use core_test_support::wait_for_event;
use pretty_assertions::assert_eq;
use workx_core::TurnInputRequest;
use workx_core::context::ContextualUserFragment;
use workx_core::context::InternalContextSource;
use workx_core::context::InternalModelContextFragment;
use workx_features::Feature;
use workx_protocol::protocol::EventMsg;
use workx_protocol::protocol::Op;
use workx_protocol::user_input::UserInput;

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn guardian_authorization_revision_survives_compaction_not_user_input_or_rollback()
-> Result<()> {
    skip_if_no_network!(Ok(()));

    let server = responses::start_mock_server().await;
    responses::mount_sse_once(
        &server,
        responses::sse(vec![responses::ev_completed("initial")]),
    )
    .await;
    let test = test_workx()
        .with_config(|config| {
            config
                .features
                .enable(Feature::TokenBudget)
                .expect("enable context windows");
        })
        .build_with_auto_env(&server)
        .await?;
    test.submit_text_turn("Inspect the deployment.").await?;
    let mut expected = test.workx.guardian_authorization_version().await;

    let internal_context = InternalModelContextFragment::new(
        InternalContextSource::from_static("goal"),
        "Inspecting the deployment.",
    );
    let notification_text = internal_context.render();
    test.workx
        .inject_response_items(vec![ContextualUserFragment::into(internal_context)])
        .await?;
    assert_eq!(test.workx.guardian_authorization_version().await, expected);

    // The same text submitted by the user must invalidate, even if it looks internal.
    responses::mount_sse_once(
        &server,
        responses::sse(vec![responses::ev_completed("user-followup")]),
    )
    .await;
    test.submit_text_turn(&notification_text).await?;
    expected.user_message_revision += 1;
    assert_eq!(test.workx.guardian_authorization_version().await, expected);

    // Failed image preparation must not turn a real user message into internal context.
    responses::mount_sse_once(
        &server,
        responses::sse(vec![responses::ev_completed("user-image")]),
    )
    .await;
    test.workx
        .start_or_steer_turn(TurnInputRequest::user_input(vec![UserInput::Image {
            image_url: "data:image/png;base64,not-an-image".to_owned(),
            detail: None,
        }]))
        .await?;
    wait_for_event(&test.workx, |event| {
        matches!(event, EventMsg::TurnComplete(_))
    })
    .await;
    expected.user_message_revision += 1;
    assert_eq!(test.workx.guardian_authorization_version().await, expected);

    test.workx.submit(Op::Compact).await?;
    wait_for_event(&test.workx, |event| {
        matches!(event, EventMsg::TurnComplete(_))
    })
    .await;
    assert_eq!(test.workx.guardian_authorization_version().await, expected);

    test.workx.ensure_rollout_materialized().await;
    test.workx
        .submit(Op::ThreadRollback { num_turns: 1 })
        .await?;
    wait_for_event(&test.workx, |event| {
        matches!(event, EventMsg::ThreadRolledBack(_))
    })
    .await;
    assert_ne!(test.workx.guardian_authorization_version().await, expected);
    Ok(())
}
