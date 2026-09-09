# Workx Desktop

A Workx desktop client whose UI follows the Codex desktop app: a 275px sidebar,
a 46px toolbar, a 42rem transcript column, and the same light/dark palette.

The app is a fresh Electron application and is intentionally independent from the
pnpm workspace at the repository root. It has its own `package-lock.json` and is
installed with npm.

## Stack

- Electron Forge + Vite for build, packaging, and dev server
- React 19 + TypeScript
- Tailwind CSS 4
- `react-markdown` + `remark-gfm` for transcript rendering
- `lucide-react` for icons

## Design tokens

Colors, radii, spacing, and layout constants were extracted from the installed
Codex app bundle (`/Applications/ChatGPT.app/Contents/Resources/app.asar`) rather
than approximated. The notable values:

| Token | Value |
| --- | --- |
| Sidebar width | `275px` (`clamp(240px, 275px, min(520px, 100vw - 320px))`) |
| Toolbar height | `46px` |
| Transcript column | `42rem` |
| Light surface | `#ffffff`, sidebar `#f9f9f9`, foreground `#1a1c1f` |
| Dark surface | `#181818`, sidebar `#212121`, foreground `#dfdfdf` |
| Borders | foreground at 5% / 8% / 12% (light), white at 4% / 8% / 16% (dark) |

The proprietary OpenAI Sans font is not bundled. Workx uses the system UI font
stack instead.

## Run

```sh
npm install
npm start
```

The main process spawns `workx app-server --stdio` and speaks JSON-RPC over
stdin/stdout. The protocol types are imported from the checked-in TypeScript
schema at `../workx-rs/app-server-protocol/schema/typescript` (aliased as
`@protocol/*`), so the client stays in sync with the server.

Set `WORKX_BIN` to point at a different Workx binary, and `WORKX_CWD` to change
the directory used for new threads (defaults to the user's home directory).

## Wiring

The client negotiates the experimental app-server API and uses these methods:

- `initialize` / `initialized` — handshake with `clientInfo` and experimental
  capabilities
- `thread/list`, `thread/start`, `thread/resume` — chat history and new chats
- `thread/name/set`, `thread/archive`, `thread/delete` — sidebar actions
- `thread/search` — sidebar search
- `turn/start`, `turn/interrupt` — sending prompts and stopping a run
- `model/list` — model and reasoning-effort pickers
- `config/read`, `config/batchWrite` — model/provider selection and the provider
  manager (add, edit, and delete custom providers)
- `plugin/list`, `skills/list`, `mcpServerStatus/list` — Plugins / Skills / MCP
  panels
- `item/commandExecution/requestApproval`,
  `item/fileChange/requestApproval` — inline approval cards

Streaming notifications (`turn/started`, `item/started`, `item/completed`,
`item/agentMessage/delta`, `thread/tokenUsage/updated`, `turn/completed`,
`warning`, `error`, thread lifecycle events) update the transcript incrementally.

Server requests for surfaces the desktop does not implement are answered with a
JSON-RPC `-32601` error instead of hanging.

## Scripts

- `npm start` — launch the app with the Forge dev server
- `npm run package` — build an unpacked app
- `npm run make` — build distributables
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint

## Scope

OpenAI-exclusive product surfaces (ChatGPT account, plans, the pull-request
inbox, and cloud scheduled runs) are deliberately omitted. Workx-owned surfaces
that Codex also has — threads, projects, plugins, skills, MCP servers,
approvals, terminal activity, file changes, and permission modes — are kept.
