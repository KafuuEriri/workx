use crate::ApiError;
use crate::ResponseEvent;
use crate::ResponseStream;
use crate::SseTelemetry;
use eventsource_stream::Eventsource;
use futures::StreamExt;
use serde_json::Value;
use serde_json::json;
use std::collections::BTreeMap;
use std::sync::Arc;
use std::time::Duration;
use std::time::Instant;
use tokio::sync::mpsc;
use workx_client::StreamResponse;
use workx_protocol::models::ResponseItem;
use workx_protocol::protocol::TokenUsage;

#[derive(Default)]
struct ToolCall {
    id: String,
    name: String,
    arguments: String,
}

/// Accumulates one streamed completion with bounded tool and message buffers.
/// 聚合单次流式生成结果，并限制工具及消息缓冲区大小。
#[derive(Default)]
pub(super) struct ChatStreamDecoder {
    id: String,
    text: String,
    reasoning: Option<String>,
    tools: BTreeMap<u64, ToolCall>,
    usage: Option<TokenUsage>,
    finish_reason: Option<String>,
    message_started: bool,
    buffered_bytes: usize,
}

impl ChatStreamDecoder {
    pub(super) fn chunk(&mut self, chunk: Value) -> Result<Vec<ResponseEvent>, ApiError> {
        if let Some(error) = chunk.get("error") {
            return Err(ApiError::Stream(format!("Chat Completions error: {error}")));
        }
        if let Some(id) = chunk["id"].as_str() {
            self.id = id.to_owned();
        }
        if let Some(usage) = chunk.get("usage").filter(|v| v.is_object()) {
            let input = usage["prompt_tokens"].as_i64().unwrap_or_default();
            let output = usage["completion_tokens"].as_i64().unwrap_or_default();
            self.usage = Some(TokenUsage {
                input_tokens: input,
                output_tokens: output,
                total_tokens: usage["total_tokens"].as_i64().unwrap_or(input + output),
                cached_input_tokens: usage["prompt_tokens_details"]["cached_tokens"]
                    .as_i64()
                    .unwrap_or_default(),
                reasoning_output_tokens: usage["completion_tokens_details"]["reasoning_tokens"]
                    .as_i64()
                    .unwrap_or_default(),
                ..Default::default()
            });
        }
        let mut events = Vec::new();
        for choice in chunk["choices"].as_array().into_iter().flatten() {
            if choice["index"].as_u64().unwrap_or_default() != 0 {
                continue;
            }
            if let Some(reason) = choice["finish_reason"].as_str() {
                if !matches!(reason, "stop" | "tool_calls") {
                    return Err(ApiError::Stream(format!(
                        "Chat Completions ended without a complete answer: {reason}"
                    )));
                }
                self.finish_reason = Some(reason.to_string());
            }
            let delta = &choice["delta"];
            if let Some(text) = delta["content"].as_str().filter(|text| !text.is_empty()) {
                if !self.message_started {
                    events.push(ResponseEvent::OutputItemAdded(self.message("")?));
                    self.message_started = true;
                }
                self.text.push_str(text);
                self.buffered_bytes += text.len();
                events.push(ResponseEvent::OutputTextDelta(text.to_string()));
            }
            if let Some(reasoning) = delta["reasoning_content"].as_str() {
                self.reasoning.get_or_insert_default().push_str(reasoning);
                self.buffered_bytes += reasoning.len();
                events.push(ResponseEvent::ReasoningContentDelta {
                    delta: reasoning.to_string(),
                    content_index: 0,
                });
            }
            for tool in delta["tool_calls"].as_array().into_iter().flatten() {
                let index = tool["index"]
                    .as_u64()
                    .ok_or_else(|| ApiError::Stream("Missing streamed tool index".to_string()))?;
                if index >= 128 {
                    return Err(ApiError::Stream("Too many streamed tool calls".to_string()));
                }
                let call = self.tools.entry(index).or_default();
                for (field, incoming) in [
                    (&mut call.id, &tool["id"]),
                    (&mut call.name, &tool["function"]["name"]),
                    (&mut call.arguments, &tool["function"]["arguments"]),
                ] {
                    if let Some(value) = incoming.as_str() {
                        field.push_str(value);
                        self.buffered_bytes += value.len();
                    }
                }
            }
        }
        if self.buffered_bytes > 16 * 1024 * 1024 {
            return Err(ApiError::Stream(
                "Chat Completions response exceeds the 16 MiB buffer limit".to_string(),
            ));
        }
        Ok(events)
    }

    fn message(&self, text: &str) -> Result<ResponseItem, ApiError> {
        serde_json::from_value(json!({"type": "message", "id": format!("{}_message", self.id), "role": "assistant", "content": [{"type": "output_text", "text": text}]}))
            .map_err(|err| ApiError::Stream(err.to_string()))
    }

