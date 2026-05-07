// libraryService.js
// Abstraction over library API; now uses real backend by default.

const API = '';

const realLibraryApi = {
  async getAll() {
    const res = await fetch(`${API}/api/library`);
    return res.json();
  },
  async getOne({ id }) {
    const res = await fetch(`${API}/api/library/${id}`);
    return res.json();
  },
  async refresh() {
    // simple re-scan
    const res = await fetch(`${API}/api/library`);
    return res.json();
  }
};

let impl = realLibraryApi;

export function useImplementation(newImpl) {
  impl = newImpl;
}

export async function getAll() {
  return impl.getAll();
}

export async function getOne(id) {
  return impl.getOne({ id });
}

export async function refresh() {
  return impl.refresh();
}
