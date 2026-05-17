from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.attendance import AttendanceSession, AttendanceRecord
from app.models.user import User
from app.models.subject import Subject
from app.schemas.attendance import (
    SessionCreate, SessionResponse,
    AttendanceMark, AttendanceOverride,
    AttendanceRecordResponse
)
from typing import List, Optional
from pydantic import BaseModel
 
router = APIRouter(prefix="/attendance", tags=["Attendance"])
 
 
def get_current_user_id(authorization: Optional[str] = Header(None)) -> Optional[int]:
    """Extract user ID from Bearer token header."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    payload = decode_access_token(token)
    if not payload:
        return None
    return int(payload.get("sub", 0))
 
 
# ── Sessions ──────────────────────────────────────────────────────────────────
 
@router.post("/session", response_model=SessionResponse)
def create_session(
    session_data: SessionCreate,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
):
    teacher_id = get_current_user_id(authorization)
    if not teacher_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
 
    session = AttendanceSession(
        subject_id=session_data.subject_id,
        teacher_id=teacher_id,
        classroom=session_data.classroom
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session
 
 
# ── Start Class ───────────────────────────────────────────────────────────────
 
class StartSessionRequest(BaseModel):
    subject_id: int
    classroom: str = "Room 101"
 
 
@router.post("/session/start")
def start_class_session(
    data: StartSessionRequest,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
):
    """Teacher starts a class — creates an active session for the subject."""
    teacher_id = get_current_user_id(authorization)
    if not teacher_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
 
    from datetime import date
    today = date.today()
 
    # If a session is already active for this teacher, return it
    existing = db.query(AttendanceSession).filter(
        AttendanceSession.teacher_id == teacher_id,
        AttendanceSession.is_active == True
    ).first()
 
    if existing:
        subject = db.query(Subject).filter(Subject.id == existing.subject_id).first()
        return {
            "id": existing.id,
            "subject_id": existing.subject_id,
            "subject_name": subject.name if subject else f"Subject #{existing.subject_id}",
            "started_at": existing.session_date.isoformat(),
            "classroom": existing.classroom,
        }
 
    # Create new session
    session = AttendanceSession(
        subject_id=data.subject_id,
        teacher_id=teacher_id,
        classroom=data.classroom,
        is_active=True,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
 
    subject = db.query(Subject).filter(Subject.id == data.subject_id).first()
 
    return {
        "id": session.id,
        "subject_id": session.subject_id,
        "subject_name": subject.name if subject else f"Subject #{data.subject_id}",
        "started_at": session.session_date.isoformat(),
        "classroom": session.classroom,
    }
 
 
# ── End Class ─────────────────────────────────────────────────────────────────
 
@router.post("/session/{session_id}/end")
def end_class_session(
    session_id: int,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
):
    """Teacher ends a class — marks session as inactive."""
    teacher_id = get_current_user_id(authorization)
    if not teacher_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
 
    session = db.query(AttendanceSession).filter(
        AttendanceSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
 
    session.is_active = False
    db.commit()
    return {"message": "Class ended successfully", "session_id": session_id}
 
 
# ── Get Active Session (Teacher — requires auth) ──────────────────────────────
 
@router.get("/session/active")
def get_active_session(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
):
    """Returns the currently active session for this teacher, if any."""
    teacher_id = get_current_user_id(authorization)
    if not teacher_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
 
    session = db.query(AttendanceSession).filter(
        AttendanceSession.teacher_id == teacher_id,
        AttendanceSession.is_active == True
    ).first()
 
    if not session:
        raise HTTPException(status_code=404, detail="No active session")
 
    subject = db.query(Subject).filter(Subject.id == session.subject_id).first()
 
    return {
        "id": session.id,
        "subject_id": session.subject_id,
        "subject_name": subject.name if subject else f"Subject #{session.subject_id}",
        "started_at": session.session_date.isoformat(),
        "classroom": session.classroom,
    }
 
 
# ── Get Active Session (Public — for Kiosk, no auth needed) ──────────────────
 
@router.get("/session/active/public")
def get_active_session_public(db: Session = Depends(get_db)):
    """Public endpoint for kiosk — returns any active session, no auth needed."""
    session = db.query(AttendanceSession).filter(
        AttendanceSession.is_active == True
    ).first()
 
    if not session:
        raise HTTPException(status_code=404, detail="No active session")
 
    subject = db.query(Subject).filter(Subject.id == session.subject_id).first()
 
    return {
        "id": session.id,
        "subject_id": session.subject_id,
        "subject_name": subject.name if subject else f"Subject #{session.subject_id}",
        "started_at": session.session_date.isoformat(),
        "classroom": session.classroom,
    }
 
 
# ── Get Session by ID ─────────────────────────────────────────────────────────
 
@router.get("/session/{session_id}", response_model=SessionResponse)
def get_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(AttendanceSession).filter(
        AttendanceSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
 
 
@router.get("/session/{session_id}/records", response_model=List[AttendanceRecordResponse])
def get_session_records(session_id: int, db: Session = Depends(get_db)):
    return db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session_id
    ).all()
 
 
# ── Mark attendance ───────────────────────────────────────────────────────────
 
@router.post("/mark", response_model=AttendanceRecordResponse)
def mark_attendance(data: AttendanceMark, db: Session = Depends(get_db)):
 
    # ── FIX 1: Reject low-confidence face scans ──────────────────────────────
    if data.method == "face" and (
        data.confidence_score is None or data.confidence_score < 0.6
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Face confidence too low ({data.confidence_score}), please try again"
        )
 
    session = db.query(AttendanceSession).filter(
        AttendanceSession.id == data.session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
 
    # ── FIX 2: Verify session is still active ────────────────────────────────
    if not session.is_active:
        raise HTTPException(status_code=400, detail="Session is no longer active")
 
    student = db.query(User).filter(User.id == data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
 
    existing = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == data.session_id,
        AttendanceRecord.student_id == data.student_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Attendance already marked")
 
    record = AttendanceRecord(
        session_id=data.session_id,
        student_id=data.student_id,
        method=data.method,
        confidence_score=data.confidence_score,
        is_present=True
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
 
 
# ── Test Face Recognition (temporary debug endpoint) ─────────────────────────
 
@router.post("/test-face")
async def test_face_recognition(
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Test endpoint — scan a face and see which student it matches.
    Use this to verify all 12 students are recognized correctly
    before going live. Remove this endpoint in production.
    """
    from app.services.face_service import recognize_face
 
    image_bytes = await image.read()
    student_id, confidence = recognize_face(image_bytes, db)
 
    student = db.query(User).filter(User.id == student_id).first() if student_id else None
 
    return {
        "recognized_student_id": student_id,
        "recognized_name": student.full_name if student else "No match / confidence too low",
        "confidence": confidence,
        "accepted": confidence >= 0.6,
        "message": (
            f"✅ Recognized as {student.full_name}" if student
            else "❌ No confident match found"
        )
    }
 
 
