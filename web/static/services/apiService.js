// apiService.js
// Encapsulates all API calls to backend

const API = '';

export async function checkAuth() {
    const res = await fetch(`${API}/api/status`);
    return res.json();
}

export async function saveCookies(cookies) {
    const res = await fetch(`${API}/api/cookies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cookies)
    });
    return res.json();
}

export async function loadDefaultOutputDir() {
    const res = await fetch(`${API}/api/settings`);
    return res.json();
}

export async function search(query) {
    const res = await fetch(`${API}/api/search?q=${encodeURIComponent(query)}`);
    return res.json();
}

export async function loadChapters(bookId) {
    const res = await fetch(`${API}/api/book/${bookId}/chapters`);
    return res.json();
}

export async function fetchBookDetails(bookId) {
    const res = await fetch(`${API}/api/book/${bookId}`);
    return res.json();
}

export async function sendDownloadRequest(requestBody) {
    const res = await fetch(`${API}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });
    return res.json();
}

export async function cancelDownloadRequest() {
    const res = await fetch(`${API}/api/cancel`, { method: 'POST' });
    return res.json();
}

export async function pollProgress() {
    const res = await fetch(`${API}/api/progress`);
    return res.json();
}

export async function revealFile(path) {
    const res = await fetch(`${API}/api/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
    });
    return res.json();
}

export async function browseOutputDir() {
    const res = await fetch(`${API}/api/settings/output-dir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ browse: true })
    });
    return res.json();
}
