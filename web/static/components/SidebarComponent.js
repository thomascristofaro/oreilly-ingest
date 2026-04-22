import { initSearch, createSearchHTML } from './SearchComponent.js';
import { createBookCardHTML, setupBookCardEvents, collapseBook } from './BookCardComponent.js';
import * as stateService from '../services/stateService.js';

let currentExpandedCard = null;
let selectedResultIndex = -1;

function updateSelectedResult() {
    const results = document.querySelectorAll('.book-card');
    results.forEach((r, i) => {
        if (i === selectedResultIndex) {
            r.classList.add('ring-2', 'ring-oreilly-blue/30');
        } else {
            r.classList.remove('ring-2', 'ring-oreilly-blue/30');
        }
    });
    if (selectedResultIndex >= 0 && results[selectedResultIndex]) {
        results[selectedResultIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function createSidebarItems() {
    const sidebar = document.getElementById('sidebar');

    const menuItems = [
        { id: 'search', label: 'Search' },
        { id: 'library', label: 'Library' },
        { id: 'downloads', label: 'Downloads' },
        { id: 'settings', label: 'Settings' },
    ];

    menuItems.forEach(item => {
        const btn = document.createElement('button');
        btn.id = `sidebar-${item.id}`;
        btn.textContent = item.label;
        btn.className = 'py-3 px-4 text-left text-zinc-700 hover:bg-zinc-100 focus:outline-none focus:bg-zinc-200';
        btn.addEventListener('click', () => {
            setActivePage(item.id);
        });
        sidebar.appendChild(btn);
    });
}

let activePage = 'search';

function setActivePage(pageId) {
    activePage = pageId;

    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    Array.from(sidebar.children).forEach(btn => {
        if (btn.id === `sidebar-${pageId}`) {
            btn.classList.add('bg-oreilly-blue/20', 'font-semibold', 'text-oreilly-blue');
        } else {
            btn.classList.remove('bg-oreilly-blue/20', 'font-semibold', 'text-oreilly-blue');
        }
    });

    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    switch (pageId) {
        case 'search':
            mainContent.innerHTML = createSearchHTML();
            initSearch({
                onResultsRendered(results) {
                    const container = document.getElementById('search-results');
                    container.innerHTML = '';
                    currentExpandedCard = null;
                    selectedResultIndex = -1;

                    if (!results || results.length === 0) {
                        container.innerHTML = `
                            <div class="text-center py-16 text-zinc-500">
                                <p class="text-lg">No books found</p>
                                <p class="text-sm mt-2 text-zinc-400">Try a different search term or ISBN</p>
                            </div>
                        `;
                        return;
                    }

                    for (const book of results) {
                        const div = document.createElement('article');
                        div.className = 'book-card group bg-white rounded-xl border border-zinc-200 overflow-hidden transition-all duration-200 hover:border-zinc-300 hover:shadow-card-hover';
                        div.dataset.bookId = book.id;
                        div.innerHTML = createBookCardHTML(book);

                        setupBookCardEvents(div, book);
                        container.appendChild(div);
                    }
                }
            });
            break;
        case 'library':
            mainContent.innerHTML = `<div class="p-4 text-zinc-600">Library page content coming soon.</div>`;
            break;
        case 'downloads':
            mainContent.innerHTML = `<div class="p-4 text-zinc-600">Downloads page content coming soon.</div>`;
            break;
        case 'settings':
            mainContent.innerHTML = `<div class="p-4 text-zinc-600">Settings page content coming soon.</div>`;
            break;
        default:
            mainContent.innerHTML = '';
    }
}

export function initSidebar() {
    createSidebarItems();
    setActivePage(activePage);
}
