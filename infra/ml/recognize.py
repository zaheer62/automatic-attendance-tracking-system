"""
infra/ml/recognize.py
---------------------
Loads face embeddings from disk and matches a new face image against them.
Returns (student_id, confidence_score) or (None, score) if below threshold.

Used by:
  • infra/kiosk/main.py  — real-time edge recognition
  • backend/app/face_service.py — can import this for consistency

Usage (standalone test):
  python recognize.py --image /path/to/test.jpg
"""

import os
import pickle
import logging
import argparse
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).parent / "models"
EMBEDDINGS_FILE = MODELS_DIR / "face_embeddings.pkl"

# Minimum cosine similarity to accept a match (0.0 – 1.0)
# 0.80 is a reasonable starting point for Haar + pixel flattening.
# Raise to 0.85 to reduce false positives; lower to 0.75 to reduce false negatives.
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.80"))

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

# Module-level cache — embeddings are loaded once per process
_embeddings_cache: Optional[dict[int, np.ndarray]] = None


def load_embeddings(force_reload: bool = False) -> dict[int, np.ndarray]:
    """
    Load embeddings from disk into memory.
    Cached after first load — call with force_reload=True after retraining.
    """
    global _embeddings_cache

    if _embeddings_cache is not None and not force_reload:
        return _embeddings_cache

    if not EMBEDDINGS_FILE.exists():
        raise FileNotFoundError(
            f"Embeddings file not found at {EMBEDDINGS_FILE}. "
            "Run train.py first."
        )

    with open(EMBEDDINGS_FILE, "rb") as f:
        data = pickle.load(f)

    if not isinstance(data, dict):
        raise ValueError("Embeddings file format invalid — expected dict.")

    log.info(f"Loaded {len(data)} face embedding(s) from {EMBEDDINGS_FILE}")
    _embeddings_cache = data
    return _embeddings_cache


def extract_embedding(image_bytes: bytes) -> Optional[np.ndarray]:
    """
    Decode image bytes, detect face, return L2-normalised 10 000-dim embedding.
    Returns None if no face detected.
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        log.warning("Could not decode image bytes.")
        return None

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=5)

    if len(faces) == 0:
        log.info("No face detected in image.")
        return None

    # Use the largest detected face if multiple are found
    faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
    x, y, w, h = faces[0]

    face_roi = cv2.resize(gray[y : y + h, x : x + w], (100, 100))
    face_roi = cv2.equalizeHist(face_roi)  # lighting normalisation

    embedding = face_roi.flatten().astype(np.float32)

    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm

    return embedding


def recognize_from_bytes(
    image_bytes: bytes,
    threshold: float = CONFIDENCE_THRESHOLD,
) -> tuple[Optional[int], float]:
    """
    Main recognition function.

    Args:
        image_bytes: Raw bytes of a JPEG/PNG image.
        threshold:   Minimum confidence to accept a match.

    Returns:
        (student_id, confidence) if match found above threshold.
        (None, confidence)       if best match is below threshold.
        (None, 0.0)              if no face detected or no embeddings loaded.
    """
    query = extract_embedding(image_bytes)
    if query is None:
        return None, 0.0

    try:
        embeddings = load_embeddings()
    except FileNotFoundError as e:
        log.error(str(e))
        return None, 0.0

    if not embeddings:
        log.warning("Embeddings dict is empty — run train.py to populate.")
        return None, 0.0

    best_id: Optional[int] = None
    best_score: float = -1.0

    for student_id, stored in embeddings.items():
        # Both vectors are L2-normalised, so dot product == cosine similarity
        score = float(np.dot(query, stored))
        if score > best_score:
            best_score = score
            best_id = student_id

    confidence = round(best_score, 4)
    log.info(f"Best match: student_id={best_id}, confidence={confidence:.4f}")

    if confidence >= threshold:
        return best_id, confidence

    log.info(f"Match below threshold ({threshold}). Returning no match.")
    return None, confidence


def recognize_from_frame(
    frame: np.ndarray,
    threshold: float = CONFIDENCE_THRESHOLD,
) -> tuple[Optional[int], float]:
    """
    Convenience wrapper that accepts an OpenCV BGR frame directly.
    Used by infra/kiosk/main.py for live camera feed.
    """
    success, buf = cv2.imencode(".jpg", frame)
    if not success:
        return None, 0.0
    return recognize_from_bytes(buf.tobytes(), threshold)


def reload_embeddings() -> int:
    """
    Force-reload embeddings from disk (call after retraining).
    Returns number of embeddings loaded.
    """
    embeddings = load_embeddings(force_reload=True)
    return len(embeddings)


# ── CLI test ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Recognise a face in an image file.")
    parser.add_argument("--image", required=True, help="Path to test image.")
    parser.add_argument(
        "--threshold",
        type=float,
        default=CONFIDENCE_THRESHOLD,
        help=f"Confidence threshold (default: {CONFIDENCE_THRESHOLD}).",
    )
    args = parser.parse_args()

    with open(args.image, "rb") as f:
        image_bytes = f.read()

    student_id, confidence = recognize_from_bytes(image_bytes, args.threshold)

    if student_id is not None:
        print(f"\n✅  MATCH — student_id={student_id}, confidence={confidence:.4f}")
    else:
        print(f"\n❌  NO MATCH — best confidence={confidence:.4f} (threshold={args.threshold})")
