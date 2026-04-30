// ── State ─────────────────────────────────────────────────────────────────────
const BADGE_CLASS       = 'vp-verified-badge';
const AI_BADGE_CLASS    = 'vp-ai-badge';
const VOTE_WIDGET_CLASS = 'vp-vote-widget';
const DEBOUNCE_MS = 250;

// Non-profile path segments that share the /<word> URL pattern on X/Twitter
const NON_PROFILE_PATHS = new Set([
  'home', 'explore', 'notifications', 'messages', 'settings',
  'i', 'search', 'compose', 'login', 'signup', 'tos', 'privacy',
]);

let verifiedHandles  = {}; // lowercase handle → display_name
let aiHandles        = {}; // lowercase handle → display_name
let submittedHandles = new Set(); // handles this install has already voted on
let ready = false;

// ── Bootstrap ─────────────────────────────────────────────────────────────────
(async function init() {
  const [handleData, storedData] = await Promise.all([
    fetchHandles(),
    new Promise((resolve) => chrome.storage.local.get(['vp_submitted_handles', 'vp_icon_only'], resolve)),
  ]);
  verifiedHandles  = handleData.verified || {};
  aiHandles        = handleData.ai || {};
  submittedHandles = new Set(storedData.vp_submitted_handles || []);
  applyIconOnly(storedData.vp_icon_only === true);
  ready = true;
  runInjection();
  setupMutationObserver();
  watchNavigation();
  watchPreferences();
})();

function applyIconOnly(enabled) {
  document.documentElement.classList.toggle('vp-icon-only', enabled);
}

function watchPreferences() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.vp_icon_only) {
      applyIconOnly(changes.vp_icon_only.newValue === true);
    }
  });
}

function fetchHandles() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_VERIFIED_HANDLES' }, (res) => {
      void chrome.runtime.lastError;
      resolve(res || { verified: {}, ai: {} });
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function isVerified(handle) {
  return Boolean(handle && Object.hasOwn(verifiedHandles, handle.toLowerCase()));
}

function isAi(handle) {
  return Boolean(handle && Object.hasOwn(aiHandles, handle.toLowerCase()));
}

function getDisplayName(handle) {
  return verifiedHandles[handle.toLowerCase()] || aiHandles[handle.toLowerCase()] || handle;
}

function currentProfileHandle() {
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts.length !== 1) return null;
  if (NON_PROFILE_PATHS.has(parts[0].toLowerCase())) return null;
  return parts[0];
}

// ── Badge element factories ───────────────────────────────────────────────────
function makeBadge(handle) {
  const el = document.createElement('span');
  el.className = BADGE_CLASS;
  el.dataset.vpHandle = handle;
  el.title = `Verified Human Creator — ${getDisplayName(handle)}`;
  // prettier-ignore
  el.innerHTML =
    '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">' +
      '<path d="M6.5 0L8.1 2.2L10.8 1.6L10.7 4.4L13 6.5L10.7 8.6L10.8 11.4L8.1 10.8L6.5 13L4.9 10.8L2.2 11.4L2.3 8.6L0 6.5L2.3 4.4L2.2 1.6L4.9 2.2L6.5 0Z" fill="#22C55E"/>' +
      '<path d="M4 6.5L5.8 8.3L9 4.8" stroke="white" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>' +
    '<span>Verified Creator</span>';
  return el;
}

function makeAiBadge(handle) {
  const el = document.createElement('span');
  el.className = AI_BADGE_CLASS;
  el.dataset.vpHandle = handle;
  el.title = `AI Creator — ${getDisplayName(handle)}`;
  // Robot icon: square head, antenna, two eyes, grid mouth
  // prettier-ignore
  el.innerHTML =
    '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">' +
      // antenna
      '<line x1="6.5" y1="0" x2="6.5" y2="2.5" stroke="#3B82F6" stroke-width="1.2" stroke-linecap="round"/>' +
      '<circle cx="6.5" cy="1" r="0.8" fill="#3B82F6"/>' +
      // head
      '<rect x="1.5" y="2.5" width="10" height="8.5" rx="1.5" fill="#3B82F6"/>' +
      // eyes
      '<circle cx="4.5" cy="6" r="1.2" fill="white"/>' +
      '<circle cx="8.5" cy="6" r="1.2" fill="white"/>' +
      // mouth (grid of dots)
      '<rect x="3.5" y="8.5" width="6" height="1.2" rx="0.6" fill="white" opacity="0.8"/>' +
    '</svg>' +
    '<span>AI Creator</span>';
  return el;
}

// ── Vote widget ───────────────────────────────────────────────────────────────
function makeVoteWidget(handle) {
  const el = document.createElement('div');
  el.className = VOTE_WIDGET_CLASS;
  el.dataset.vpHandle = handle.toLowerCase();

  const prompt = document.createElement('span');
  prompt.className = 'vp-vote-prompt';
  prompt.textContent = 'Is this creator real?';

  const btnHuman = document.createElement('button');
  btnHuman.className = 'vp-vote-btn vp-vote-btn--human';
  btnHuman.textContent = 'Real Creator';
  btnHuman.onclick = () => castVote(handle, 'human', el);

  const btnAi = document.createElement('button');
  btnAi.className = 'vp-vote-btn vp-vote-btn--ai';
  btnAi.textContent = 'AI Creator';
  btnAi.onclick = () => castVote(handle, 'ai', el);

  const btnUnsure = document.createElement('button');
  btnUnsure.className = 'vp-vote-btn vp-vote-btn--unsure';
  btnUnsure.textContent = 'Not Sure';
  btnUnsure.onclick = () => castVote(handle, 'unsure', el);

  el.append(prompt, btnHuman, btnAi, btnUnsure);
  return el;
}

