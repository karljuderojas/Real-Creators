# Verified People

A Chrome extension that injects badges onto X/Twitter profiles and feed entries:

- 🟢 **Verified Creator** — green badge for real human artists curated by the founding team
- 🔴 **AI Creator** — red badge for known AI-operated accounts

> MVP build — developer mode only, offline-first, Supabase-backed.

---

## How it works

- A **background service worker** fetches both the human and AI creator lists from Supabase every 6 hours and caches them in `chrome.storage.local`. Badges render even when offline between refresh cycles.
- A **content script** injects badges next to usernames on profile pages and in the feed. A debounced `MutationObserver` handles X/Twitter's virtualized, continuously re-rendering timeline. SPA navigation is handled by patching `history.pushState`.
- **Analytics** (badge impressions and profile visits for human creators) are batched in memory and flushed to Supabase every 60 seconds using an anonymous install-time session ID. No PII is collected.

---

## Setup

### 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** and run [`supabase_setup.sql`](supabase_setup.sql) — creates the `verified_creators` table, analytics tables, RLS policies, and seeds all 20 human creators.
3. Then run [`supabase_ai_creators.sql`](supabase_ai_creators.sql) — creates the `ai_creators` table, RLS policies, and seeds the initial AI accounts.

### 2. Load into Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked** and select this folder
4. Navigate to [x.com](https://x.com) — badges appear automatically on matching profiles and in the feed

The toolbar popup shows human creator count, AI account count, last sync time, and connection status.

---

## File structure

```
├── manifest.json             Chrome MV3 manifest
├── background.js             Service worker: list cache + analytics batching
├── content.js                Badge injection (profile pages + feed)
├── content.css               Badge styles with dark-mode support
├── popup.html                Toolbar popup markup
├── popup.js                  Popup logic (status display)
├── popup.css                 Popup styles
├── icons/                    Extension icons (16, 32, 48, 128 px)
├── supabase_setup.sql        Human creators schema, analytics, RLS, seed data + dashboard queries
└── supabase_ai_creators.sql  AI creators schema, RLS, seed data
```

---

## Verified human creators (seed list)

| Handle | Handle | Handle | Handle |
|---|---|---|---|
| @CAULISSIMO | @koizumi_arata | @AisuAsai | @SEBU_illust |
| @ninomaeinanis | @Diptipper | @appleseed_art | @bulbaasaur |
| @Taotan_cos | @paw_chie | @wooperfuri | @hakosbaelz |
| @ma_draws | @advarcher | @Spiritsnare | @Phosphatide |
| @jamutako | @Spartanii121 | @chiyu_hnkr | @mpien6 |

To add a creator: insert a row into `verified_creators` in the Supabase dashboard. To remove one: set `status = 'removed'` — the badge disappears on the next 6-hour cache refresh.

---

## AI creators (seed list)

| Handle |
|---|
| @monomidechu |
| @LifelongOrca98 |

To add an account: insert a row into `ai_creators` in the Supabase dashboard. To remove one: set `status = 'removed'`.

---

## Analytics

Tracked in Supabase — all anonymous, no PII:

| Metric | Table | Description |
|---|---|---|
| Badge impressions | `badge_impressions` | Every time a human creator badge renders |
| Profile visits | `profile_visits` | Every click from the feed to a verified human profile |
| Weekly active users | derived | Distinct session IDs per week from `badge_impressions` |

Dashboard queries for all three are included as comments at the bottom of [`supabase_setup.sql`](supabase_setup.sql).

**90-day success threshold:** profile visit rate ≥ 10–15% per badge impression.

---

## Known limitations (pre-public-launch)

- **DOM selectors can break.** X/Twitter updates their front-end regularly. If badges stop appearing, check the `data-testid` values in [`content.js`](content.js) against the live DOM.
- **Anon key is extractable.** The Supabase anon key is embedded in the extension and can be extracted by anyone who unpacks it. Acceptable at seed scale; before any public launch this should move behind an authenticated edge function.
- **No auto-updates.** Developer mode extensions don't update automatically. Publishing to the Chrome Web Store resolves this and requires a privacy policy before submission.
