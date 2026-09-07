use super::InferenceProtocol;
use crate::ApiError;
use crate::ResponseStream;
use crate::ResponsesApiRequest;
use crate::SseTelemetry;
use serde_json::Value;
use serde_json::json;
use std::sync::Arc;
use std::sync::OnceLock;
use std::time::Duration;
use workx_client::EncodedJsonBody;
use workx_client::StreamResponse;

#[derive(Debug)]
pub(super) struct ChatCompletionsProtocol;

impl InferenceProtocol for ChatCompletionsProtocol {
    fn endpoint(&self) -> &'static str {
        "/chat/completions"
    }
    fn encode_request(&self, request: &ResponsesApiRequest) -> Result<EncodedJsonBody, ApiError> {
        let body = encode_chat_request(request)?;
        EncodedJsonBody::encode(&body).map_err(|err| ApiError::Stream(err.to_string()))
    }
    fn stream_response(
        &self,
        response: StreamResponse,
        timeout: Duration,
        telemetry: Option<Arc<dyn SseTelemetry>>,
        _turn_state: Option<Arc<OnceLock<String>>>,
        request: &ResponsesApiRequest,
    ) -> ResponseStream {
        super::chat_stream::spawn_chat_stream(response, timeout, telemetry, custom_tools(request))
    }
}

pub(super) fn custom_tools(request: &ResponsesApiRequest) -> Vec<String> {
    request
        .tools
        .as_ref()
        .and_then(|tools| serde_json::from_str::<Vec<Value>>(tools.as_raw_value().get()).ok())
        .unwrap_or_default()
        .iter()
        .filter(|tool| tool["type"] == "custom")
        .filter_map(|tool| tool["name"].as_str().map(str::to_owned))
        .collect()
}

pub(super) fn encode_chat_request(request: &ResponsesApiRequest) -> Result<Value, ApiError> {
    let mut messages = Vec::new();
    let mut reasoning: Option<String> = None;
    let mut assistant_index: Option<usize> = None;
    if !request.instructions.is_empty() {
        messages.push(json!({"role": "system", "content": request.instructions}));
    }
    for item in &request.input {
        let item = serde_json::to_value(item).map_err(|err| ApiError::Stream(err.to_string()))?;
        match item["type"].as_str().unwrap_or_default() {
            "message" => {
                let mut parts = Vec::new();
                for part in item["content"].as_array().into_iter().flatten() {
                    parts.push(match part["type"].as_str().unwrap_or_default() {
                        "input_text" | "output_text" => {
                            json!({"type": "text", "text": part["text"]})
                        }
                        "input_image" => {
                            json!({"type": "image_url", "image_url": {"url": part["image_url"]}})
                        }
                        kind => {
                            return Err(ApiError::Stream(format!(
                                "Chat Completions does not support message content {kind:?}"
                            )));
                        }
                    });
                }
                let role = if item["role"] == "developer" {
                    "system"
                } else {
                    item["role"].as_str().unwrap_or("user")
                };
                let mut message = json!({"role": role, "content": parts});
                assistant_index = if role == "assistant" {
                    if let Some(content) = reasoning.take() {
                        message["reasoning_content"] = json!(content);
                    }
                    Some(messages.len())
                } else {
                    reasoning = None;
                    None
                };
                messages.push(message);
            }
            "function_call" | "custom_tool_call" => {
                let arguments = if item["type"] == "custom_tool_call" {
                    json!({"input": item["input"]}).to_string()
                } else {
                    item["arguments"].as_str().unwrap_or("{}").to_string()
                };
                let call = json!({"id": item["call_id"], "type": "function", "function": {"name": item["name"], "arguments": arguments}});
                if let Some(index) = assistant_index {
                    let message = &mut messages[index];
                    if let Some(calls) = message["tool_calls"].as_array_mut() {
                        calls.push(call);
                    } else {
                        message["tool_calls"] = json!([call]);
                    }
                } else {
                    let mut message =
                        json!({"role": "assistant", "content": null, "tool_calls": [call]});
                    if let Some(content) = reasoning.take() {
                        message["reasoning_content"] = json!(content);
                    }
                    assistant_index = Some(messages.len());
                    messages.push(message);
                }
            }
            "function_call_output" | "custom_tool_call_output" => {
                assistant_index = None;
                reasoning = None;
                let output = match item["output"].as_str() {
                    Some(text) => text.to_string(),
                    None => item["output"].to_string(),
                };
                messages.push(
                    json!({"role": "tool", "tool_call_id": item["call_id"], "content": output}),
                );
            }
            "reasoning" => {
                // 推理内容属于紧随其后的 assistant 消息，工具调用必须与该消息一起回传。
                assistant_index = None;
                for part in item["content"].as_array().into_iter().flatten() {
                    if part["type"] == "reasoning_text"
                        && let Some(text) = part["text"].as_str()
                    {
                        reasoning.get_or_insert_default().push_str(text);
                    }
                }
            }
            "compaction" => {
                assistant_index = None;
                reasoning = None;
            }
            kind => {
                return Err(ApiError::Stream(format!(
                    "Chat Completions does not support history item {kind:?}"
                )));
            }
        }
    }
    let mut body = json!({"model": request.model, "messages": messages, "stream": true, "stream_options": {"include_usage": true}});
    if let Some(tools) = &request.tools {
        let definitions: Vec<Value> = serde_json::from_str(tools.as_raw_value().get())
            .map_err(|err| ApiError::Stream(err.to_string()))?;
        let mut functions = Vec::new();
        for tool in definitions {
            let definition = match tool["type"].as_str().unwrap_or_default() {
                "function" => {
                    let mut definition = tool.clone();
                    definition
                        .as_object_mut()
                        .ok_or_else(|| {
                            ApiError::Stream("Invalid function tool definition".to_string())
                        })?
                        .remove("type");
                    definition
                }
                "custom" => {
                    json!({"name": tool["name"], "description": tool["description"], "parameters": {"type": "object", "properties": {"input": {"type": "string"}}, "required": ["input"], "additionalProperties": false}})
                }
                kind => {
                    return Err(ApiError::Stream(format!(
                        "Chat Completions does not support tool type {kind:?}"
                    )));
                }
            };
            functions.push(json!({"type": "function", "function": definition}));
        }
        if !functions.is_empty() {
            body["tools"] = json!(functions);
            body["tool_choice"] = json!(request.tool_choice);
            body["parallel_tool_calls"] = json!(request.parallel_tool_calls);
        }
    }
    if let Some(text) = &request.text {
        let text = serde_json::to_value(text).map_err(|err| ApiError::Stream(err.to_string()))?;
        if text["format"]["type"] == "json_schema" {
            let mut schema = text["format"].clone();
            schema
                .as_object_mut()
                .ok_or_else(|| ApiError::Stream("Invalid response format schema".to_string()))?
                .remove("type");
            body["response_format"] = json!({"type": "json_schema", "json_schema": schema});
        }
    }
    Ok(body)
}
