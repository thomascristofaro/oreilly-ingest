// libraryService.js
// Abstraction over library API; uses mock by default.

import { mockLibraryApi } from './mock/mockApi.js';

let impl = mockLibraryApi;

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
