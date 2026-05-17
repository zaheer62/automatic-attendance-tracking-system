from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User, UserRole
from typing import List
from pydantic import BaseModel
 
router = APIRouter(prefix="/users", tags=["Users"])
 
 
class StudentResponse(BaseModel):
    id: int
    full_name: str
    email: str
    student_id: str | None = None
 
    class Config:
        from_attributes = True
 
 
@router.get("/students", response_model=List[StudentResponse])
def get_students(db: Session = Depends(get_db)):
    """Returns all students — used by Face Enrollment page."""
    students = db.query(User).filter(User.role == UserRole.student).all()
    return students
 
 
@router.get("/teachers", response_model=List[StudentResponse])
def get_teachers(db: Session = Depends(get_db)):
    """Returns all teachers."""
    teachers = db.query(User).filter(User.role == UserRole.teacher).all()
    return teachers
 
 
@router.get("/students/{student_id}", response_model=StudentResponse)
def get_student_by_id(student_id: int, db: Session = Depends(get_db)):
    """Returns a single student by their numeric ID."""
    student = db.query(User).filter(
        User.id == student_id,
        User.role == UserRole.student
    ).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student