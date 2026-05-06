// mockApi.js
// Provides a frontend-only mock for Downloads queue and Library endpoints.
// Can be swapped with real backend by replacing usage in services.

// Simulated in-memory state
const mockState = {
  queue: [], // items: { id, title, authors, cover_url, status, progress, createdAt, updatedAt, bookId, formats, outputDir, error }
  history: [], // completed/cancelled/failed items
  library: [], // items: { id, title, authors, cover_url, outputPath, formats, bookId, updatedAt }
  activeId: null,
  nextId: 1,
};

// Utils
function nowISO() { return new Date().toISOString(); }
function clone(x) { return JSON.parse(JSON.stringify(x)); }

// Seed some data
function seed() {
  if (mockState.queue.length || mockState.library.length) return;
  const samples = [
    { id: '9781492071266', title: 'Hands-On Machine Learning with Scikit-Learn and PyTorch', authors: ['Aurélien Géron'], cover_url: 'https://learning.oreilly.com/covers/urn:orm:book:9781492071266/200w/' },
    { id: '9781098156371', title: 'AI Engineering', authors: ['Chip Huyen'], cover_url: 'https://learning.oreilly.com/covers/urn:orm:book:9781098156371/200w/' },
    { id: '9781449355739', title: 'The LEGO Builder\'s Handbook', authors: ['Allan Bedford'], cover_url: 'https://learning.oreilly.com/covers/urn:orm:book:9781449355739/200w/' },
  ];
  mockState.library = samples.map((s, i) => ({
    id: i + 1,
    bookId: s.id,
    title: s.title,
    authors: s.authors,
    cover_url: s.cover_url,
    outputPath: `/output/${s.title}/`,
    formats: ['epub', 'markdown'],
    updatedAt: nowISO(),
  }));

  // Seed queue with one running and one queued
  const running = {
    id: String(mockState.nextId++),
    bookId: samples[0].id,
    title: samples[0].title,
    authors: samples[0].authors,
    cover_url: samples[0].cover_url,
    formats: ['markdown'],
    outputDir: '/output',
    status: 'running',
    progress: 35,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    error: null,
  };
  const queued = {
    id: String(mockState.nextId++),
    bookId: samples[1].id,
    title: samples[1].title,
    authors: samples[1].authors,
    cover_url: samples[1].cover_url,
    formats: ['epub'],
    outputDir: '/output',
    status: 'queued',
    progress: 0,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    error: null,
  };
  mockState.queue.push(running, queued);
  mockState.activeId = running.id;

  // Seed history with a completed and a failed
  mockState.history.push({
    id: String(mockState.nextId++),
    bookId: samples[2].id,
    title: samples[2].title,
    authors: samples[2].authors,
    cover_url: samples[2].cover_url,
    formats: ['pdf'],
    outputDir: '/output',
    status: 'completed',
    progress: 100,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    error: null,
  });
  mockState.history.push({
    id: String(mockState.nextId++),
    bookId: '9780123456789',
    title: 'Some Book That Failed',
    authors: ['Unknown'],
    cover_url: samples[0].cover_url,
    formats: ['markdown'],
    outputDir: '/output',
    status: 'failed',
    progress: 42,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    error: 'Network error',
  });
}

seed();

// Mock API interface
export const mockDownloadsApi = {
  // GET /api/downloads/queue
  async getQueue() {
    const items = [...mockState.queue];
    return { items: clone(items), activeId: mockState.activeId };
  },

  // GET /api/downloads/history
  async getHistory() {
    return { items: clone(mockState.history) };
  },

  // GET /api/downloads/active
  async getActive() {
    const active = mockState.queue.find(q => q.id === mockState.activeId) || null;
    return { active: clone(active) };
  },

  // POST /api/downloads/enqueue
  async enqueue(payload) {
    // payload: { bookId, title, authors, cover_url, formats, outputDir }
    const item = {
      id: String(mockState.nextId++),
      bookId: payload.bookId,
      title: payload.title,
      authors: payload.authors || [],
      cover_url: payload.cover_url || '',
      formats: payload.formats || ['markdown'],
      outputDir: payload.outputDir || '',
      status: 'queued', // queued|running|completed|failed|cancelled
      progress: 0,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      error: null,
    };
    mockState.queue.push(item);
    maybeStartNext();
    return { success: true, item: clone(item) };
  },

  // POST /api/downloads/cancel
  async cancel({ id }) {
    if (!id) return { success: false, error: 'Missing id' };
    const q = mockState.queue.find(x => x.id === id);
    if (!q) return { success: false, error: 'Not found' };

    if (q.status === 'running' && mockState.activeId === id) {
      // cancel running
      q.status = 'cancelled';
      q.updatedAt = nowISO();
      mockState.activeId = null;
      moveToHistory(q);
      maybeStartNext();
      return { success: true };
    }

    if (q.status === 'queued') {
      q.status = 'cancelled';
      q.updatedAt = nowISO();
      moveToHistory(q);
      return { success: true };
    }

    return { success: false, error: 'Cannot cancel in current state' };
  },

  // POST /api/downloads/retry
  async retry({ id }) {
    const h = mockState.history.find(x => x.id === id && x.status === 'failed');
    if (!h) return { success: false, error: 'Not found or not failed' };
    const item = { ...h, status: 'queued', progress: 0, error: null, updatedAt: nowISO() };
    mockState.queue.push(item);
    maybeStartNext();
    return { success: true, item: clone(item) };
  },

  // POST /api/downloads/remove
  async remove({ id }) {
    const idx = mockState.history.findIndex(x => x.id === id);
    if (idx === -1) return { success: false, error: 'Not found' };
    mockState.history.splice(idx, 1);
    return { success: true };
  },
};

export const mockLibraryApi = {
  // GET /api/library
  async getAll() {
    return { items: clone(mockState.library) };
  },
  // GET /api/library/:id
  async getOne({ id }) {
    const item = mockState.library.find(x => String(x.id) === String(id));
    if (!item) return { error: 'Not found' };
    return { item: clone(item) };
  },
  // POST /api/library/refresh (noop)
  async refresh() {
    return { success: true, items: clone(mockState.library) };
  }
};

// Internal helpers
function moveToHistory(item) {
  const idx = mockState.queue.findIndex(x => x.id === item.id);
  if (idx !== -1) mockState.queue.splice(idx, 1);
  mockState.history.unshift({ ...item });
}

function maybeStartNext() {
  if (mockState.activeId) return;
  const next = mockState.queue.find(x => x.status === 'queued');
  if (!next) return;
  next.status = 'running';
  mockState.activeId = next.id;
  simulateRun(next.id);
}

function simulateRun(id) {
  const interval = setInterval(() => {
    const it = mockState.queue.find(x => x.id === id);
    if (!it) return clearInterval(interval);
    if (it.status !== 'running') return clearInterval(interval);

    // progress
    it.progress += Math.floor(5 + Math.random() * 12);
    if (it.progress >= 100) {
      it.progress = 100;
      it.status = 'completed';
      it.updatedAt = nowISO();
      mockState.activeId = null;
      // push into library as completed artifact
      mockState.library.unshift({
        id: mockState.library.length ? Math.max(...mockState.library.map(x => x.id)) + 1 : 1,
        bookId: it.bookId,
        title: it.title,
        authors: it.authors,
        cover_url: it.cover_url,
        outputPath: `${it.outputDir || '/output'}/${it.title}/`,
        formats: it.formats,
        updatedAt: nowISO(),
      });
      moveToHistory(it);
      clearInterval(interval);
      // start next queued
      maybeStartNext();
      return;
    }
    it.updatedAt = nowISO();
  }, 600);
}
