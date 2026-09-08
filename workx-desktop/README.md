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

## Scripts

- `npm start` — launch the app with the Forge dev server
- `npm run package` — build an unpacked app
- `npm run make` — build distributables
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint

## Scope

This change ships the client shell and its design system. The transcript, project
list, and model catalog are seeded with typed sample data in
`src/data/workspace.ts`. Wiring the UI to `workx app-server` over JSON-RPC is the
next step; the data module is the intended seam.

OpenAI-exclusive product surfaces (ChatGPT account, plans, cloud tasks) are
deliberately omitted. Workx-owned surfaces that Codex also has — threads,
projects, pull requests, scheduled runs, plugins, approvals, terminal, files,
permission modes — are kept.
