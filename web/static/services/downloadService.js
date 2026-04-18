// downloadService.js
// Manages download workflow: sending requests, canceling, polling progress

import * as apiService from './apiService.js';
import * as stateService from './stateService.js';

let polling = false;
let pollTimeout = null;

export async function startDownload(requestBody, onProgress, onComplete, onError) {
    try {
        const result = await apiService.sendDownloadRequest(requestBody);
        if (result.error) {
            onError && onError(result.error);
            return;
        }
        polling = true;
        pollProgress(onProgress, onComplete, onError);
    } catch (err) {
        onError && onError(err.message || 'Download failed');
    }
}

export async function cancelDownload(onCanceled) {
    try {
        await apiService.cancelDownloadRequest();
        polling = false;
        if (pollTimeout) {
            clearTimeout(pollTimeout);
            pollTimeout = null;
        }
        onCanceled && onCanceled();
    } catch (err) {
        console.error('Cancel request failed:', err);
    }
}

async function pollProgress(onProgress, onComplete, onError) {
    if (!polling) return;
    try {
        const data = await apiService.pollProgress();
        onProgress && onProgress(data);
        if (data.status === 'completed') {
            polling = false;
            onComplete && onComplete(data);
        } else if (data.status === 'error') {
            polling = false;
            onError && onError(data.error);
        } else {
            pollTimeout = setTimeout(() => pollProgress(onProgress, onComplete, onError), 500);
        }
    } catch (err) {
        console.error('Progress polling failed:', err);
        pollTimeout = setTimeout(() => pollProgress(onProgress, onComplete, onError), 1000);
    }
}
