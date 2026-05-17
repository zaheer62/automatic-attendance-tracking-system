"""
backend/app/routers/sync.py
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date

from app.core.database import get_db
from app.models.attendance import AttendanceRecord, AttendanceSession
from app.models.user import User, UserRole
from app.models.subject import Subject

router = APIRouter(prefix="/sync", tags=["Kiosk Sync"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class KioskRecord(BaseModel):
    student_id:    int
    classroom_id:  str
    subject_id:    Optional[int] = None   # ← new
    confidence:    float
    method:        str = "face_recognition"
    timestamp:     Optional[str] = None
    session_id:    Optional[int] = None


class BatchSyncRequest(BaseModel):
    classroom_id: str
    records:      list[KioskRecord]


# ── Helpers ───────────────────────────────────────────────────────────────────

def find_or_create_session(
    classroom: str,
    db: Session,
    timestamp_str: Optional[str] = None,
    subject_id: Optional[int] = None,
) -> AttendanceSession:
    today = date.today()

    # Step 1: Find active session by subject_id
    if subject_id:
        session = db.query(AttendanceSession).filter(
            AttendanceSession.subject_id == subject_id,
            AttendanceSession.is_active == True
        ).first()
        if session:
            return session

    # Step 2: Find ANY active session today
    session = db.query(AttendanceSession).filter(
        AttendanceSession.is_active == True,
        func.date(AttendanceSession.session_date) == today
    ).first()
    if session:
        return session

    # Step 3: Fallback — find by classroom and today's date
    session = db.query(AttendanceSession).filter(
        AttendanceSession.classroom == classroom,
        func.date(AttendanceSession.session_date) == today
    ).first()
    if session:
        return session

    # Step 2: Fallback — find by classroom and today's date
    session = db.query(AttendanceSession).filter(
        AttendanceSession.classroom == classroom,
        func.date(AttendanceSession.session_date) == today
    ).first()
    if session:
        return session

    # Step 3: Create a new session if none found
    first_teacher = db.query(User).filter(User.role == UserRole.teacher).first()

    if subject_id:
        subject = db.query(Subject).filter(Subject.id == subject_id).first()
    else:
        subject = db.query(Subject).first()

    if not first_teacher:
        raise HTTPException(status_code=500, detail="No teacher found in database.")
    if not subject:
        raise HTTPException(status_code=500, detail="No subject found in database.")

    session = AttendanceSession(
        subject_id=subject.id,
        teacher_id=first_teacher.id,
        classroom=classroom,
        session_date=datetime.utcnow(),
        is_active=True,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/attendance")
def sync_single(record: KioskRecord, db: Session = Depends(get_db)):
    # Verify student exists
    student = db.query(User).filter(User.id == record.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student {record.student_id} not found in database.")

    # Find or create session
    session = find_or_create_session(
        record.classroom_id,
        db,
        record.timestamp,
        subject_id=record.subject_id,  # ← pass subject_id
    )

    # Check if already marked
    existing = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session.id,
        AttendanceRecord.student_id == record.student_id,
    ).first()

    if existing:
        return {
            "status": "already_marked",
            "student": student.full_name,
            "session_id": session.id,
        }

    # Create attendance record
    att = AttendanceRecord(
    session_id=session.id,
    student_id=record.student_id,
    is_present=True,
    method="face",
)
    db.add(att)
    db.commit()
    db.refresh(att)

    return {
        "status": "success",
        "student": student.full_name,
        "session_id": session.id,
        "record_id": att.id,
    }


@router.post("/attendance/batch")
def sync_batch(payload: BatchSyncRequest, db: Session = Depends(get_db)):
    results = []
    for record in payload.records:
        try:
            result = sync_single(record, db)
            results.append({"student_id": record.student_id, **result})
        except HTTPException as e:
            results.append({"student_id": record.student_id, "status": "error", "detail": e.detail})
    return {"results": results}


@router.get("/status")
def sync_status():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}