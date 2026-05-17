from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.subject import Subject
from app.schemas.subject import SubjectCreate, SubjectResponse
from typing import List

router = APIRouter(prefix="/subjects", tags=["Subjects"])

@router.post("/", response_model=SubjectResponse)
def create_subject(subject_data: SubjectCreate, db: Session = Depends(get_db)):
    existing = db.query(Subject).filter(Subject.code == subject_data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Subject code already exists")
    subject = Subject(
        name=subject_data.name,
        code=subject_data.code,
        teacher_id=subject_data.teacher_id
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject

@router.get("/", response_model=List[SubjectResponse])
def get_subjects(request: Request, db: Session = Depends(get_db)):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if token:
        payload = decode_access_token(token)
        if payload and payload.get("role") == "teacher":
            teacher_id = int(payload.get("sub"))
            return db.query(Subject).filter(
                Subject.teacher_id == teacher_id,
                Subject.is_active == True
            ).all()
    return db.query(Subject).filter(Subject.is_active == True).all()

@router.get("/{subject_id}", response_model=SubjectResponse)
def get_subject(subject_id: int, db: Session = Depends(get_db)):
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject