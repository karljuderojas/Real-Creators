// ── Configuration ────────────────────────────────────────────────────────────
// Replace these with your actual Supabase project values before loading the extension.
const SUPABASE_URL = 'https://vbjshhbzedvzchljvraj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZianNoaGJ6ZWR2emNobGp2cmFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDA5MzksImV4cCI6MjA5MjkxNjkzOX0.7Gq2H5YxZbSvYDnwKgd00ULvFT7hATZYAEO_WcdJOxw';

// ── Constants ─────────────────────────────────────────────────────────────────
const CACHE_KEY = 'verified_handles';
const AI_CACHE_KEY = 'ai_handles';
const CACHE_UPDATED_KEY = 'cache_updated_at';
const SESSION_ID_KEY = 'session_id';
const REFRESH_ALARM = 'vp_refresh_list';
const ANALYTICS_ALARM = 'vp_flush_analytics';
const CACHE_TTL_MINUTES = 6 * 60; // 6 hours
const ANALYTICS_FLUSH_MINUTES = 1; // 60-second batch window

// ── In-memory analytics queues (flushed every minute) ─────────────────────────
let impressionQueue = [];
let visitQueue = [];

// ── Install / startup ─────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  await ensureSessionId();
  await refreshVerifiedList();
  scheduleAlarms();
});

chrome.runtime.onStartup.addListener(async () => {
  await maybeRefreshList();
  scheduleAlarms();
});

function scheduleAlarms() {
  chrome.alarms.get(REFRESH_ALARM, (a) => {
    if (!a) chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: CACHE_TTL_MINUTES });
  });
  chrome.alarms.get(ANALYTICS_ALARM, (a) => {
    if (!a) chrome.alarms.create(ANALYTICS_ALARM, { periodInMinutes: ANALYTICS_FLUSH_MINUTES });
  });
}

async function ensureSessionId() {
  const data = await chrome.storage.local.get(SESSION_ID_KEY);
  if (!data[SESSION_ID_KEY]) {
    await chrome.storage.local.set({ [SESSION_ID_KEY]: crypto.randomUUID() });
  }
}

// ── List refresh ──────────────────────────────────────────────────────────────
async function maybeRefreshList() {
  const data = await chrome.storage.local.get(CACHE_UPDATED_KEY);
  const lastUpdated = data[CACHE_UPDATED_KEY] || 0;
  const staleCutoff = Date.now() - CACHE_TTL_MINUTES * 60 * 1000;
  if (lastUpdated < staleCutoff) {
    await refreshVerifiedList();
  }
}

async function refreshVerifiedList() {
  if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
    console.warn('[VerifiedPeople] Supabase not configured. Using empty list.');
    return;
  }

  await Promise.all([refreshHumanList(), refreshAiList()]);

  await chrome.storage.local.set({ [CACHE_UPDATED_KEY]: Date.now() });
}

async function refreshHumanList() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/verified_creators?verified=eq.true&status=eq.active&select=twitter_handle,display_name`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const creators = await res.json();
    const handles = {};
    for (const c of creators) {
      handles[c.twitter_handle.toLowerCase()] = c.display_name || c.twitter_handle;
    }
    await chrome.storage.local.set({ [CACHE_KEY]: handles });
    console.log(`[VerifiedPeople] Human list refreshed: ${Object.keys(handles).length} creators`);
  } catch (err) {
    console.error('[VerifiedPeople] Human list refresh failed:', err);
  }
}

async function refreshAiList() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/ai_creators?status=eq.active&select=twitter_handle,display_name`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const creators = await res.json();
    const handles = {};
    for (const c of creators) {
      handles[c.twitter_handle.toLowerCase()] = c.display_name || c.twitter_handle;
    }
    await chrome.storage.local.set({ [AI_CACHE_KEY]: handles });
    console.log(`[VerifiedPeople] AI list refreshed: ${Object.keys(handles).length} accounts`);
  } catch (err) {
    console.error('[VerifiedPeople] AI list refresh failed:', err);
  }
}

// ── Analytics flush ───────────────────────────────────────────────────────────
async function flushAnalytics() {
  if (SUPABASE_URL === 'YOUR_SUPABASE_URL') return;

  const data = await chrome.storage.local.get(SESSION_ID_KEY);
  const sessionId = data[SESSION_ID_KEY];

  const impressions = impressionQueue.splice(0);
  const visits = visitQueue.splice(0);

  if (impressions.length > 0) {
    await writeRows('badge_impressions', impressions.map((e) => ({ ...e, session_id: sessionId })));
  }
  if (visits.length > 0) {
    await writeRows('profile_visits', visits.map((e) => ({ ...e, session_id: sessionId })));
  }
}

async function writeRows(table, rows) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(rows),
    });
  } catch (err) {
    console.error(`[VerifiedPeople] Analytics write failed (${table}):`, err);
  }
}

// ── Validation ────────────────────────────────────────────────────────────────
function isValidHandle(handle) {
  return typeof handle === 'string' && /^[A-Za-z0-9_]{1,50}$/.test(handle);
}

// ── Alarm handler ─────────────────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) refreshVerifiedList();
  if (alarm.name === ANALYTICS_ALARM) flushAnalytics();
});

// ── Message handler (content script ↔ background) ────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'GET_VERIFIED_HANDLES':
      chrome.storage.local.get([CACHE_KEY, AI_CACHE_KEY], (data) => {
        sendResponse({
          verified: data[CACHE_KEY] || {},
          ai: data[AI_CACHE_KEY] || {},
        });
      });
      return true; // keep port open for async response

    case 'BADGE_IMPRESSION':
      if (isValidHandle(message.handle)) {
        impressionQueue.push({
          twitter_handle: message.handle,
          timestamp: new Date().toISOString(),
        });
      }
      break;

    case 'PROFILE_VISIT':
      if (isValidHandle(message.handle)) {
        visitQueue.push({
          twitter_handle: message.handle,
          timestamp: new Date().toISOString(),
        });
      }
      break;

    case 'GET_STATUS':
      chrome.storage.local.get([CACHE_KEY, AI_CACHE_KEY, CACHE_UPDATED_KEY], (data) => {
        sendResponse({
          creatorCount: Object.keys(data[CACHE_KEY] || {}).length,
          aiCount: Object.keys(data[AI_CACHE_KEY] || {}).length,
          lastUpdated: data[CACHE_UPDATED_KEY] || null,
          configured: SUPABASE_URL !== 'YOUR_SUPABASE_URL',
        });
      });
      return true;

    case 'SUBMIT_CREATOR':
      if (isValidHandle(message.handle) && ['human', 'ai', 'unsure'].includes(message.vote)) {
        submitCreator(message.handle, message.vote);
      }
      break;
  }
});

// ── Crowdsourced submissions ───────────────────────────────────────────────
async function submitCreator(handle, vote) {
  if (SUPABASE_URL === 'YOUR_SUPABASE_URL') return;
  const data = await chrome.storage.local.get(SESSION_ID_KEY);
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/creator_submissions`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        twitter_handle: handle.toLowerCase(),
        vote,
        session_id: data[SESSION_ID_KEY] || null,
      }),
    });
  } catch (err) {
    console.error('[VerifiedPeople] Submission failed:', err);
  }
}
