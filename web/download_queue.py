"""SQLite-backed download queue manager with background worker.

Provides a persistent queue and history for downloads and runs jobs sequentially
using the existing DownloaderPlugin from the kernel.
"""
from __future__ import annotations

import json
import sqlite3
import threading
import time
import random
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Callable, Optional

from plugins.downloader import DownloadProgress
from plugins.chunking import ChunkConfig


@dataclass
class QueueItem:
    id: int
    book_id: str
    title: str
    authors: list[str]
    cover_url: str
    formats: list[str]
    output_dir: str
    status: str
    progress: int
    message: str | None
    current_chapter: int | None
    total_chapters: int | None
    chapter_title: str | None
    created_at: str
    updated_at: str
    error: str | None
    result_files: dict[str, str] | None
    # Advanced options
    selected_chapters: list[int] | None
    skip_images: bool
    chunking: dict | None

    def to_json(self) -> dict[str, Any]:
        d = asdict(self)
        return d


class DownloadQueue:
    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)
        self._conn_lock = threading.Lock()
        self._cancel_flags: set[int] = set()
        self._worker_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._init_db()
        self._last_run_time: float | None = None

    def _get_conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._get_conn() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS downloads (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    book_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    authors TEXT,
                    cover_url TEXT,
                    formats TEXT NOT NULL,
                    output_dir TEXT,
                    status TEXT NOT NULL,
                    progress INTEGER NOT NULL DEFAULT 0,
                    message TEXT,
                    current_chapter INTEGER,
                    total_chapters INTEGER,
                    chapter_title TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    error TEXT,
                    result_files TEXT
                )
                """
            )
            # Add new columns if missing (simple, idempotent migration)
            for ddl in [
                "ALTER TABLE downloads ADD COLUMN selected_chapters TEXT",
                "ALTER TABLE downloads ADD COLUMN skip_images INTEGER NOT NULL DEFAULT 0",
                "ALTER TABLE downloads ADD COLUMN chunking TEXT",
            ]:
                try:
                    conn.execute(ddl)
                except Exception:
                    pass
            conn.execute("CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_downloads_updated ON downloads(updated_at)")

    # Public API
    def enqueue(self, payload: dict) -> QueueItem:
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        authors = payload.get("authors") or []
        formats = payload.get("formats") or ["epub"]
        selected = payload.get("selected_chapters") or payload.get("chapters")
        skip_images = 1 if payload.get("skip_images") else 0
        chunking = payload.get("chunking")
        with self._get_conn() as conn:
            cur = conn.execute(
                """
                INSERT INTO downloads (
                    book_id, title, authors, cover_url, formats, output_dir,
                    status, progress, created_at, updated_at,
                    selected_chapters, skip_images, chunking
                ) VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?, ?, ?)
                """,
                (
                    payload["bookId"],
                    payload.get("title", payload["bookId"]),
                    json.dumps(authors),
                    payload.get("cover_url", ""),
                    json.dumps(formats),
                    payload.get("outputDir", ""),
                    now,
                    now,
                    json.dumps(selected) if selected is not None else None,
                    skip_images,
                    json.dumps(chunking) if chunking is not None else None,
                ),
            )
            job_id = cur.lastrowid
            row = conn.execute("SELECT * FROM downloads WHERE id=?", (job_id,)).fetchone()
        return self._row_to_item(row)

    def get_queue(self) -> tuple[list[QueueItem], Optional[int]]:
        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM downloads WHERE status IN ('queued','running') ORDER BY id ASC"
            ).fetchall()
            active = conn.execute(
                "SELECT id FROM downloads WHERE status='running' ORDER BY updated_at DESC LIMIT 1"
            ).fetchone()
        return [self._row_to_item(r) for r in rows], (active["id"] if active else None)

    def get_history(self) -> list[QueueItem]:
        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM downloads WHERE status IN ('completed','failed','cancelled') ORDER BY updated_at DESC"
            ).fetchall()
        return [self._row_to_item(r) for r in rows]

    def get_active(self) -> Optional[QueueItem]:
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM downloads WHERE status='running' ORDER BY updated_at DESC LIMIT 1"
            ).fetchone()
        return self._row_to_item(row) if row else None

    def cancel(self, job_id: int) -> bool:
        """Request cancellation.
        - If job is queued, mark it immediately as cancelled.
        - If running, set a cancel flag; the worker will mark as cancelled.
        """
        job_id = int(job_id)
        # Try to cancel queued immediately
        with self._get_conn() as conn:
            row = conn.execute("SELECT status FROM downloads WHERE id=?", (job_id,)).fetchone()
            if not row:
                return False
            status = row["status"]
            if status == "queued":
                now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                conn.execute(
                    "UPDATE downloads SET status='cancelled', updated_at=?, error=? WHERE id=?",
                    (now, "Cancelled", job_id),
                )
                # Ensure any pending flag is cleared
                with self._conn_lock:
                    self._cancel_flags.discard(job_id)
                return True
        # Otherwise, mark flag for running/in-flight start
        with self._conn_lock:
            self._cancel_flags.add(job_id)
        return True

    def retry(self, job_id: int) -> Optional[QueueItem]:
        with self._get_conn() as conn:
            row = conn.execute("SELECT * FROM downloads WHERE id=?", (job_id,)).fetchone()
            if not row or row["status"] not in ("failed", "cancelled"):
                return None
            now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            cur = conn.execute(
                """
                INSERT INTO downloads (
                    book_id, title, authors, cover_url, formats, output_dir,
                    status, progress, created_at, updated_at,
                    selected_chapters, skip_images, chunking
                )
                VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?, ?, ?)
                """,
                (
                    row["book_id"],
                    row["title"],
                    row["authors"],
                    row["cover_url"],
                    row["formats"],
                    row["output_dir"],
                    now,
                    now,
                    row["selected_chapters"],
                    row["skip_images"],
                    row["chunking"],
                ),
            )
            new_id = cur.lastrowid
            row2 = conn.execute("SELECT * FROM downloads WHERE id=?", (new_id,)).fetchone()
        return self._row_to_item(row2)

    def remove(self, job_id: int) -> bool:
        with self._get_conn() as conn:
            conn.execute("DELETE FROM downloads WHERE id=? AND status IN ('completed','failed','cancelled')", (job_id,))
        return True

    # Worker management
    def start_worker(self, kernel):
        if self._worker_thread and self._worker_thread.is_alive():
            return
        self._stop_event.clear()
        self._worker_thread = threading.Thread(target=self._worker_loop, args=(kernel,), daemon=True)
        self._worker_thread.start()

    def stop_worker(self):
        self._stop_event.set()
        if self._worker_thread:
            self._worker_thread.join(timeout=2)

    # Internal
    def _worker_loop(self, kernel):
        downloader = kernel["downloader"]
        while not self._stop_event.is_set():
            # Respect minimum 60s between starts
            if self._last_run_time is not None:
                elapsed = time.time() - self._last_run_time
                if elapsed < 60:
                    time.sleep(60 - elapsed)
                    # continue to next loop iteration to re-check state
            active_item = self.get_active()
            if active_item:
                time.sleep(0.5)
                continue
            # Get next queued
            job = self._get_next_queued()
            if job is None:
                time.sleep(0.5)
                continue
            # Random wait 1-5 minutes before starting
            wait_seconds = random.randint(60, 300)
            cancelled_before_start = False
            for _ in range(wait_seconds):
                if self._stop_event.is_set():
                    return
                # If cancelled while waiting, mark and skip this job
                with self._conn_lock:
                    if job.id in self._cancel_flags:
                        self._mark_cancelled(job.id, "Cancelled")
                        self._cancel_flags.discard(job.id)
                        cancelled_before_start = True
                        break
                # Also respect DB-side immediate cancel
                with self._get_conn() as conn:
                    r = conn.execute("SELECT status FROM downloads WHERE id=?", (job.id,)).fetchone()
                    if r and r["status"] == "cancelled":
                        cancelled_before_start = True
                        break
                time.sleep(1)
            if cancelled_before_start:
                continue
            # Mark running
            self._set_status(job.id, "running")
            # Run job
            job_id = job.id
            def on_progress(p: DownloadProgress):
                self._update_progress(job_id, p)
            def is_cancel():
                with self._conn_lock:
                    return job_id in self._cancel_flags
            try:
                # Prepare formats and advanced options
                formats = job.formats if isinstance(job.formats, list) else json.loads(job.formats or "[]")
                selected = job.selected_chapters
                skip_imgs = bool(job.skip_images)
                chunk_cfg = None
                if job.chunking:
                    try:
                        cfg = job.chunking if isinstance(job.chunking, dict) else json.loads(job.chunking)
                        size = int(cfg.get("chunk_size") or cfg.get("size") or 0) or None
                        overlap = int(cfg.get("overlap") or 0) or 0
                        if size:
                            chunk_cfg = ChunkConfig(chunk_size=size, overlap=overlap)
                    except Exception:
                        chunk_cfg = None
                out_dir = Path(job.output_dir) if job.output_dir else kernel["output"].get_default_dir()
                print(f"[Queue] Starting download job id={job_id} title={job.title!r} book_id={job.book_id} formats={formats} output_dir={out_dir}")
                result = downloader.download(
                    book_id=job.book_id,
                    output_dir=out_dir,
                    formats=formats,
                    selected_chapters=selected,
                    skip_images=skip_imgs,
                    chunk_config=chunk_cfg,
                    progress_callback=on_progress,
                    cancel_check=is_cancel,
                )
                # Completed
                files = {k: str(v) for k, v in (result.files or {}).items()}
                self._mark_completed(job_id, files)
                self._last_run_time = time.time()
            except Exception as e:
                # Cancel or failed
                if is_cancel():
                    self._mark_cancelled(job_id, str(e))
                    with self._conn_lock:
                        self._cancel_flags.discard(job_id)
                else:
                    self._mark_failed(job_id, str(e))
                self._last_run_time = time.time()

    def _safe(self, row_value: Any, default_json: str) -> str:
        try:
            return row_value if row_value else default_json
        except Exception:
            return default_json

    def _get_next_queued(self) -> Optional[QueueItem]:
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM downloads WHERE status='queued' ORDER BY id ASC LIMIT 1"
            ).fetchone()
        return self._row_to_item(row) if row else None

    def _set_status(self, job_id: int, status: str):
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        with self._get_conn() as conn:
            conn.execute(
                "UPDATE downloads SET status=?, updated_at=? WHERE id=?",
                (status, now, job_id),
            )

    def _update_progress(self, job_id: int, p: DownloadProgress):
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        # Keep DB status as 'running' during progress; store detailed stage in message
        message_text = p.message or p.status or ""
        with self._get_conn() as conn:
            conn.execute(
                """
                UPDATE downloads
                SET status=?, progress=?, message=?, current_chapter=?, total_chapters=?, chapter_title=?, updated_at=?
                WHERE id=?
                """,
                (
                    "running",
                    int(p.percentage or 0),
                    message_text,
                    int(p.current_chapter or 0),
                    int(p.total_chapters or 0),
                    p.chapter_title or "",
                    now,
                    job_id,
                ),
            )

    def _mark_completed(self, job_id: int, files: dict[str, str]):
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        with self._get_conn() as conn:
            conn.execute(
                "UPDATE downloads SET status='completed', progress=100, updated_at=?, result_files=? WHERE id=?",
                (now, json.dumps(files), job_id),
            )

    def _mark_failed(self, job_id: int, error: str):
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        with self._get_conn() as conn:
            conn.execute(
                "UPDATE downloads SET status='failed', updated_at=?, error=? WHERE id=?",
                (now, error, job_id),
            )

    def _mark_cancelled(self, job_id: int, error: str | None):
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        with self._get_conn() as conn:
            conn.execute(
                "UPDATE downloads SET status='cancelled', updated_at=?, error=? WHERE id=?",
                (now, error or "Cancelled", job_id),
            )

    # Row conversion
    def _row_to_item(self, row: sqlite3.Row) -> QueueItem:
        # Parse advanced options
        selected = None
        if row.keys() and "selected_chapters" in row.keys():
            try:
                selected = json.loads(row["selected_chapters"]) if row["selected_chapters"] else None
            except Exception:
                selected = None
        chunking = None
        if row.keys() and "chunking" in row.keys():
            try:
                chunking = json.loads(row["chunking"]) if row["chunking"] else None
            except Exception:
                chunking = None
        skip = False
        try:
            skip = bool(row["skip_images"]) if "skip_images" in row.keys() else False
        except Exception:
            skip = False
        return QueueItem(
            id=row["id"],
            book_id=row["book_id"],
            title=row["title"],
            authors=json.loads(row["authors"]) if row["authors"] else [],
            cover_url=row["cover_url"] or "",
            formats=json.loads(row["formats"]) if row["formats"] else [],
            output_dir=row["output_dir"] or "",
            status=row["status"],
            progress=int(row["progress" or 0]),
            message=row["message"],
            current_chapter=row["current_chapter"],
            total_chapters=row["total_chapters"],
            chapter_title=row["chapter_title"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            error=row["error"],
            result_files=json.loads(row["result_files"]) if row["result_files"] else None,
            selected_chapters=selected,
            skip_images=skip,
            chunking=chunking,
        )
