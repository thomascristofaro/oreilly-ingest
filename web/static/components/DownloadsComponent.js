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
  let pollInterval = null;

  async function render(progressOnly = false) {
    if (progressOnly) {
      // Only refresh the active item's progress to reduce load
      // Stop if we navigated away from the Downloads page
      if (!activeEl || !activeEl.isConnected) {
        if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
        return;
      }
      const { active } = await downloads.getActive();
      const activeId = active?.id ?? null;
      if (active) {
        activeEl.classList.remove('hidden');
        activeEl.innerHTML = `
          <div class="p-4 border border-oreilly-blue rounded-xl bg-oreilly-blue-light/40">
            <div class="flex items-center gap-3">
              <span class="text-[10px] uppercase font-bold text-oreilly-blue">Active</span>
              ${statusBadge('running')}
            </div>
            <div class="mt-2">${itemRowHTML(active, activeId)}</div>
          </div>`;
      } else {
        activeEl.classList.add('hidden');
        activeEl.innerHTML = '';
        // No active download anymore - stop polling
        if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
      }
      return;
    }

    const [{ items, activeId }, history] = await Promise.all([
      downloads.getQueue(),
      downloads.getHistory()
    ]);

    const queued = items.filter(x => x.status === 'queued');
    const running = items.filter(x => x.status === 'running');

    // Active
    const active = running[0];
    if (active) {
      activeEl.classList.remove('hidden');
      activeEl.innerHTML = `
        <div class="p-4 border border-oreilly-blue rounded-xl bg-oreilly-blue-light/40">
          <div class="flex items-center gap-3">
            <span class="text-[10px] uppercase font-bold text-oreilly-blue">Active</span>
            ${statusBadge('running')}
          </div>
          <div class="mt-2">${itemRowHTML(active, activeId)}</div>
        </div>`;
    } else {
      activeEl.classList.add('hidden');
      activeEl.innerHTML = '';
    }

    // Queue
    const queueHTML = queued.map(it => itemRowHTML(it, activeId)).join('');
    listEl.innerHTML = queueHTML || '<div class="text-sm text-zinc-400">No items in queue.</div>';

    // History
    const histItems = history.items || [];
    historyEl.innerHTML = histItems.map(it => itemRowHTML(it, activeId)).join('') || '<div class="text-sm text-zinc-400">No recent history.</div>';

    // Wire actions
    listEl.querySelectorAll('[data-action],button[data-action]').forEach(btn => {
      btn.addEventListener('click', onAction);
    });
    historyEl.querySelectorAll('[data-action],button[data-action]').forEach(btn => {
      btn.addEventListener('click', onAction);
    });

    // Start/stop polling depending on page presence and active job
    if (!activeEl || !activeEl.isConnected) {
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    } else if (active) {
      if (!pollInterval) {
        pollInterval = setInterval(() => render(true), 1000);
      }
    } else {
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    }
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
      render();
    }
  }

  // Ensure full refresh (queue + history), avoid passing the event object as progressOnly
  refreshBtn.addEventListener('click', () => render(false));

  render();
  // Polling starts/stops automatically based on page and active job.
}
