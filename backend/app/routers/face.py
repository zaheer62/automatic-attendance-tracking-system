from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.face import FaceEmbedding
from app.models.user import User, UserRole
from app.face_service import save_face_embedding, recognize_face

router = APIRouter(prefix="/face", tags=["Face Recognition"])


@router.post("/enroll/{student_id}")
async def enroll_face(
    student_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Verify student exists
    student = db.query(User).filter(User.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    image_bytes = await file.read()
    success = save_face_embedding(student_id, image_bytes, db)
    if not success:
        raise HTTPException(status_code=400, detail="No face detected in image. Make sure face is clearly visible and well-lit.")
    return {"message": "Face enrolled successfully", "student_id": student_id, "student_name": student.full_name}


@router.post("/recognize")
async def recognize(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    image_bytes = await file.read()
    student_id, confidence = recognize_face(image_bytes, db)
    if student_id is None:
        return {"recognized": False, "student_id": None, "confidence": confidence}

    # Get student name for display
    student = db.query(User).filter(User.id == student_id).first()
    return {
        "recognized": True,
        "student_id": student_id,
        "confidence": confidence,
        "name": student.full_name if student else None,
    }


@router.get("/enrolled")
def get_enrolled_students(db: Session = Depends(get_db)):
    """Returns list of student IDs that have face embeddings registered."""
    enrolled = db.query(FaceEmbedding.student_id).all()
    return [row.student_id for row in enrolled]
