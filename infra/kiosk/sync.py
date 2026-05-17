"""
infra/kiosk/sync.py
--------------------
Pushes attendance records captured by the kiosk to the central
FastAPI server. Called in a background thread from main.py so it
never blocks the camera loop.

If the server is unreachable, records are queued locally in a
JSON file (offline_queue.json) and retried automatically.
"""

import os
import json
import time
import logging
import threading
from pathlib import Path
from datetime import datetime

import requests
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
SERVER_URL   = os.getenv("SERVER_URL", "http://localhost:8000")
AUTH_TOKEN   = os.getenv("AUTH_TOKEN", "")
CLASSROOM_ID = os.getenv("CLASSROOM_ID", "classroom-1")
RETRY_EVERY  = int(os.getenv("RETRY_EVERY", "30"))   # seconds between offline queue retries

QUEUE_FILE   = Path(__file__).parent / "offline_queue.json"

_queue_lock  = threading.Lock()

# ── Helpers ───────────────────────────────────────────────────────────────────

def _headers() -> dict:
    return {
        "Content-Type":  "application/json",
        "Authorization": f"Bearer {AUTH_TOKEN}",
    }


def _load_queue() -> list[dict]:
    if not QUEUE_FILE.exists():
        return []
    try:
        with open(QUEUE_FILE, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []


def _save_queue(queue: list[dict]) -> None:
    with open(QUEUE_FILE, "w") as f:
        json.dump(queue, f, indent=2)


def _enqueue(record: dict) -> None:
    """Add a record to the offline queue."""
    with _queue_lock:
        queue = _load_queue()
        record["queued_at"] = datetime.utcnow().isoformat()
        queue.append(record)
        _save_queue(queue)
    log.info(f"📦 Queued offline record for student_id={record.get('student_id')}")


def _dequeue_all() -> list[dict]:
    """Return and clear the offline queue."""
    with _queue_lock:
        queue = _load_queue()
        _save_queue([])
    return queue


# ── Core push ─────────────────────────────────────────────────────────────────

def _post_record(record: dict) -> bool:
    """
    POST a single attendance record to the FastAPI /attendance/mark endpoint.
    Returns True on success, False on failure.
    """
    url = f"{SERVER_URL}/attendance/mark"
    payload = {
        "session_id":       record.get("session_id"),
        "student_id":       record["student_id"],
        "method":           record.get("method", "face_recognition"),
        "confidence_score": record.get("confidence", 0.0),
    }

    # If session_id is not known, use the sync endpoint instead
    if payload["session_id"] is None:
        url = f"{SERVER_URL}/sync/attendance"
        payload = record  # send full record; backend will resolve session

    try:
        response = requests.post(url, json=payload, headers=_headers(), timeout=5)
        if response.status_code in (200, 201):
            log.info(f"☁️  Synced student_id={record['student_id']} → server")
            return True
        else:
            log.warning(
                f"Server returned {response.status_code} for "
                f"student_id={record['student_id']}: {response.text[:120]}"
            )
            return False
    except requests.exceptions.ConnectionError:
        log.warning(f"⚠️  Server unreachable — student_id={record['student_id']} queued offline")
        return False
    except requests.exceptions.Timeout:
        log.warning(f"⚠️  Request timed out — student_id={record['student_id']} queued offline")
        return False
    except Exception as e:
        log.error(f"Unexpected sync error: {e}")
        return False


def push_attendance(record: dict) -> None:
    """
    Try to push one record immediately.
    If it fails, add it to the offline queue.
    Also drains the offline queue on each successful push.
    """
    success = _post_record(record)

    if not success:
        _enqueue(record)
        return

    # Drain the offline queue now that server is reachable
    pending = _dequeue_all()
    if pending:
        log.info(f"📤 Draining {len(pending)} offline record(s) …")
        failed = []
        for queued_record in pending:
            if not _post_record(queued_record):
                failed.append(queued_record)
        if failed:
            with _queue_lock:
                existing = _load_queue()
                _save_queue(failed + existing)
            log.warning(f"Re-queued {len(failed)} record(s) that failed on retry.")


# ── Background retry loop ─────────────────────────────────────────────────────

def _retry_loop() -> None:
    """
    Background thread: every RETRY_EVERY seconds, try to flush
    the offline queue to the server.
    """
    while True:
        time.sleep(RETRY_EVERY)
        pending = _dequeue_all()
        if not pending:
            continue

        log.info(f"🔁 Retrying {len(pending)} offline record(s) …")
        failed = []
        for record in pending:
            if not _post_record(record):
                failed.append(record)

        if failed:
            with _queue_lock:
                existing = _load_queue()
                _save_queue(failed + existing)
            log.warning(f"  {len(failed)} record(s) still offline — will retry in {RETRY_EVERY}s")
        else:
            log.info(f"  All offline records synced ✅")


def start_retry_loop() -> threading.Thread:
    """Start the background retry thread. Call once at kiosk startup."""
    t = threading.Thread(target=_retry_loop, daemon=True)
    t.start()
    log.info(f"Sync retry loop started (every {RETRY_EVERY}s)")
    return t
