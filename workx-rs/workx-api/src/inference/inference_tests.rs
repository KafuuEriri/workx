use super::WireApi;
use super::chat::encode_chat_request;
use super::chat_stream::ChatStreamDecoder;
use super::inference_base_url;
use super::inference_protocol;
use crate::ResponseEvent;
use crate::ResponsesApiRequest;
use pretty_assertions::assert_eq;
use serde_json::Value;
use serde_json::json;
use std::sync::Arc;

fn request(input: Vec<Value>) -> ResponsesApiRequest {
    ResponsesApiRequest {
        model: "custom-model".to_string(),
        instructions: "Follow the project rules".to_string(),
        input: input
            .into_iter()
            .map(|item| serde_json::from_value(item).unwrap())
            .collect(),
        tools: None,
        tool_choice: "auto".to_string(),
        parallel_tool_calls: true,
        reasoning: None,
        store: false,
        stream: true,
        stream_options: None,
        include: Vec::new(),
        service_tier: None,
        prompt_cache_key: None,
        text: None,
        client_metadata: None,
        access_programs: None,
    }
}

#[test]
fn inference_endpoint_detection_respects_paths_and_overrides() {
    for (uri, expected, base) in [
        (
            "https://gateway.test/deployment/v1/chat/completions/",
            WireApi::ChatCompletions,
            "https://gateway.test/deployment/v1",
        ),
        (
            "https://gateway.test/v1/responses",
            WireApi::Responses,
            "https://gateway.test/v1",
        ),
        (
            "https://chat.example/v1",
            WireApi::Responses,
            "https://chat.example/v1",
        ),
    ] {
        assert_eq!(WireApi::Auto.resolve(Some(uri)), expected);
        assert_eq!(inference_base_url(uri), base);
    }
    assert_eq!(
        WireApi::ChatCompletions.resolve(Some("https://gateway.test/v1")),
        WireApi::ChatCompletions
    );
    assert_eq!(
        inference_protocol(
            WireApi::Auto,
            Some("https://gateway.test/v1/chat/completions")
        )
        .endpoint(),
        "/chat/completions"
    );
}

#[test]
fn chat_request_preserves_tool_roundtrip_and_image_inputs() {
    let request = request(vec![
        json!({"type": "message", "role": "user", "content": [{"type": "input_text", "text": "inspect"}, {"type": "input_image", "image_url": "data:image/png;base64,AA=="}]}),
        json!({"type": "function_call", "call_id": "call-1", "name": "exec_command", "arguments": "{\"cmd\":\"pwd\"}"}),
        json!({"type": "function_call", "call_id": "call-2", "name": "read_file", "arguments": "{}"}),
        json!({"type": "function_call_output", "call_id": "call-1", "output": "/workspace"}),
        json!({"type": "function_call_output", "call_id": "call-2", "output": "file contents"}),
    ]);
    let body = encode_chat_request(&request).unwrap();
    assert_eq!(
        body,
        json!({
            "model": "custom-model", "stream": true, "stream_options": {"include_usage": true},
            "messages": [
                {"role": "system", "content": "Follow the project rules"},
                {"role": "user", "content": [{"type": "text", "text": "inspect"}, {"type": "image_url", "image_url": {"url": "data:image/png;base64,AA=="}}]},
                {"role": "assistant", "content": null, "tool_calls": [{"id": "call-1", "type": "function", "function": {"name": "exec_command", "arguments": "{\"cmd\":\"pwd\"}"}}, {"id": "call-2", "type": "function", "function": {"name": "read_file", "arguments": "{}"}}]},
                {"role": "tool", "tool_call_id": "call-1", "content": "/workspace"},
                {"role": "tool", "tool_call_id": "call-2", "content": "file contents"}
            ]
        })
    );
}

#[test]
fn custom_tool_schema_and_output_are_adapted() {
    let mut request = request(vec![]);
    let tools = json!([{"type": "custom", "name": "apply_patch", "description": "Apply a patch"}]);
    request.tools = Some(
        Arc::<serde_json::value::RawValue>::from(serde_json::value::to_raw_value(&tools).unwrap())
            .into(),
    );
    let body = encode_chat_request(&request).unwrap();
    assert_eq!(
        body["tools"][0]["function"]["parameters"]["required"],
        json!(["input"])
    );
    let mut decoder = ChatStreamDecoder::default();
    decoder.chunk(json!({"id": "chat-1", "choices": [{"index": 0, "delta": {"tool_calls": [{"index": 0, "id": "call-1", "function": {"name": "apply_patch", "arguments": "{\"input\":\"patch body\"}"}}]}, "finish_reason": "tool_calls"}]})).unwrap();
    let events = decoder
        .finish(&super::chat::custom_tools(&request))
        .unwrap();
    let ResponseEvent::OutputItemDone(item) = &events[1] else {
        panic!("expected completed custom call")
    };
    let item = serde_json::to_value(item).unwrap();
    assert_eq!(item["type"], "custom_tool_call");
    assert_eq!(item["input"], "patch body");
}

