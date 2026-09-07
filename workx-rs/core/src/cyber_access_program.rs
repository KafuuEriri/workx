use workx_api::AccessPrograms;
use workx_login::WorkxAuth;
use workx_protocol::turn_input::CyberAccessProgram;

pub(crate) fn for_auth(
    auth: Option<&WorkxAuth>,
    program: Option<CyberAccessProgram>,
) -> Option<AccessPrograms> {
    program
        .filter(|_| auth.is_some_and(WorkxAuth::is_chatgpt_auth))
        .map(AccessPrograms::from)
}
