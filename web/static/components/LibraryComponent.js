// LibraryComponent.js
// Renders the Library page using the mock library service.

import * as library from '../services/libraryService.js';

function bookCard(item) {
  return `
    <article class="flex gap-3 p-3 border border-zinc-200 rounded-xl bg-white hover:shadow-card-hover transition">
      <img src="${item.cover_url}" alt="cover" class="w-12 h-16 object-cover rounded"/>
      <div class="flex-1 min-w-0">
        <h4 class="text-sm font-semibold text-zinc-800 truncate">${item.title}</h4>
        <p class="text-xs text-zinc-500 truncate">${(item.authors || []).join(', ')}</p>
        <p class="mt-1 text-[11px] text-zinc-400">Formats: ${(item.formats || []).join(', ')}</p>
        <p class="mt-1 text-[11px] text-zinc-400 truncate font-mono">${item.outputPath}</p>
      </div>
      <button data-id="${item.id}" class="px-3 py-1.5 text-xs border border-zinc-300 rounded hover:bg-zinc-50">Details</button>
    </article>
  `;
}

export function createLibraryHTML() {
  return `
    <section class="mb-6">
      <h2 class="text-xl font-semibold mb-1">Library</h2>
      <p class="text-sm text-zinc-500">Books you've already downloaded (mocked).</p>
    </section>
    <section class="mb-3">
      <div class="flex items-center justify-between">
        <div></div>
        <button id="library-refresh" class="px-3 py-1.5 text-xs border border-zinc-300 rounded hover:bg-zinc-50">Refresh</button>
      </div>
    </section>
    <section id="library-grid" class="grid grid-cols-1 gap-3">
      <div class="text-sm text-zinc-500">Loading...</div>
    </section>
  `;
}

export function initLibrary() {
  const grid = document.getElementById('library-grid');
  const refreshBtn = document.getElementById('library-refresh');

  async function render() {
    const { items } = await library.getAll();
    if (!items || items.length === 0) {
      grid.innerHTML = '<div class="text-sm text-zinc-400">No books yet.</div>';
      return;
    }
    grid.innerHTML = items.map(bookCard).join('');
    grid.querySelectorAll('button[data-id]').forEach(btn => btn.addEventListener('click', onDetails));
  }

  async function onDetails(e) {
    const id = e.currentTarget.dataset.id;
    const { item, error } = await library.getOne(id);
    if (error) return;
    alert(`${item.title}\n\nFormats: ${item.formats.join(', ')}\nPath: ${item.outputPath}`);
  }

  refreshBtn.addEventListener('click', async () => {
    await library.refresh();
    render();
  });

  render();
}
