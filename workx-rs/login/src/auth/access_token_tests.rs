use super::*;

#[test]
fn classifies_personal_access_tokens_by_prefix() {
    assert!(matches!(
        classify_workx_access_token("at-example"),
        WorkxAccessToken::PersonalAccessToken("at-example")
    ));
    assert!(matches!(
        classify_workx_access_token("header.payload.signature"),
        WorkxAccessToken::AgentIdentityJwt("header.payload.signature")
    ));
}
