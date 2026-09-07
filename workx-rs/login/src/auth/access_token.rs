const PERSONAL_ACCESS_TOKEN_PREFIX: &str = "at-";

pub(super) enum WorkxAccessToken<'a> {
    PersonalAccessToken(&'a str),
    AgentIdentityJwt(&'a str),
}

pub(super) fn classify_workx_access_token(access_token: &str) -> WorkxAccessToken<'_> {
    if access_token.starts_with(PERSONAL_ACCESS_TOKEN_PREFIX) {
        WorkxAccessToken::PersonalAccessToken(access_token)
    } else {
        WorkxAccessToken::AgentIdentityJwt(access_token)
    }
}

#[cfg(test)]
#[path = "access_token_tests.rs"]
mod tests;
