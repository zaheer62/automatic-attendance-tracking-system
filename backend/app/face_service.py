import numpy as np
from sqlalchemy.orm import Session
from app.models.face import FaceEmbedding
import pickle
import cv2

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
)

# ── helpers ──────────────────────────────────────────────────────────────────

def detect_and_crop_face(image_bytes: bytes):
    """Return a 200×200 grayscale face crop, or None."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return None

    for frame in [img, cv2.flip(img, 1)]:
        gray  = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        for scale, neighbors, minsize in [
            (1.1, 5, (60, 60)),
            (1.05, 3, (40, 40)),
            (1.3,  2, (30, 30)),
        ]:
            faces = face_cascade.detectMultiScale(
                gray, scale, neighbors, minSize=minsize
            )
            if len(faces) > 0:
                x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
                crop = gray[y:y+h, x:x+w]
                crop = cv2.resize(crop, (200, 200))
                crop = cv2.equalizeHist(crop)
                return crop

    return None


def _build_recognizer(all_embeddings):
    """Train a fresh LBPH recognizer from DB rows."""
    recognizer = cv2.face.LBPHFaceRecognizer_create(
        radius=2, neighbors=16, grid_x=8, grid_y=8
    )
    faces, labels = [], []
    for row in all_embeddings:
        data = pickle.loads(row.embedding)
        # data may be a single face or a list of faces (multi-sample)
        if isinstance(data, list):
            for face_arr in data:
                faces.append(face_arr)
                labels.append(row.student_id)
        else:
            faces.append(data)
            labels.append(row.student_id)

    if not faces:
        return None

    recognizer.train(faces, np.array(labels))
    return recognizer

# ── public API ────────────────────────────────────────────────────────────────

def save_face_embedding(student_id: int, image_bytes: bytes, db: Session):
    crop = detect_and_crop_face(image_bytes)
    if crop is None:
        print(f"[face] No face detected for student {student_id}")
        return False

    existing = db.query(FaceEmbedding).filter(
        FaceEmbedding.student_id == student_id
    ).first()

    if existing:
        # Append new sample to existing list for better accuracy
        data = pickle.loads(existing.embedding)
        if isinstance(data, list):
            data.append(crop)
        else:
            data = [data, crop]         # migrate old single-array format
        existing.embedding = pickle.dumps(data)
    else:
        db.add(FaceEmbedding(
            student_id=student_id,
            embedding=pickle.dumps([crop])  # always store as list
        ))

    db.commit()
    print(f"[face] Saved embedding for student {student_id}")
    return True


def recognize_face(image_bytes: bytes, db: Session):
    crop = detect_and_crop_face(image_bytes)
    if crop is None:
        return None, 0.0

    all_embeddings = db.query(FaceEmbedding).all()
    if not all_embeddings:
        return None, 0.0

    recognizer = _build_recognizer(all_embeddings)
    if recognizer is None:
        return None, 0.0

    label, distance = recognizer.predict(crop)

    # LBPH distance: lower = better. 0 = perfect, ~80 = same person, >100 = different
    confidence = round(max(0.0, 1.0 - distance / 100.0), 2)
    print(f"[face] Predicted student_id={label}, distance={distance:.1f}, confidence={confidence}")

    # Only accept if distance is low enough (strict threshold)
    if distance < 120:
        return label, confidence

    print(f"[face] Rejected match (distance {distance:.1f} too high)")
    return None, confidence