# ── Override (patch by record id) ────────────────────────────────────────────
 
@router.patch("/{record_id}/override", response_model=AttendanceRecordResponse)
def override_attendance(
    record_id: int,
    data: AttendanceOverride,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
):
    teacher_id = get_current_user_id(authorization) or 1
    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.id == record_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
 
    record.is_present = data.is_present
    record.override_by = teacher_id
    db.commit()
    db.refresh(record)
    return record
 
 
# ── Teacher: today's attendance for a subject ─────────────────────────────────
 
@router.get("/teacher/today")
def get_today_attendance(
    subject_id: int,
    date: str,
    db: Session = Depends(get_db)
):
    from datetime import datetime
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")
 
    sessions = db.query(AttendanceSession).filter(
        AttendanceSession.subject_id == subject_id,
        cast(AttendanceSession.session_date, Date) == target_date
    ).all()
    session_ids = [s.id for s in sessions]
 
    students = db.query(User).filter(User.role == "student").all()
 
    result = []
    for student in students:
        record = None
        if session_ids:
            record = db.query(AttendanceRecord).filter(
                AttendanceRecord.student_id == student.id,
                AttendanceRecord.session_id.in_(session_ids)
            ).first()
 
        if record is None:
            status = "not_marked"
        elif record.is_present:
            status = "present"
        else:
            status = "absent"
 
        result.append({
            "student_id": student.id,
            "student_name": student.full_name,
            "status": status,
            "marked_at": record.marked_at.isoformat() if record else None,
            "method": record.method if record else None,
        })
 
    return result
 
 