#[test]
fn interleaved_tool_arguments_and_usage_survive_streaming() {
    let mut decoder = ChatStreamDecoder::default();
    decoder
        .chunk(
            json!({"id": "chat-1", "choices": [{"index": 0, "delta": {"tool_calls": [
                {"index": 1, "id": "b", "function": {"name": "read", "arguments": "{\"path\":"}},
                {"index": 0, "id": "a", "function": {"name": "exec", "arguments": "{"}}
            ]}}]}),
        )
        .unwrap();
    decoder.chunk(json!({"choices": [{"index": 0, "delta": {"tool_calls": [
        {"index": 0, "function": {"arguments": "}"}}, {"index": 1, "function": {"arguments": "\"README.md\"}"}}
    ]}, "finish_reason": "tool_calls"}]})).unwrap();
    decoder.chunk(json!({"choices": [], "usage": {"prompt_tokens": 10, "completion_tokens": 3, "total_tokens": 13}})).unwrap();
    let events = decoder.finish(&[]).unwrap();
    let items: Vec<Value> = events
        .iter()
        .filter_map(|event| match event {
            ResponseEvent::OutputItemDone(item) => Some(serde_json::to_value(item).unwrap()),
            _ => None,
        })
        .collect();
    assert_eq!(items[0]["arguments"], "{}");
    assert_eq!(items[1]["arguments"], "{\"path\":\"README.md\"}");
    assert!(
        matches!(events.last(), Some(ResponseEvent::Completed { token_usage: Some(usage), end_turn: Some(false), .. }) if usage.total_tokens == 13)
    );
}

#[test]
fn partial_or_filtered_completions_do_not_execute_tools() {
    let mut decoder = ChatStreamDecoder::default();
    assert!(decoder.finish(&[]).is_err());
    for reason in ["length", "content_filter"] {
        assert!(
            decoder
                .chunk(json!({"choices": [{"index": 0, "delta": {}, "finish_reason": reason}]}))
                .is_err()
        );
    }
    assert!(
        decoder
            .chunk(json!({"error": {"message": "invalid api key"}}))
            .is_err()
    );
}

#[tokio::test]
async fn chat_sse_translates_text_and_rejects_truncated_streams() {
    use bytes::Bytes;
    use futures::StreamExt;
    use http::HeaderMap;
    use http::StatusCode;
    use std::time::Duration;
    use workx_client::StreamResponse;
    let chunks = [
        json!({"id": "chat-1", "choices": [{"index": 0, "delta": {"content": "hello"}}]}),
        json!({"id": "chat-1", "choices": [{"index": 0, "delta": {"content": " world"}, "finish_reason": "stop"}]}),
    ];
    for complete in [true, false] {
        let mut data = chunks
            .iter()
            .map(|chunk| format!("data: {chunk}\n\n"))
            .collect::<String>();
        if complete {
            data.push_str("data: [DONE]\n\n");
        }
        let response = StreamResponse {
            status: StatusCode::OK,
            headers: HeaderMap::new(),
            bytes: Box::pin(futures::stream::iter(vec![Ok(Bytes::from(data))])),
        };
        let stream =
            super::chat_stream::spawn_chat_stream(response, Duration::from_secs(1), None, vec![]);
        let events: Vec<_> = stream.collect().await;
        if complete {
            assert!(matches!(
                events.last(),
                Some(Ok(ResponseEvent::Completed {
                    end_turn: Some(true),
                    ..
                }))
            ));
            let text = events
                .iter()
                .filter_map(|event| match event {
                    Ok(ResponseEvent::OutputTextDelta(text)) => Some(text.as_str()),
                    _ => None,
                })
                .collect::<String>();
            assert_eq!(text, "hello world");
        } else {
            assert!(events.last().unwrap().is_err());
        }
    }
}

#[test]
fn reasoning_survives_serialized_history_and_stays_with_its_completion() {
    let mut history = vec![];
    for (id, reasoning, tool) in [
        ("first", " first thought ", true),
        ("second", "second thought", false),
    ] {
        let mut decoder = ChatStreamDecoder::default();
        decoder.chunk(json!({"id":id, "choices":[{"index":0, "delta":{"reasoning_content": reasoning}, "finish_reason":null}]})).unwrap();
        let delta = if tool {
            json!({"content":"working", "tool_calls":[{"index":0,"id":"call-1","function":{"name":"exec_command","arguments":"{}"}}]})
        } else {
            json!({"content":"finished"})
        };
        decoder.chunk(json!({"id":id, "choices":[{"index":0,"delta":delta,"finish_reason":if tool {"tool_calls"} else {"stop"}}]})).unwrap();
        for event in decoder.finish(&[]).unwrap() {
            if let ResponseEvent::OutputItemDone(item) = event {
                history.push(serde_json::to_value(item).unwrap());
            }
        }
        if tool {
            history.push(json!({"type":"function_call_output","call_id":"call-1","output":"ok"}));
        }
    }
    history.push(json!({"type":"message","role":"user","content":[{"type":"input_text","text":"next question"}]}));
    let body = encode_chat_request(&request(history)).unwrap();
    assert_eq!(body["messages"][1]["reasoning_content"], " first thought ");
    assert_eq!(body["messages"][1]["content"][0]["text"], "working");
    assert_eq!(body["messages"][1]["tool_calls"][0]["id"], "call-1");
    assert_eq!(body["messages"][2]["role"], "tool");
    assert_eq!(body["messages"][3]["reasoning_content"], "second thought");
    assert_eq!(body["messages"][4]["role"], "user");
    assert!(body["messages"][4].get("reasoning_content").is_none());
}
