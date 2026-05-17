"""
infra/kiosk/main.py
--------------------
Edge kiosk app — runs on the classroom screen/tablet.
Captures frames from the webcam, recognises faces locally using
infra/ml/recognize.py, then hands off to sync.py to push
attendance records to the central FastAPI server.

Run:
  cd infra/kiosk
  python main.py

Press Q to quit the kiosk window.
"""

import os
import sys
import time
import logging
import threading
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# ── Make sure infra/ml is importable ─────────────────────────────────────────
ML_DIR = Path(__file__).parent.parent / "ml"
sys.path.insert(0, str(ML_DIR))

import cv2
import numpy as np
from recognize import recognize_from_frame, reload_embeddings
from sync import push_attendance

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
CLASSROOM_ID   = os.getenv("CLASSROOM_ID", "classroom-1")
CAMERA_INDEX   = int(os.getenv("CAMERA_INDEX", "0"))
COOLDOWN_SEC   = int(os.getenv("COOLDOWN_SEC", "10"))      # seconds between re-marking same student
RELOAD_EVERY   = int(os.getenv("RELOAD_EVERY", "300"))     # reload embeddings every 5 minutes
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.80"))

# Haar cascade for face detection overlay
face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

# ── State ─────────────────────────────────────────────────────────────────────
# {student_id: last_marked_timestamp}
recently_marked: dict[int, float] = {}


def is_on_cooldown(student_id: int) -> bool:
    last = recently_marked.get(student_id, 0)
    return (time.time() - last) < COOLDOWN_SEC


def mark_student(student_id: int, confidence: float) -> None:
    """Record attendance locally and push to server in background thread."""
    recently_marked[student_id] = time.time()
    log.info(f"✅ Marked student_id={student_id} confidence={confidence:.4f}")

    record = {
        "student_id":   student_id,
        "classroom_id": CLASSROOM_ID,
        "confidence":   confidence,
        "method":       "face_recognition",
        "timestamp":    datetime.utcnow().isoformat(),
    }

    # Push to server without blocking the camera loop
    thread = threading.Thread(target=push_attendance, args=(record,), daemon=True)
    thread.start()


def draw_overlay(
    frame: np.ndarray,
    faces,
    student_id: int | None,
    confidence: float,
    status: str,
) -> np.ndarray:
    """Draw face boxes and status text onto the frame."""
    for (x, y, w, h) in faces:
        color = (0, 255, 0) if student_id else (0, 0, 255)
        cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)

    # Status banner at top
    banner_color = (0, 180, 0) if student_id else (30, 30, 30)
    cv2.rectangle(frame, (0, 0), (frame.shape[1], 60), banner_color, -1)

    text = status
    cv2.putText(frame, text, (10, 38),
                cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)

    # Confidence score bottom-left
    if confidence > 0:
        conf_text = f"Confidence: {confidence:.2%}"
        cv2.putText(frame, conf_text, (10, frame.shape[0] - 15),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)

    # Classroom + time bottom-right
    ts = datetime.now().strftime("%H:%M:%S")
    info = f"{CLASSROOM_ID}  {ts}"
    (tw, _), _ = cv2.getTextSize(info, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
    cv2.putText(frame, info,
                (frame.shape[1] - tw - 10, frame.shape[0] - 15),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1)

    return frame


def reload_loop() -> None:
    """Background thread: reload face embeddings every RELOAD_EVERY seconds."""
    while True:
        time.sleep(RELOAD_EVERY)
        count = reload_embeddings()
        log.info(f"🔄 Reloaded {count} face embedding(s) from disk.")


def run() -> None:
    log.info(f"Starting kiosk — classroom={CLASSROOM_ID}, camera={CAMERA_INDEX}")

    cap = cv2.VideoCapture(CAMERA_INDEX)
    if not cap.isOpened():
        log.error(f"Cannot open camera index {CAMERA_INDEX}. Check CAMERA_INDEX in .env")
        sys.exit(1)

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    # Start background embedding reload thread
    reload_thread = threading.Thread(target=reload_loop, daemon=True)
    reload_thread.start()

    log.info("Camera open. Press Q in the window to quit.")

    # Process every Nth frame to save CPU
    frame_skip = 3
    frame_count = 0

    last_student_id = None
    last_confidence = 0.0
    last_status = "Waiting for face …"

    while True:
        ret, frame = cap.read()
        if not ret:
            log.warning("Failed to read frame — retrying …")
            time.sleep(0.1)
            continue

        frame_count += 1
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)

        if frame_count % frame_skip == 0 and len(faces) > 0:
            student_id, confidence = recognize_from_frame(frame, CONFIDENCE_THRESHOLD)

            if student_id is not None:
                if not is_on_cooldown(student_id):
                    mark_student(student_id, confidence)
                    last_status = f"Welcome! Student #{student_id}"
                else:
                    last_status = f"Already marked — Student #{student_id}"
                last_student_id = student_id
                last_confidence = confidence
            else:
                last_student_id = None
                last_confidence = confidence
                last_status = "Face not recognised"

        elif len(faces) == 0:
            last_student_id = None
            last_confidence = 0.0
            last_status = "Waiting for face …"

        display = draw_overlay(
            frame.copy(), faces,
            last_student_id, last_confidence, last_status
        )

        cv2.imshow(f"Attendance Kiosk — {CLASSROOM_ID}", display)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            log.info("Q pressed — shutting down kiosk.")
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    run()