# ── Admin: override by student + subject + date ───────────────────────────────
 
class TeacherOverrideRequest(BaseModel):
    student_id: int
    subject_id: int
    session_date: str
    status: str
    reason: Optional[str] = ""
 
 
@router.post("/admin/override")
def teacher_override(
    req: TeacherOverrideRequest,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
):
    from datetime import datetime
    teacher_id = get_current_user_id(authorization) or 1
 
    try:
        target_date = datetime.strptime(req.session_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="session_date must be YYYY-MM-DD")
 
    session = db.query(AttendanceSession).filter(
        AttendanceSession.subject_id == req.subject_id,
        cast(AttendanceSession.session_date, Date) == target_date
    ).first()
 
    if not session:
        session = AttendanceSession(
            subject_id=req.subject_id,
            teacher_id=teacher_id,
            classroom="manual",
            session_date=datetime.combine(target_date, datetime.min.time())
        )
        db.add(session)
        db.commit()
        db.refresh(session)
 
    is_present = req.status == "present"
 
    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session.id,
        AttendanceRecord.student_id == req.student_id
    ).first()
 
    if record:
        record.is_present = is_present
        record.override_by = teacher_id
        record.method = "manual"
    else:
        record = AttendanceRecord(
            session_id=session.id,
            student_id=req.student_id,
            method="manual",
            is_present=is_present,
            override_by=teacher_id
        )
        db.add(record)
 
    db.commit()
    db.refresh(record)
    return {"message": f"Attendance marked as '{req.status}' for student {req.student_id}"}
 
 
# ── Student records (auth protected) ─────────────────────────────────────────
 
@router.get("/student/{student_id}/records")
def get_student_records(
    student_id: int,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
):
    # ── FIX 3: Students can only view their own records ───────────────────────
    requesting_user_id = get_current_user_id(authorization)
    if not requesting_user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
 
    requester = db.query(User).filter(User.id == requesting_user_id).first()
    if not requester:
        raise HTTPException(status_code=401, detail="User not found")
 
    # Students can only see their own data; teachers/admins can see anyone's
    if requester.role == "student" and requesting_user_id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
 
    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == student_id
    ).order_by(AttendanceRecord.marked_at.desc()).all()
 
    result = []
    for r in records:
        session = db.query(AttendanceSession).filter(
            AttendanceSession.id == r.session_id
        ).first()
        subject = db.query(Subject).filter(
            Subject.id == session.subject_id
        ).first() if session else None
 
        result.append({
            "subject_name": subject.name if subject else "Unknown",
            "date": r.marked_at.isoformat() if r.marked_at else None,
            "status": "present" if r.is_present else "absent",
            "method": r.method.value if r.method else None,
        })
 
    return result
 
 
# ── Student stats (auth protected) ───────────────────────────────────────────
 
@router.get("/student/{student_id}/stats")
def get_student_stats(
    student_id: int,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
):
    # ── FIX 3: Same auth protection for stats ────────────────────────────────
    requesting_user_id = get_current_user_id(authorization)
    if not requesting_user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
 
    requester = db.query(User).filter(User.id == requesting_user_id).first()
    if not requester:
        raise HTTPException(status_code=401, detail="User not found")
 
    if requester.role == "student" and requesting_user_id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
 
    total = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == student_id
    ).count()
 
    present = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == student_id,
        AttendanceRecord.is_present == True
    ).count()
 
    percentage = (present / total * 100) if total > 0 else 0
 
    return {
        "student_id": student_id,
        "total_sessions": total,
        "present": present,
        "absent": total - present,
        "percentage": round(percentage, 2)
    }
 
 
