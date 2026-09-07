use anyhow::Result;
use core_test_support::test_workx::test_workx;
use pretty_assertions::assert_eq;
use serde_json::Value;
use serde_json::json;
use wiremock::Mock;
use wiremock::MockServer;
use wiremock::ResponseTemplate;
use wiremock::matchers::method;
use wiremock::matchers::path;
use workx_model_provider_info::WireApi;

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn chat_completions_provider_executes_tools_and_returns_results() -> Result<()> {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/v1/chat/completions"))
        .respond_with(|request: &wiremock::Request| {
            let body: Value = serde_json::from_slice(&request.body).unwrap();
            let has_result = body["messages"].as_array().unwrap().iter().any(|message| message["role"] == "tool");
            let chunk = if has_result {
                json!({"id": "chat-2", "choices": [{"index": 0, "delta": {"content": "provider tool complete"}, "finish_reason": "stop"}]})
            } else {
                json!({"id": "chat-1", "choices": [{"index": 0, "delta": {"reasoning_content": "Need to run the command before answering.", "content": "Running the command.", "tool_calls": [{"index": 0, "id": "provider-call", "type": "function", "function": {"name": "exec_command", "arguments": "{\"cmd\":\"echo provider-tool-ok\",\"max_output_tokens\":100}"}}]}, "finish_reason": "tool_calls"}]})
            };
            ResponseTemplate::new(200).insert_header("content-type", "text/event-stream").set_body_string(format!("data: {chunk}\n\ndata: [DONE]\n\n"))
        })
        .mount(&server).await;
    let mut builder = test_workx().with_model("gpt-5.2").with_config(|config| {
        config.model_provider.wire_api = WireApi::ChatCompletions;
        config.model_provider.requires_openai_auth = false;
        config.model_provider.supports_websockets = false;
        config.model_provider.request_max_retries = Some(0);
        config.model_provider.stream_max_retries = Some(0);
    });
    let test = builder.build_with_auto_env(&server).await?;
    test.submit_turn("Run echo provider-tool-ok with exec_command and report the result.")
        .await?;
    let requests = server.received_requests().await.unwrap();
    let requests: Vec<_> = requests
        .iter()
        .filter(|request| request.url.path() == "/v1/chat/completions")
        .collect();
    assert_eq!(requests.len(), 2);
    let second: Value = serde_json::from_slice(&requests[1].body)?;
    let assistant = second["messages"]
        .as_array()
        .unwrap()
        .iter()
        .find(|message| message.get("tool_calls").is_some())
        .unwrap();
    assert_eq!(
        assistant["reasoning_content"],
        "Need to run the command before answering."
    );
    assert_eq!(assistant["content"][0]["text"], "Running the command.");
    assert!(
        second["messages"]
            .as_array()
            .unwrap()
            .iter()
            .any(|message| message["role"] == "tool"
                && message["tool_call_id"] == "provider-call"
                && message["content"]
                    .as_str()
                    .is_some_and(|text| text.contains("provider-tool-ok")))
    );
    assert!(
        requests
            .iter()
            .all(|request| !request.headers.contains_key("chatgpt-account-id"))
    );
    Ok(())
}
