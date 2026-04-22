// SearchComponent.js
// Handles search input, debounced querying, and rendering search results list

import * as apiService from '../services/apiService.js';

export function initSearch({ onResultsRendered }) {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const loader = document.getElementById('search-loader');

    let searchTimeout;

    function clearResults() {
        searchResults.innerHTML = '';
        searchResults.classList.remove('has-expanded');
    }

    async function performSearch(query) {
        loader.classList.remove('hidden');
        try {
            const data = await apiService.search(query);
            loader.classList.add('hidden');
            searchResults.innerHTML = '';

            if (!data.results || data.results.length === 0) {
                searchResults.innerHTML = `
                    <div class="text-center py-16 text-zinc-500">
                        <p class="text-lg">No books found for "${query}"</p>
                        <p class="text-sm mt-2 text-zinc-400">Try a different search term or ISBN</p>
                    </div>
                `;
                onResultsRendered && onResultsRendered([]);
                return;
            }

            onResultsRendered && onResultsRendered(data.results);
        } catch (err) {
            loader.classList.add('hidden');
            searchResults.innerHTML = `
                <div class="text-center py-16 text-red-600">
                    <p>Search failed. Please try again.</p>
                </div>
            `;
            onResultsRendered && onResultsRendered([]);
        }
    }

    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        if (query.length >= 2) {
            searchTimeout = setTimeout(() => performSearch(query), 300);
        } else if (query.length === 0) {
            clearResults();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && document.activeElement === searchInput) {
            clearTimeout(searchTimeout);
            const query = searchInput.value.trim();
            if (query.length >= 2) {
                performSearch(query);
            }
            e.preventDefault();
        }
    });
}

export function createSearchHTML() {
    return `
        <!-- Search Section -->
        <section class="mb-10">
            <div class="relative group">
                <div class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-oreilly-blue">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                    </svg>
                </div>
                <input
                    type="text"
                    id="search-input"
                    placeholder="Search by title, author, or ISBN..."
                    class="w-full pl-12 pr-12 py-4 text-base bg-surface-50 border border-zinc-200 rounded-xl placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-oreilly-blue focus:ring-4 focus:ring-oreilly-blue/10 transition-all duration-200"
                    autocomplete="off"
                >
                <div id="search-loader" class="hidden absolute right-4 top-1/2 -translate-y-1/2">
                    <svg class="animate-spin h-5 w-5 text-oreilly-blue" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                </div>
            </div>
        </section>

        <!-- Search Results -->
        <section id="search-results" class="space-y-3">
            <!-- Results populated by JavaScript -->
        </section>
    `;
}
