use tracing::warn;
use workx_analytics::CompactionImplementation;
use workx_analytics::CompactionReason;
use workx_otel::SessionTelemetry;
use workx_protocol::error::WorkxErr;
use workx_protocol::error::WorkxErrorDetails;

/// Retries failures that may be model-specific and succeed with a different model.
pub(crate) fn should_retry_with_current_model(error: &WorkxErr) -> bool {
    matches!(
        error.details(),
        WorkxErrorDetails::InvalidRequest(_)
            | WorkxErrorDetails::UnexpectedStatus(_)
            | WorkxErrorDetails::ContextWindowExceeded
            | WorkxErrorDetails::UsageLimitReached(_)
            | WorkxErrorDetails::ServerOverloaded
            | WorkxErrorDetails::InternalServerError
            | WorkxErrorDetails::RetryLimit(_)
    )
}

pub(crate) fn record_model_fallback(
    session_telemetry: &SessionTelemetry,
    previous_model: &str,
    current_model: &str,
    reason: CompactionReason,
    implementation: CompactionImplementation,
    fallback_error: Option<&WorkxErr>,
) {
    let reason_tag = match reason {
        CompactionReason::UserRequested => "user_requested",
        CompactionReason::ContextLimit => "context_limit",
        CompactionReason::ModelDownshift => "model_downshift",
        CompactionReason::CompHashChanged => "comp_hash_changed",
    };
    let implementation_tag = match implementation {
        CompactionImplementation::Responses => "responses",
        CompactionImplementation::ResponsesCompactionV2 => "responses_compaction_v2",
        CompactionImplementation::ResponsesCompact => "responses_compact",
    };
    let outcome = if fallback_error.is_none() {
        "succeeded"
    } else {
        "failed"
    };
    session_telemetry.counter(
        "workx.compaction.model_fallback",
        /*inc*/ 1,
        &[
            ("reason", reason_tag),
            ("implementation", implementation_tag),
            ("outcome", outcome),
        ],
    );
    warn!(
        previous_model,
        current_model,
        ?reason,
        ?implementation,
        outcome,
        ?fallback_error,
        "previous-model compaction failed; retried with current model"
    );
}
