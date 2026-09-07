use super::*;
use workx_protocol::error::WorkxErrorDetails;

pub(super) fn environment_selection_error(err: WorkxErr) -> JSONRPCErrorError {
    match err.details() {
        WorkxErrorDetails::InvalidRequest(message) => invalid_request(message.clone()),
        _ => internal_error(format!("failed to validate environment selections: {err}")),
    }
}
