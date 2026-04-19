# Hope Mobile

Hope is an Expo React Native app that surfaces constructive, credible news: live RSS-style feeds, on-device story classification (including MobileBERT / ONNX paths under `src/app/ml/`), category browsing, caching, and an in-app WebView reader. Product documentation also lives in Notion (including a git commit timeline you can sync from this repo).

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start the Expo dev server:

```bash
npm run start
```

3. Test on a device:

- Install **Expo Go** (or use `npm run ios` / `npm run android` for dev builds).
- Same Wi‑Fi as your machine, or use tunneling if discovery fails:

```bash
npm run start:tunnel
```

## Scripts

| Command | Purpose |
|--------|---------|
| `npm run start` | Dev server |
| `npm run start:tunnel` | Tunnel when LAN discovery fails |
| `npm run ios` / `npm run android` | Native runs |
| `npm run web` | Web preview |
| `npm run hooks:install` | Point Git at `.githooks` (once per clone) |

Typecheck: `npx tsc --noEmit`

## UI and typography (recent work)

- **Story cards:** Two-band layout—header with title + source, body with full description (no artificial min-height), footer row with score (`✦ x/10`) and `category • time`. Colors use the existing theme tokens.
- **Fonts:** **Avenir Next** on iOS (system faces). **Inter** on Android and web via bundled TTFs in `assets/fonts/` (`Inter-Regular` through `Inter-ExtraBold`), loaded with `expo-font` and mapped in `App.tsx` (`fontSans` / `Inter_400` … `Inter_800`). Splash headline uses the same weight mapping.
- **Attribution:** See `ATTRIBUTIONS.md` for Inter (OFL).

## Optional: Notion commit log

The repo can append each local commit as a line on a Notion page (**Hope — git commit timeline**) using the Notion API (not the Cursor Notion plugin, which does not run from Git hooks).

1. Create a Notion internal integration and connect it to that page.
2. Add `NOTION_TOKEN=secret_…` to **`.env`** in the repo root (gitignored).
3. Run `npm run hooks:install` so `.githooks/post-commit` runs.
4. The script `scripts/notion-append-commit.mjs` uses **`PATCH`** on `/v1/blocks/{page}/children`, reads `scripts/notion-commit-log-config.json` for the page id, and writes a short **user-impact** style line (subject + optional first line of commit body). Set `NOTION_COMMIT_LOG_VERBOSE=1` to log skips, errors, or success.

Commits still succeed if Notion is skipped or the network fails.

## Project layout (high level)

| Path | Role |
|------|------|
| `App.tsx` | Main app: feed UI, reader modal, theme, fonts, splash |
| `src/app/data/mockNews.ts` | Feed source configuration |
| `src/app/ml/` | On-device classification helpers |
| `assets/fonts/` | Inter static fonts for Android/web |
| `scripts/` | Notion append helper + page id config |
| `.githooks/` | `post-commit` hook (optional Notion append) |

Other folders (e.g. `src/app/components` with web/shadcn-style pieces) support alternate or legacy web UI experiments; the primary mobile experience is driven from `App.tsx`.
