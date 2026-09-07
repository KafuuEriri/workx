mod chat;
mod chat_stream;
#[cfg(test)]
#[path = "inference_tests.rs"]
mod tests;

use crate::ApiError;
use crate::ResponseStream;
use crate::ResponsesApiRequest;
use crate::SseTelemetry;
use http::HeaderMap;
use schemars::JsonSchema;
use serde::Deserialize;
use serde::Serialize;
use std::fmt;
use std::sync::Arc;
use std::sync::OnceLock;
use std::time::Duration;
use workx_client::EncodedJsonBody;
use workx_client::StreamResponse;

/// Configured inference protocol. Auto recognizes endpoint paths and otherwise uses Responses.
/// 推理协议配置。Auto 根据端点路径识别协议，无法识别时使用 Responses。
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum WireApi {
    Auto,
    #[default]
    Responses,
    #[serde(rename = "chat", alias = "chat_completions")]
    ChatCompletions,
}

impl WireApi {
    pub fn resolve(self, uri: Option<&str>) -> Self {
        match self {
            Self::Auto => {
                let is_chat = uri
                    .and_then(|uri| url::Url::parse(uri).ok())
                    .is_some_and(|uri| {
                        uri.path()
                            .trim_end_matches('/')
                            .ends_with("/chat/completions")
                    });
                if is_chat {
                    Self::ChatCompletions
                } else {
                    Self::Responses
                }
            }
            protocol => protocol,
        }
    }
}

impl fmt::Display for WireApi {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Auto => "auto",
            Self::Responses => "responses",
            Self::ChatCompletions => "chat",
        })
    }
}

/// Inference SPI maps Workx requests and events to one remote protocol; access method is implementation-defined.
/// 推理 SPI 负责 Workx 请求、事件与远端协议之间的映射，不限定底层访问方式。
pub trait InferenceProtocol: fmt::Debug + Send + Sync {
    fn endpoint(&self) -> &'static str;
    fn encode_request(&self, request: &ResponsesApiRequest) -> Result<EncodedJsonBody, ApiError>;
    fn stream_response(
        &self,
        response: StreamResponse,
        timeout: Duration,
        telemetry: Option<Arc<dyn SseTelemetry>>,
        turn_state: Option<Arc<OnceLock<String>>>,
        request: &ResponsesApiRequest,
    ) -> ResponseStream;
    fn headers(&self) -> HeaderMap {
        HeaderMap::new()
    }
}

#[derive(Debug)]
struct ResponsesProtocol;

impl InferenceProtocol for ResponsesProtocol {
    fn endpoint(&self) -> &'static str {
        "/responses"
    }
    fn encode_request(&self, request: &ResponsesApiRequest) -> Result<EncodedJsonBody, ApiError> {
        EncodedJsonBody::encode(request).map_err(|err| ApiError::Stream(err.to_string()))
    }
    fn stream_response(
        &self,
        response: StreamResponse,
        timeout: Duration,
        telemetry: Option<Arc<dyn SseTelemetry>>,
        turn_state: Option<Arc<OnceLock<String>>>,
        _request: &ResponsesApiRequest,
    ) -> ResponseStream {
        crate::sse::spawn_response_stream(response, timeout, telemetry, turn_state)
    }
}

/// Returns a stateless built-in protocol implementation for a configured endpoint.
/// 返回配置端点对应的无状态内置协议实现。
pub fn inference_protocol(protocol: WireApi, uri: Option<&str>) -> &'static dyn InferenceProtocol {
    match protocol.resolve(uri) {
        WireApi::Responses | WireApi::Auto => &ResponsesProtocol,
        WireApi::ChatCompletions => &chat::ChatCompletionsProtocol,
    }
}

/// Removes an explicit inference endpoint suffix while retaining a deployment path prefix.
/// 移除显式推理端点后缀，保留部署路径前缀。
pub fn inference_base_url(uri: &str) -> String {
    let trimmed = uri.trim_end_matches('/');
    for suffix in ["/chat/completions", "/responses"] {
        if let Some(base) = trimmed.strip_suffix(suffix) {
            return base.to_string();
        }
    }
    uri.to_string()
}
