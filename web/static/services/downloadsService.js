// downloadsService.js
// Abstraction over downloads API; now uses real backend by default.

const API = '';

// Cache formats info for validation/canonicalization
let formatsInfo = null;
async function loadFormatsInfo() {
  if (formatsInfo) return formatsInfo;
  const res = await fetch(`${API}/api/formats`);
  formatsInfo = await res.json();
  return formatsInfo;
}

function unique(arr) { return Array.from(new Set(arr)); }

async function validateFormatsList(input) {
  const info = await loadFormatsInfo();
  const supported = new Set(info.formats || []);
  const aliases = info.aliases || {};

  // Default
  if (!input || (Array.isArray(input) && input.length === 0)) {
    return ['epub'];
  }

  // Accept string 'all'
  if (typeof input === 'string') {
    const s = input.trim().toLowerCase();
    if (s === 'all') {
      return ['epub', 'markdown', 'pdf', 'plaintext', 'json', 'chunks'];
    }
    input = s.split(',').map(x => x.trim()).filter(Boolean);
  }

  // Normalize array
  const out = [];
  const seen = new Set();
  for (let f of input) {
    if (!f) continue;
    const lower = String(f).trim().toLowerCase();
    const canonical = aliases[lower] || lower;
    if (canonical === 'jsonl' && !seen.has('json')) {
      out.push('json');
      seen.add('json');
    }
    if (!supported.has(canonical)) continue;
    if (seen.has(canonical)) continue;
    out.push(canonical);
    seen.add(canonical);
    if (canonical === 'jsonl') {
      // keep jsonl after ensuring json is included once
      // jsonl itself is supported and included above
    }
  }
  return out.length ? out : ['epub'];
}

const realDownloadsApi = {
  async getQueue() {
    const res = await fetch(`${API}/api/downloads/queue`);
    return res.json();
  },
  async getHistory() {
    const res = await fetch(`${API}/api/downloads/history`);
    return res.json();
  },
  async getActive() {
    const res = await fetch(`${API}/api/downloads/active`);
    return res.json();
  },
  async enqueue(payload) {
    const formats = await validateFormatsList(payload.formats);
    const body = {
      bookId: payload.bookId,
      title: payload.title || payload.bookId,
      authors: payload.authors || [],
      cover_url: payload.cover_url || '',
      formats,
      outputDir: payload.outputDir || '',
    };
    if (payload.chapters && Array.isArray(payload.chapters) && payload.chapters.length) {
      body.chapters = payload.chapters;
    }
    if (payload.skip_images) {
      body.skip_images = true;
    }
    if (payload.chunking && (payload.chunking.chunk_size || payload.chunking.overlap)) {
      body.chunking = payload.chunking;
    }
    const res = await fetch(`${API}/api/downloads/enqueue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  },
  async cancel({ id }) {
    const res = await fetch(`${API}/api/downloads/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return res.json();
  },
  async retry({ id }) {
    const res = await fetch(`${API}/api/downloads/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return res.json();
  },
  async remove({ id }) {
    const res = await fetch(`${API}/api/downloads/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return res.json();
  },
};

let impl = realDownloadsApi; // default to real backend

export function useImplementation(newImpl) {
  impl = newImpl;
}

export async function getQueue() {
  return impl.getQueue();
}

export async function getHistory() {
  return impl.getHistory ? impl.getHistory() : { items: [] };
}

export async function getActive() {
  return impl.getActive();
}

export async function enqueue(item) {
  return impl.enqueue(item);
}

export async function cancel(id) {
  return impl.cancel({ id });
}

export async function retry(id) {
  return impl.retry({ id });
}

export async function remove(id) {
  return impl.remove({ id });
}
