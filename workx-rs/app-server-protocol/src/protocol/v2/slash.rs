use crate::JsonSchema;
use crate::TS;
use crate::slash_commands::SlashCommand;
use serde::Deserialize;
use serde::Serialize;

/// EXPERIMENTAL - list built-in slash commands.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct SlashCommandsListParams {}

/// EXPERIMENTAL - metadata for a built-in slash command.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct SlashCommandInfo {
    /// Canonical command name without the leading slash.
    pub name: String,
    /// Alternative names that resolve to the same command.
    pub aliases: Vec<String>,
    /// User-visible description shown in the command popup.
    pub description: String,
    /// Whether the command accepts inline arguments, e.g. `/review ...`.
    pub supports_inline_args: bool,
    /// Whether the command can run while a task is already in progress.
    pub available_during_task: bool,
}

impl From<SlashCommand> for SlashCommandInfo {
    fn from(command: SlashCommand) -> Self {
        Self {
            name: command.command().to_string(),
            aliases: command
                .aliases()
                .iter()
                .map(|alias| (*alias).to_string())
                .collect(),
            description: command.description().to_string(),
            supports_inline_args: command.supports_inline_args(),
            available_during_task: command.available_during_task(),
        }
    }
}

/// EXPERIMENTAL - built-in slash commands response.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct SlashCommandsListResponse {
    pub data: Vec<SlashCommandInfo>,
}
