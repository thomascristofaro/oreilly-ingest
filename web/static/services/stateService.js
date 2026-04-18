// stateService.js
// Centralized state management for frontend mutable state

const state = {
    currentExpandedCard: null,
    selectedResultIndex: -1,
    defaultOutputDir: '',
    chaptersCache: {},
};

const listeners = new Set();

export function getState() {
    return { ...state };
}

export function setState(newState) {
    Object.assign(state, newState);
    notifyListeners();
}

export function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function notifyListeners() {
    listeners.forEach(listener => listener(state));
}
