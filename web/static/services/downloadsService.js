// downloadsService.js
// Abstraction over downloads API; uses mock by default for now.

import { mockDownloadsApi } from './mock/mockApi.js';

let impl = mockDownloadsApi; // swap later when backend is ready

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