function castVote(handle, vote, widgetEl) {
  chrome.runtime.sendMessage({ type: 'SUBMIT_CREATOR', handle, vote }, () => {
    void chrome.runtime.lastError; // service worker may be asleep; suppress "no receiver" error
  });

  submittedHandles.add(handle.toLowerCase());
  chrome.storage.local.set({ vp_submitted_handles: [...submittedHandles] });

  widgetEl.innerHTML = '';
  const thanks = document.createElement('span');
  thanks.className = 'vp-vote-thanks';
  thanks.textContent = '✓ Thanks for your report';
  widgetEl.appendChild(thanks);
}

// ── Profile page ──────────────────────────────────────────────────────────────
function injectProfileBadge() {
  const handle = currentProfileHandle();
  if (!handle) return;

  const userNameEl = document.querySelector('[data-testid="UserName"]');
  if (!userNameEl) return;

  if (isVerified(handle) && !userNameEl.querySelector(`.${BADGE_CLASS}`)) {
    userNameEl.appendChild(makeBadge(handle));
    chrome.runtime.sendMessage({ type: 'BADGE_IMPRESSION', handle }, () => void chrome.runtime.lastError);
  }

  if (isAi(handle) && !userNameEl.querySelector(`.${AI_BADGE_CLASS}`)) {
    userNameEl.appendChild(makeAiBadge(handle));
  }

  // Show vote widget for handles not yet in either list
  const lc = handle.toLowerCase();
  if (!isVerified(handle) && !isAi(handle) && !submittedHandles.has(lc)) {
    if (!userNameEl.querySelector(`.${VOTE_WIDGET_CLASS}`)) {
      userNameEl.appendChild(makeVoteWidget(handle));
    }
  }
}

// ── Feed ──────────────────────────────────────────────────────────────────────
function injectFeedBadges() {
  const tweets = document.querySelectorAll('[data-testid="tweet"]');

  for (const tweet of tweets) {
    const userNameEl = tweet.querySelector('[data-testid="User-Name"]');
    if (!userNameEl) continue;

    const handle = resolveHandleFromUserNameEl(userNameEl);
    if (!handle) continue;

    if (isVerified(handle) && !userNameEl.querySelector(`.${BADGE_CLASS}`)) {
      userNameEl.appendChild(makeBadge(handle));
      chrome.runtime.sendMessage({ type: 'BADGE_IMPRESSION', handle }, () => void chrome.runtime.lastError);
      attachVisitTracking(userNameEl, handle);
    }

    if (isAi(handle) && !userNameEl.querySelector(`.${AI_BADGE_CLASS}`)) {
      userNameEl.appendChild(makeAiBadge(handle));
    }
  }
}

// Extract the Twitter handle from the User-Name element's profile links.
// Links inside User-Name are either /<handle> or /<handle>/status/…
function resolveHandleFromUserNameEl(el) {
  for (const a of el.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') || '';
    const m = href.match(/^\/([A-Za-z0-9_]{1,50})(?:\/|$)/);
    if (m && !NON_PROFILE_PATHS.has(m[1].toLowerCase())) {
      return m[1];
    }
  }
  return null;
}

function attachVisitTracking(userNameEl, handle) {
  for (const a of userNameEl.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') || '';
    if (href === `/${handle}` || href.toLowerCase() === `/${handle.toLowerCase()}`) {
      a.addEventListener(
        'click',
        () => chrome.runtime.sendMessage({ type: 'PROFILE_VISIT', handle }, () => void chrome.runtime.lastError),
        { once: true }
      );
    }
  }
}

// ── Orchestration ─────────────────────────────────────────────────────────────
function runInjection() {
  if (!ready) return;
  injectProfileBadge();
  injectFeedBadges();
}

// ── MutationObserver (debounced) ──────────────────────────────────────────────
function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

const debouncedRun = debounce(runInjection, DEBOUNCE_MS);

function setupMutationObserver() {
  new MutationObserver((mutations) => {
    if (mutations.some((m) => m.addedNodes.length > 0)) {
      debouncedRun();
    }
  }).observe(document.body, { childList: true, subtree: true });
}

// ── SPA navigation detection ──────────────────────────────────────────────────
// X/Twitter is a React SPA; pushState changes don't fire popstate.
// We patch history methods and also listen for popstate.
function watchNavigation() {
  let lastPath = location.pathname;

  function onNav() {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      // Brief delay lets React render the new page before we scan it.
      setTimeout(runInjection, 600);
    }
  }

  const origPush = history.pushState.bind(history);
  history.pushState = (...args) => { origPush(...args); onNav(); };

  const origReplace = history.replaceState.bind(history);
  history.replaceState = (...args) => { origReplace(...args); onNav(); };

  window.addEventListener('popstate', onNav);
}
