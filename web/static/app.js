/**
 * O'Reilly Ingest - Frontend Application
 * Redesigned with Tailwind CSS
 */

import * as apiService from './services/apiService.js';
import { initCookieModal } from './components/CookieModalComponent.js';
import { initSearch } from './components/SearchComponent.js';
import { createBookCardHTML, setupBookCardEvents, collapseBook } from './components/BookCardComponent.js';
import * as stateService from './services/stateService.js';

let { currentExpandedCard, selectedResultIndex, defaultOutputDir, chaptersCache } = stateService.getState();

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

document.addEventListener('DOMContentLoaded', () => {
    // Initialize services and components
    initCookieModal();

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

    // Auth
    apiService.checkAuth().then(data => {
        const el = document.getElementById('auth-status');
        const loginBtn = document.getElementById('login-btn');
        const statusDot = el.querySelector('.status-dot');
        const statusText = el.querySelector('.status-text');

        if (data.valid) {
            if (statusText) statusText.textContent = 'Session Valid';
            statusDot.className = 'status-dot w-2 h-2 rounded-full bg-emerald-500';
            el.className = 'flex items-center gap-2 text-sm text-emerald-600';
            loginBtn.classList.add('hidden');
        } else {
            if (statusText) statusText.textContent = data.reason || 'Invalid';
            statusDot.className = 'status-dot w-2 h-2 rounded-full bg-amber-500';
            el.className = 'flex items-center gap-2 text-sm text-amber-600';
            loginBtn.classList.remove('hidden');
        }
    }).catch(err => {
        console.error('Auth check failed:', err);
    });

    // Load default output dir
    apiService.loadDefaultOutputDir().then(data => {
        stateService.setState({ defaultOutputDir: data.output_dir });
    }).catch(err => {
        console.error('Failed to load default output dir:', err);
    });

    // Click outside to collapse
    document.addEventListener('click', (e) => {
        if (currentExpandedCard && !currentExpandedCard.contains(e.target)) {
            collapseBook();
        }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        const results = document.querySelectorAll('.book-card');
        const searchInput = document.getElementById('search-input');

        if (e.key === 'Escape') {
            if (currentExpandedCard) {
                collapseBook();
                e.preventDefault();
            }
            return;
        }

        if (e.key === 'Enter' && document.activeElement === searchInput) {
            const query = searchInput.value.trim();
            if (query.length >= 2) {
                // Trigger search manually
                e.preventDefault();
                // We rely on SearchComponent's input handler
            }
            return;
        }

        if (!results.length || currentExpandedCard) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedResultIndex = Math.min(selectedResultIndex + 1, results.length - 1);
            updateSelectedResult();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedResultIndex = Math.max(selectedResultIndex - 1, 0);
            updateSelectedResult();
        } else if (e.key === 'Enter' && selectedResultIndex >= 0) {
            e.preventDefault();
            const selected = results[selectedResultIndex];
            if (selected) {
                expandBook(selected, selected.dataset.bookId);
            }
        }
    });
});

stateService.subscribe((newState) => {
    currentExpandedCard = newState.currentExpandedCard;
    selectedResultIndex = newState.selectedResultIndex;
    defaultOutputDir = newState.defaultOutputDir;
    chaptersCache = newState.chaptersCache;
});
