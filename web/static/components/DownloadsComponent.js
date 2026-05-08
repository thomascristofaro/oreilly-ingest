// DownloadsComponent.js
// Renders the Downloads page using the real downloads service.

import * as downloads from '../services/downloadsService.js';

function statusBadge(status) {
  const colors = {
    queued: 'bg-zinc-100 text-zinc-700',
    running: 'bg-oreilly-blue-light text-oreilly-blue',
    completed: 'bg-emerald-50 text-emerald-700',
    failed: 'bg-red-50 text-red-700',
    cancelled: 'bg-amber-50 text-amber-700',
  };
  return `<span class="px-2 py-0.5 text-xs font-medium rounded ${colors[status] || 'bg-zinc-100'}">${status}</span>`;
}

function itemRowHTML(item, activeId) {
  const isActive = String(item.id) === String(activeId);
  const progress = item.progress ?? 0;
  return `
    <div class="group rounded-xl border ${isActive ? 'border-oreilly-blue' : 'border-zinc-200'} bg-white p-4 flex items-center gap-4">
      <img src="${item.cover_url}" alt="cover" class="w-10 h-14 object-cover rounded shadow"/>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <h4 class="text-sm font-semibold text-zinc-800 truncate">${item.title}</h4>
          ${statusBadge(item.status)}
          ${item.message ? `<span class=\"text-xs text-zinc-500 truncate\">${item.message}</span>` : ''}
          ${isActive ? '<span class="text-[10px] uppercase font-bold text-oreilly-blue">ACTIVE</span>' : ''}
        </div>
        <p class="text-xs text-zinc-500 truncate">${(item.authors || []).join(', ')}</p>
        <div class="mt-2 h-1.5 bg-zinc-200 rounded">
          <div class="h-full bg-oreilly-blue rounded" style="width: ${progress}%"></div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        ${item.status === 'queued' || item.status === 'running' ? `<button data-action="cancel" data-id="${item.id}" class="px-3 py-1.5 text-xs border border-zinc-300 rounded hover:bg-zinc-50">Cancel</button>` : ''}
        ${item.status === 'failed' || item.status === 'cancelled' ? `<button data-action="retry" data-id="${item.id}" class="px-3 py-1.5 text-xs border border-zinc-300 rounded hover:bg-zinc-50">Retry</button>` : ''}
        ${item.status === 'completed' || item.status === 'cancelled' ? `<button data-action="remove" data-id="${item.id}" class="px-3 py-1.5 text-xs border border-zinc-300 rounded hover:bg-zinc-50">Remove</button>` : ''}
      </div>
    </div>
  `;
}

export function createDownloadsHTML() {
  return `
    <section class="mb-6">
      <h2 class="text-xl font-semibold mb-1">Downloads</h2>
      <p class="text-sm text-zinc-500">One at a time. Queue persists while this page is closed.</p>
    </section>
    <section id="downloads-active" class="mb-6 hidden"></section>
    <section>
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-zinc-700">Queue</h3>
        <div class="flex items-center gap-2">
          <button id="downloads-refresh" class="px-3 py-1.5 text-xs border border-zinc-300 rounded hover:bg-zinc-50">Refresh</button>
        </div>
      </div>
      <div id="downloads-list" class="space-y-3">
        <div class="text-sm text-zinc-500">Loading...</div>
      </div>
      <div class="mt-6">
        <h3 class="text-sm font-semibold text-zinc-700 mb-2">History</h3>
        <div id="downloads-history" class="space-y-3"></div>
      </div>
    </section>
  `;
}

export function initDownloads() {
  const listEl = document.getElementById('downloads-list');
  const activeEl = document.getElementById('downloads-active');
  const historyEl = document.getElementById('downloads-history');
  const refreshBtn = document.getElementById('downloads-refresh');

  // Polling + state
  let pollInterval = null;
  let hasPending = false; // true if there are queued or running items
  let lastActiveId = null; // track active to detect completion transitions

  // Helpers
  function activeSectionHTML(active, activeId) {
    return `
        <div class="p-4 border border-oreilly-blue rounded-xl bg-oreilly-blue-light/40">
          <div class="flex items-center gap-3">
            <span class="text-[10px] uppercase font-bold text-oreilly-blue">Active</span>
            ${statusBadge('running')}
          </div>
          <div class="mt-2">${itemRowHTML(active, activeId)}</div>
        </div>`;
  }

  function setActiveUI(active, activeId) {
    if (!activeEl) return;
    if (active) {
      activeEl.classList.remove('hidden');
      activeEl.innerHTML = activeSectionHTML(active, activeId);
    } else {
      activeEl.classList.add('hidden');
      activeEl.innerHTML = '';
    }
  }

  function wireActions(container) {
    container.querySelectorAll('[data-action],button[data-action]').forEach(btn => {
      btn.addEventListener('click', onAction);
    });
  }

  function stopPolling() {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  }

  function ensurePolling(isActivePresent = false) {
    // Start polling when there is something queued OR an active job, otherwise stop.
    const pagePresent = activeEl && activeEl.isConnected;
    if (!pagePresent) {
      stopPolling();
      return;
    }
    const shouldPoll = hasPending || isActivePresent;
    if (shouldPoll && !pollInterval) {
      pollInterval = setInterval(() => tickActive(), 1000);
    } else if (!shouldPoll && pollInterval) {
      stopPolling();
    }
  }

  // Progress-only tick. Keep it cheap: only hit /active and update the Active card.
  async function tickActive() {
    // Stop if we navigated away from the Downloads page
    if (!activeEl || !activeEl.isConnected) {
      stopPolling();
      return;
    }

    try {
      const { active } = await downloads.getActive();
      const activeId = active?.id ?? null;

      if (active) {
        // If a new active item started (different id), the previous one just completed.
        // Do a full refresh to update queue and history.
        if (lastActiveId !== null && active.id !== lastActiveId) {
          await renderFull();
          return;
        }
        setActiveUI(active, activeId);
        // Update lastActiveId so we can detect completion later
        lastActiveId = active.id;
      } else {
        // No active item now
        setActiveUI(null, null);

        // If we previously had an active item, it just completed -> do a full refresh
        if (lastActiveId !== null) {
          lastActiveId = null;
          await renderFull();
        }
        // Otherwise, keep polling if we still have items queued (hasPending=true)
      }
    } catch (err) {
      // Swallow to avoid breaking polling on transient errors
    }
  }

  async function renderFull() {
    const [{ items, activeId }, history] = await Promise.all([
      downloads.getQueue(),
      downloads.getHistory()
    ]);

    const queued = items.filter(x => x.status === 'queued');
    const running = items.filter(x => x.status === 'running');

    // Active section
    const active = running[0] || null;
    setActiveUI(active, activeId);

    // Track state for polling and completion detection
    hasPending = queued.length > 0 || !!active;
    lastActiveId = active ? active.id : null;

    // Queue
    const queueHTML = queued.map(it => itemRowHTML(it, activeId)).join('');
    listEl.innerHTML = queueHTML || '<div class="text-sm text-zinc-400">No items in queue.</div>';

    // History
    const histItems = history.items || [];
    historyEl.innerHTML = histItems.map(it => itemRowHTML(it, activeId)).join('') || '<div class="text-sm text-zinc-400">No recent history.</div>';

    // Wire actions
    wireActions(listEl);
    wireActions(historyEl);

    // Start/stop polling depending on page presence and items in queue or active job
    ensurePolling(!!active);
  }

  async function onAction(e) {
    const btn = e.currentTarget;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    btn.disabled = true;
    try {
      if (action === 'cancel') await downloads.cancel(id);
      if (action === 'retry') await downloads.retry(id);
      if (action === 'remove') await downloads.remove(id);
    } finally {
      btn.disabled = false;
      // Always perform a full refresh after an action
      renderFull();
    }
  }

  // Ensure full refresh (queue + history), avoid passing the event object
  refreshBtn.addEventListener('click', () => renderFull());

  // Initial load
  renderFull();
  // Polling starts/stops automatically based on page presence and queue/active state.
}
