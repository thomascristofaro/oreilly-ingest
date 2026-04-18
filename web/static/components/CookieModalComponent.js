// CookieModalComponent.js
// Manages cookie input modal, validation, and saving

import * as apiService from '../services/apiService.js';

export function initCookieModal() {
    const loginBtn = document.getElementById('login-btn');
    const cookieModal = document.getElementById('cookie-modal');
    const cancelModalBtn = document.getElementById('cancel-modal-btn');
    const saveCookiesBtn = document.getElementById('save-cookies-btn');
    const cookieInput = document.getElementById('cookie-input');
    const cookieError = document.getElementById('cookie-error');

    loginBtn.onclick = () => {
        cookieModal.classList.remove('hidden');
        cookieInput.value = '';
        cookieError.classList.add('hidden');
        document.body.style.overflow = 'hidden';
    };

    cancelModalBtn.onclick = () => {
        cookieModal.classList.add('hidden');
        document.body.style.overflow = '';
    };

    cookieModal.onclick = (e) => {
        if (e.target.id === 'cookie-modal') {
            cookieModal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    };

    saveCookiesBtn.onclick = async () => {
        const input = cookieInput.value.trim();
        if (!input) {
            cookieError.textContent = 'Please paste your cookie JSON';
            cookieError.classList.remove('hidden');
            return;
        }

        let cookies;
        try {
            cookies = JSON.parse(input);
            if (typeof cookies !== 'object' || Array.isArray(cookies)) {
                throw new Error('Must be a JSON object');
            }
        } catch (e) {
            cookieError.textContent = 'Invalid JSON format: ' + e.message;
            cookieError.classList.remove('hidden');
            return;
        }

        try {
            const data = await apiService.saveCookies(cookies);
            if (data.error) {
                cookieError.textContent = data.error;
                cookieError.classList.remove('hidden');
                return;
            }
            cookieModal.classList.add('hidden');
            document.body.style.overflow = '';
            // Optionally trigger auth check or other updates
        } catch (err) {
            cookieError.textContent = 'Failed to save cookies';
            cookieError.classList.remove('hidden');
        }
    };
}