# ── Admin stats ───────────────────────────────────────────────────────────────
 
@router.get("/admin/overview")
def admin_overview(db: Session = Depends(get_db)):
    total_students = db.query(User).filter(User.role == "student").count()
    total_subjects = db.query(Subject).count()
 
    total_records = db.query(AttendanceRecord).count()
    present_records = db.query(AttendanceRecord).filter(
        AttendanceRecord.is_present == True
    ).count()
 
    avg_attendance = round((present_records / total_records * 100), 2) if total_records > 0 else 0
 
    return {
        "total_students": total_students,
        "total_subjects": total_subjects,
        "avg_attendance": avg_attendance,
    }
 
 
@router.get("/admin/defaulters")
def admin_defaulters(db: Session = Depends(get_db)):
    threshold = 75.0
    students = db.query(User).filter(User.role == "student").all()
    subjects = db.query(Subject).all()
    defaulters = []
 
    for student in students:
        for subject in subjects:
            sessions = db.query(AttendanceSession).filter(
                AttendanceSession.subject_id == subject.id
            ).all()
            session_ids = [s.id for s in sessions]
            if not session_ids:
                continue
 
            total = len(session_ids)
            present = db.query(AttendanceRecord).filter(
                AttendanceRecord.student_id == student.id,
                AttendanceRecord.session_id.in_(session_ids),
                AttendanceRecord.is_present == True
            ).count()
 
            percentage = round((present / total) * 100, 2)
            if percentage < threshold:
                defaulters.append({
                    "student_id": student.id,
                    "student_name": student.full_name,
                    "subject_name": subject.name,
                    "percentage": percentage,
                    "threshold": threshold,
                })
 
    return defaulters
 
 
@router.get("/admin/subjects")
def admin_subjects(db: Session = Depends(get_db)):
    subjects = db.query(Subject).all()
    result = []
    threshold = 75.0
 
    for subject in subjects:
        sessions = db.query(AttendanceSession).filter(
            AttendanceSession.subject_id == subject.id
        ).all()
        session_ids = [s.id for s in sessions]
        if not session_ids:
            continue
 
        students = db.query(User).filter(User.role == "student").all()
        percentages = []
        below = 0
 
        for student in students:
            total = len(session_ids)
            present = db.query(AttendanceRecord).filter(
                AttendanceRecord.student_id == student.id,
                AttendanceRecord.session_id.in_(session_ids),
                AttendanceRecord.is_present == True
            ).count()
            pct = round((present / total) * 100, 2)
            percentages.append(pct)
            if pct < threshold:
                below += 1
 
        avg = round(sum(percentages) / len(percentages), 2) if percentages else 0
        result.append({
            "subject_name": subject.name,
            "avg_percentage": avg,
            "total_students": len(students),
            "below_threshold": below,
        })
 
    return result
 
 
@router.get("/admin/trends")
def admin_trends(db: Session = Depends(get_db)):
    from datetime import datetime, timedelta
    today = datetime.utcnow().date()
    result = []
 
    for i in range(13, -1, -1):
        day = today - timedelta(days=i)
        sessions = db.query(AttendanceSession).filter(
            cast(AttendanceSession.session_date, Date) == day
        ).all()
        session_ids = [s.id for s in sessions]
 
        total = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id.in_(session_ids)
        ).count() if session_ids else 0
 
        present = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id.in_(session_ids),
            AttendanceRecord.is_present == True
        ).count() if session_ids else 0
 
        pct = round((present / total) * 100, 2) if total > 0 else 0
        result.append({
            "date": day.isoformat(),
            "present": present,
            "total": total,
            "percentage": pct,
        })
 
    return result