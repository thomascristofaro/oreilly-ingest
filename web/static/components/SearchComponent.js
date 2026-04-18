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
