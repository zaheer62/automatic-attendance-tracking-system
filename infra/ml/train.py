"""
infra/ml/train.py
-----------------
Extracts face embeddings for all registered students and saves them
as .pkl files in infra/ml/models/.

Run this:
  cd infra/ml
  python train.py

Re-run any time a new student registers their face in the system.
"""

import os
import sys
import pickle
import logging
import argparse
import numpy as np
import cv2
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
import psycopg2.extras

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(exist_ok=True)

EMBEDDINGS_FILE = MODELS_DIR / "face_embeddings.pkl"

DATABASE_URL = os.getenv("DATABASE_URL")

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)


def get_db_connection():
    """Connect to PostgreSQL and return connection."""
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL not set in environment.")
    conn = psycopg2.connect(DATABASE_URL)
    return conn


def extract_embedding(image_bytes: bytes) -> np.ndarray | None:
    """
    Convert raw image bytes → 10 000-dim float32 face embedding.
    Returns None if no face is detected.
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return None

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=5)
    if len(faces) == 0:
        return None

    x, y, w, h = faces[0]
    face_roi = cv2.resize(gray[y : y + h, x : x + w], (100, 100))

    # Histogram equalisation — improves robustness under different lighting
    face_roi = cv2.equalizeHist(face_roi)

    embedding = face_roi.flatten().astype(np.float32)

    # L2-normalise so cosine similarity == dot product at recognition time
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm

    return embedding


def load_embeddings_from_db(conn) -> dict[int, np.ndarray]:
    """
    Pull all face embeddings from the face_embeddings table.
    Returns {student_id: embedding_vector}.
    """
    embeddings: dict[int, np.ndarray] = {}

    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute("SELECT student_id, embedding FROM face_embeddings")
        rows = cur.fetchall()

    log.info(f"Found {len(rows)} face embedding(s) in database.")

    for row in rows:
        student_id = row["student_id"]
        raw = row["embedding"]

        try:
            vec = pickle.loads(raw)
            if not isinstance(vec, np.ndarray):
                log.warning(f"Skipping student {student_id}: embedding is not ndarray.")
                continue

            vec = vec.astype(np.float32)
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm

            embeddings[student_id] = vec
            log.info(f"  ✓ student_id={student_id} — shape={vec.shape}")
        except Exception as e:
            log.warning(f"  ✗ student_id={student_id} — could not deserialise: {e}")

    return embeddings


def save_embeddings(embeddings: dict[int, np.ndarray]) -> None:
    """Persist embeddings dict to disk as a single .pkl file."""
    with open(EMBEDDINGS_FILE, "wb") as f:
        pickle.dump(embeddings, f)
    log.info(f"Saved {len(embeddings)} embedding(s) → {EMBEDDINGS_FILE}")


def train(force: bool = False) -> None:
    """
    Main training entry point.
    Loads embeddings from DB, normalises them, writes to models/.
    """
    if EMBEDDINGS_FILE.exists() and not force:
        log.info(
            f"Embeddings file already exists at {EMBEDDINGS_FILE}. "
            "Use --force to retrain."
        )
        return

    log.info("Connecting to database …")
    conn = get_db_connection()

    try:
        embeddings = load_embeddings_from_db(conn)
    finally:
        conn.close()

    if not embeddings:
        log.warning("No embeddings found. Register students first via the API.")
        sys.exit(0)

    save_embeddings(embeddings)
    log.info("Training complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train face embeddings from DB.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing embeddings file.",
    )
    args = parser.parse_args()
    train(force=args.force)
