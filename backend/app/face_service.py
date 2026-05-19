import numpy as np
from sqlalchemy.orm import Session
from app.models.face import FaceEmbedding
import pickle
import cv2

try:
    import face_recognition
    FACE_RECOGNITION_AVAILABLE = True
    print("[face_service] face_recognition imported successfully")
except ImportError as e:
    FACE_RECOGNITION_AVAILABLE = False
    print(f"[face_service] face_recognition not available: {e}. Running in cloud mode.")

TOLERANCE = 0.5

def detect_and_encode_face(image_bytes: bytes):
    if not FACE_RECOGNITION_AVAILABLE:
        return None
    nparr = np.frombuffer(image_bytes, np.uint8)
    img   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return None
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    locations = face_recognition.face_locations(rgb, model="hog")
    if not locations:
        rgb = cv2.cvtColor(cv2.flip(img, 1), cv2.COLOR_BGR2RGB)
        locations = face_recognition.face_locations(rgb, model="hog")
        if not locations:
            print("[face] No face detected")
            return None
    encodings = face_recognition.face_encodings(rgb, locations)
    if not encodings:
        return None
    return encodings[0]

def save_face_embedding(student_id: int, image_bytes: bytes, db: Session):
    if not FACE_RECOGNITION_AVAILABLE:
        print("[face] Face recognition not available in cloud mode")
        return False
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
    if not FACE_RECOGNITION_AVAILABLE:
        print("[face] Face recognition not available in cloud mode")
        return None, 0.0
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
        distances = face_recognition.face_distance(stored_encodings, encoding)
        min_dist  = float(np.min(distances))
        print(f"[face] student_id={row.student_id}, min_distance={min_dist:.3f}")
        if min_dist < best_distance:
            best_distance = min_dist
            best_match_id = row.student_id
    confidence = round(max(0.0, 1.0 - best_distance), 2)
    if best_distance <= TOLERANCE:
        return best_match_id, confidence
    return None, confidence