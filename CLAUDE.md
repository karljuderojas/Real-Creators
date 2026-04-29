# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Loading the extension

There is no build step — this is a raw Chrome MV3 extension loaded unpacked:

1. Go to `chrome://extensions`, enable Developer mode
2. Click "Load unpacked" and select this folder
3. After any code change, click the reload icon on the extension card (or use the Extensions toolbar button → "Reload extension")
4. Content script changes also require refreshing the target tab (x.com)

To debug the background service worker, click "Service Worker" on the extension card in `chrome://extensions`.

## Supabase credentials

`background.js` on the `master` branch has placeholder credentials (`YOUR_SUPABASE_URL`, `YOUR_SUPABASE_ANON_KEY`). Before running the extension locally, replace these with the real values. **Never commit real credentials.**

The actual project is at `https://vbjshhbzedvzchljvraj.supabase.co` — the anon key is stored only locally.

## Architecture

The extension has three independent execution contexts that communicate via Chrome message passing:

**`background.js` (service worker)** — the single source of truth for data. Fetches both creator lists from Supabase every 6 hours via `chrome.alarms` and caches them in `chrome.storage.local`. Batches analytics (badge impressions, profile visits) in memory and flushes to Supabase every 60 seconds. Responds to four message types from the other contexts: `GET_VERIFIED_HANDLES`, `GET_STATUS`, `BADGE_IMPRESSION`, `PROFILE_VISIT`.

**`content.js` + `content.css` (injected into x.com)** — reads both handle maps once on load (via `GET_VERIFIED_HANDLES`), then scans the DOM for matching usernames and injects `.vp-verified-badge` (green) or `.vp-ai-badge` (blue) elements. A debounced `MutationObserver` re-scans on DOM changes. SPA navigation is handled by patching `history.pushState` / `history.replaceState`.

**`popup.html` + `popup.js` + `popup.css`** — toolbar popup. Sends `GET_STATUS` once on open and renders current counts and sync time.

## Data model

Two Supabase tables drive the lists:
- `verified_creators` — human creators; filtered by `verified=eq.true&status=eq.active`
- `ai_creators` — AI accounts; filtered by `status=eq.active`

Both are stored in `chrome.storage.local` as plain objects mapping `lowercase_handle → display_name`. To soft-delete, set `status = 'removed'` in Supabase; the badge disappears after the next 6-hour refresh.

Two analytics tables receive anonymous writes: `badge_impressions` and `profile_visits`. Both include `twitter_handle`, `timestamp`, and `session_id` (a `crypto.randomUUID()` generated at install time, persisted in storage).

## Key fragility points

- **X/Twitter DOM selectors** — `[data-testid="tweet"]`, `[data-testid="User-Name"]`, `[data-testid="UserName"]` break whenever Twitter ships a front-end update. Check these first if badges stop appearing.
- **Handle extraction regex** — `/^\/([A-Za-z0-9_]{1,50})(?:\/|$)/` used in `resolveHandleFromUserNameEl()` and the `isValidHandle()` guard in the background. Both must stay in sync if the pattern changes.
- **`NON_PROFILE_PATHS`** in `content.js` — paths that look like `/<word>` but are not profiles. Update this set if X adds new top-level routes.
