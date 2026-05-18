import numpy as np
from sqlalchemy.orm import Session
from app.models.face import FaceEmbedding
import pickle
import cv2
import face_recognition

# How strict the match is. Lower = stricter. 0.5 is tight, 0.6 is default, 0.5 recommended
TOLERANCE = 0.5

# ── helpers ──────────────────────────────────────────────────────────────────

def detect_and_encode_face(image_bytes: bytes):
    """Return 128-d face encoding, or None if no face detected."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return None

    # face_recognition uses RGB not BGR
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    # Detect face locations
    locations = face_recognition.face_locations(rgb, model="hog")
    if not locations:
        # Try flipped image
        rgb = cv2.cvtColor(cv2.flip(img, 1), cv2.COLOR_BGR2RGB)
        locations = face_recognition.face_locations(rgb, model="hog")
        if not locations:
            print("[face] No face detected")
            return None

    # Get encoding for the largest face
    encodings = face_recognition.face_encodings(rgb, locations)
    if not encodings:
        return None

    return encodings[0]  # 128-d numpy array

# ── public API ────────────────────────────────────────────────────────────────

def save_face_embedding(student_id: int, image_bytes: bytes, db: Session):
    encoding = detect_and_encode_face(image_bytes)
    if encoding is None:
        print(f"[face] No face detected for student {student_id}")
        return False

    existing = db.query(FaceEmbedding).filter(
        FaceEmbedding.student_id == student_id
    ).first()

    if existing:
        data = pickle.loads(existing.embedding)
        if isinstance(data, list):
            data.append(encoding)
        else:
            data = [data, encoding]
        existing.embedding = pickle.dumps(data)
    else:
        db.add(FaceEmbedding(
            student_id=student_id,
            embedding=pickle.dumps([encoding])
        ))

    db.commit()
    print(f"[face] Saved encoding for student {student_id}")
    return True


def recognize_face(image_bytes: bytes, db: Session):
    encoding = detect_and_encode_face(image_bytes)
    if encoding is None:
        print("[face] No face detected in image")
        return None, 0.0

    all_embeddings = db.query(FaceEmbedding).all()
    if not all_embeddings:
        print("[face] No embeddings in database")
        return None, 0.0

    best_match_id = None
    best_distance = float("inf")

    for row in all_embeddings:
        data = pickle.loads(row.embedding)
        stored_encodings = data if isinstance(data, list) else [data]

        # Compare against all stored encodings for this student
        distances = face_recognition.face_distance(stored_encodings, encoding)
        min_dist  = float(np.min(distances))

        print(f"[face] student_id={row.student_id}, min_distance={min_dist:.3f}")

        if min_dist < best_distance:
            best_distance = min_dist
            best_match_id = row.student_id

    confidence = round(max(0.0, 1.0 - best_distance), 2)
    print(f"[face] Best match: student_id={best_match_id}, distance={best_distance:.3f}, confidence={confidence}")

    # Reject if distance is above tolerance (unknown face)
    if best_distance <= TOLERANCE:
        print(f"[face] Accepted match for student_id={best_match_id}")
        return best_match_id, confidence

    print(f"[face] Rejected — unknown face (distance {best_distance:.3f} > tolerance {TOLERANCE})")
    return None, confidence