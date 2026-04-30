const dot = document.getElementById('status-dot');
const creatorCount = document.getElementById('creator-count');
const aiCount = document.getElementById('ai-count');
const pendingCount = document.getElementById('pending-count');
const lastSync = document.getElementById('last-sync');
const msg = document.getElementById('msg');

chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (status) => {
  if (!status) {
    setDot('error');
    msg.textContent = 'Could not reach the extension background worker.';
    return;
  }

  creatorCount.textContent = status.creatorCount;
  aiCount.textContent = status.aiCount;
  pendingCount.textContent = status.pendingCount ?? 0;

  if (status.lastUpdated) {
    const mins = Math.round((Date.now() - status.lastUpdated) / 60000);
    lastSync.textContent = mins < 2 ? 'just now' : mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
  } else {
    lastSync.textContent = 'never';
  }

  if (!status.configured) {
    setDot('warning');
    msg.textContent = 'Supabase is not configured. Open background.js and set your URL and anon key to enable live sync.';
  } else if (status.creatorCount === 0 && status.aiCount === 0) {
    setDot('warning');
    msg.textContent = 'No creators loaded yet. The list syncs every 6 hours.';
  } else {
    setDot('ok');
    msg.textContent = `Badges active: ${status.creatorCount} Human Creators, ${status.aiCount} AI Creators.`;
  }
});

function setDot(state) {
  dot.className = `dot dot--${state}`;
  const labels = { ok: 'Active', warning: 'Warning', error: 'Error', loading: 'Loading' };
  dot.title = labels[state] || state;
}

// ── Icon-only toggle ──
const iconOnlyToggle = document.getElementById('icon-only-toggle');

chrome.storage.local.get('vp_icon_only', (data) => {
  iconOnlyToggle.checked = data.vp_icon_only === true;
});

iconOnlyToggle.addEventListener('change', () => {
  chrome.storage.local.set({ vp_icon_only: iconOnlyToggle.checked });
});