    pub(super) fn finish(&self, custom_tools: &[String]) -> Result<Vec<ResponseEvent>, ApiError> {
        let reason = self.finish_reason.as_deref().ok_or_else(|| {
            ApiError::Stream("Chat Completions stream ended before finish_reason".to_string())
        })?;
        let mut events = Vec::new();
        if let Some(reasoning) = &self.reasoning {
            let item: ResponseItem = serde_json::from_value(json!({
                "type": "reasoning", "id": format!("{}_reasoning", self.id),
                "summary": [], "content": [{"type": "reasoning_text", "text": reasoning}],
                "encrypted_content": null
            }))
            .map_err(|err| ApiError::Stream(err.to_string()))?;
            events.push(ResponseEvent::OutputItemAdded(item.clone()));
            events.push(ResponseEvent::OutputItemDone(item));
        }
        if self.message_started {
            events.push(ResponseEvent::OutputItemDone(self.message(&self.text)?));
        }
        for call in self.tools.values() {
            if call.id.is_empty() || call.name.is_empty() {
                return Err(ApiError::Stream(
                    "Incomplete streamed tool call".to_string(),
                ));
            }
            let mut item = json!({"type": "function_call", "id": call.id, "call_id": call.id, "name": call.name, "arguments": call.arguments});
            if custom_tools.contains(&call.name) {
                let arguments: Value = serde_json::from_str(&call.arguments).map_err(|err| {
                    ApiError::Stream(format!("Invalid custom tool arguments: {err}"))
                })?;
                let input = arguments["input"].as_str().ok_or_else(|| {
                    ApiError::Stream("Custom tool arguments require an input string".to_string())
                })?;
                item = json!({"type": "custom_tool_call", "id": call.id, "call_id": call.id, "name": call.name, "input": input});
            }
            let item: ResponseItem =
                serde_json::from_value(item).map_err(|err| ApiError::Stream(err.to_string()))?;
            events.push(ResponseEvent::OutputItemAdded(item.clone()));
            events.push(ResponseEvent::OutputItemDone(item));
        }
        events.push(ResponseEvent::Completed {
            response_id: self.id.clone(),
            token_usage: self.usage.clone(),
            usage_metadata: None,
            end_turn: Some(reason == "stop" && self.tools.is_empty()),
        });
        Ok(events)
    }
}

pub(super) fn spawn_chat_stream(
    response: StreamResponse,
    idle_timeout: Duration,
    telemetry: Option<Arc<dyn SseTelemetry>>,
    custom_tools: Vec<String>,
) -> ResponseStream {
    let upstream_request_id = response
        .headers
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);
    let (tx, rx_event) = mpsc::channel(128);
    tokio::spawn(async move {
        let mut stream = response.bytes.eventsource();
        let mut decoder = ChatStreamDecoder::default();
        if tx.send(Ok(ResponseEvent::Created)).await.is_err() {
            return;
        }
        loop {
            let start = Instant::now();
            let next = tokio::select! {
                _ = tx.closed() => return,
                next = tokio::time::timeout(idle_timeout, stream.next()) => next,
            };
            if let Some(telemetry) = &telemetry {
                telemetry.on_sse_poll(&next, start.elapsed());
            }
            let event = match next {
                Ok(Some(Ok(event))) => event,
                Ok(Some(Err(err))) => {
                    let _ = tx.send(Err(ApiError::Stream(err.to_string()))).await;
                    return;
                }
                Ok(None) => {
                    let _ = tx
                        .send(Err(ApiError::Stream(
                            "Chat Completions stream closed before [DONE]".to_string(),
                        )))
                        .await;
                    return;
                }
                Err(_) => {
                    let _ = tx
                        .send(Err(ApiError::Stream(
                            "Chat Completions stream idle timeout".to_string(),
                        )))
                        .await;
                    return;
                }
            };
            let done = event.data.trim() == "[DONE]";
            let result = if done {
                decoder.finish(&custom_tools)
            } else {
                serde_json::from_str(&event.data)
                    .map_err(|err| ApiError::Stream(err.to_string()))
                    .and_then(|chunk| decoder.chunk(chunk))
            };
            match result {
                Ok(events) => {
                    for event in events {
                        if tx.send(Ok(event)).await.is_err() {
                            return;
                        }
                    }
                }
                Err(err) => {
                    let _ = tx.send(Err(err)).await;
                    return;
                }
            }
            if done {
                return;
            }
        }
    });
    ResponseStream {
        rx_event,
        upstream_request_id,
    }
}
