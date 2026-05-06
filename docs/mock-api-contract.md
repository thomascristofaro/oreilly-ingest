# Frontend Mock API Contract

This document describes the mock API used by the frontend for the Downloads queue and Library pages. The real backend should implement compatible endpoints and payloads so the frontend can swap to the real API with minimal changes.

## Downloads

- GET /api/downloads/queue
  - Response: { items: DownloadItem[], activeId: string|null }

- GET /api/downloads/history
  - Response: { items: DownloadItem[] }

- GET /api/downloads/active
  - Response: { active: DownloadItem|null }

- POST /api/downloads/enqueue
  - Body: {
      bookId: string,
      title: string,
      authors?: string[],
      cover_url?: string,
      formats: string[],
      outputDir?: string
    }
  - Response: { success: boolean, item?: DownloadItem, error?: string }

- POST /api/downloads/cancel
  - Body: { id: string }
  - Response: { success: boolean, error?: string }

- POST /api/downloads/retry
  - Body: { id: string }
  - Response: { success: boolean, item?: DownloadItem, error?: string }

- POST /api/downloads/remove
  - Body: { id: string }
  - Response: { success: boolean, error?: string }

DownloadItem shape:
{
  id: string,
  bookId: string,
  title: string,
  authors: string[],
  cover_url: string,
  formats: string[],
  outputDir: string,
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled',
  progress: number, // 0..100
  createdAt: string, // ISO datetime
  updatedAt: string, // ISO datetime
  error?: string | null
}

Constraints:
- Only one item is running at a time.
- Queue order is FIFO; backend sets the active item.

## Library

- GET /api/library
  - Response: { items: LibraryItem[] }

- GET /api/library/:id
  - Response: { item: LibraryItem } or { error: string }

- POST /api/library/refresh
  - Body: {}
  - Response: { success: boolean, items: LibraryItem[] }

LibraryItem shape:
{
  id: string | number,
  bookId: string,
  title: string,
  authors: string[],
  cover_url: string,
  outputPath: string,
  formats: string[],
  updatedAt: string // ISO datetime
}

## Frontend Swapping Strategy

- The frontend uses service wrappers:
  - `web/static/services/downloadsService.js`
  - `web/static/services/libraryService.js`
- Replace their internal `impl` with real API functions to migrate from the mock to the backend.
