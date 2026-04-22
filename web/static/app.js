/**
 * O'Reilly Ingest - Frontend Application
 * Redesigned with Tailwind CSS
 */

import * as apiService from './services/apiService.js';
import { initCookieModal } from './components/CookieModalComponent.js';
import { initSearch } from './components/SearchComponent.js';
import { createBookCardHTML, setupBookCardEvents, collapseBook } from './components/BookCardComponent.js';
import { initSidebar } from './components/SidebarComponent.js';
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
    initSidebar();

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

    // Sidebar toggle (hamburger)
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const body = document.body;
    if (toggleBtn && sidebar) {
        const applyCollapsed = (collapsed) => {
            if (collapsed) {
                sidebar.classList.add('w-0');
                sidebar.classList.remove('w-56');
                toggleBtn.setAttribute('aria-expanded', 'false');
            } else {
                sidebar.classList.remove('w-0');
                sidebar.classList.add('w-56');
                toggleBtn.setAttribute('aria-expanded', 'true');
            }
        };
        let collapsed = false;
        applyCollapsed(collapsed);
        toggleBtn.addEventListener('click', () => {
            collapsed = !collapsed;
            applyCollapsed(collapsed);
        });
    }
});

stateService.subscribe((newState) => {
    currentExpandedCard = newState.currentExpandedCard;
    selectedResultIndex = newState.selectedResultIndex;
    defaultOutputDir = newState.defaultOutputDir;
    chaptersCache = newState.chaptersCache;
});
