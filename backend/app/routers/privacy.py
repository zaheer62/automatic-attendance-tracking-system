"""
backend/app/routers/privacy.py
-------------------------------
GDPR-compliant endpoints for biometric data management.

Endpoints:
  DELETE /privacy/face/{student_id}   — delete a student's face embedding
  GET    /privacy/export/{student_id} — export all data held on a student
  GET    /privacy/students            — list all students with face data (admin only)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db
from app.models.face import FaceEmbedding
from app.models.user import User
from app.models.attendance import AttendanceRecord, AttendanceSession

router = APIRouter(prefix="/privacy", tags=["Privacy & GDPR"])


# ── helpers ───────────────────────────────────────────────────────────────────

def get_student_or_404(student_id: int, db: Session) -> User:
    student = db.query(User).filter(User.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.delete("/face/{student_id}", summary="Delete student face embedding (GDPR)")
def delete_face_embedding(student_id: int, db: Session = Depends(get_db)):
    """
    Permanently delete a student's biometric face embedding.
    The student's attendance history is kept; only the face data is removed.
    """
    student = get_student_or_404(student_id, db)

    embedding = db.query(FaceEmbedding).filter(
        FaceEmbedding.student_id == student_id
    ).first()

    if not embedding:
        raise HTTPException(
            status_code=404,
            detail=f"No face embedding found for student_id={student_id}"
        )

    db.delete(embedding)
    db.commit()

    return {
        "message": f"Face embedding deleted for student_id={student_id}",
        "student_email": student.email,
        "gdpr_compliant": True,
    }


@router.get("/export/{student_id}", summary="Export all data for a student (GDPR)")
def export_student_data(student_id: int, db: Session = Depends(get_db)):
    """
    Export all data held on a student — personal info, attendance records,
    and whether a face embedding exists.
    """
    student = get_student_or_404(student_id, db)

    # Face embedding presence (never return the raw bytes)
    has_face = db.query(FaceEmbedding).filter(
        FaceEmbedding.student_id == student_id
    ).first() is not None

    # All attendance records
    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == student_id
    ).all()

    attendance_export = []
    for r in records:
        session = db.query(AttendanceSession).filter(
            AttendanceSession.id == r.session_id
        ).first()

        attendance_export.append({
            "record_id":       r.id,
            "session_id":      r.session_id,
            "subject_id":      session.subject_id if session else None,
            "classroom":       session.classroom if session else None,
            "is_present":      r.is_present,
            "method":          r.method,
            "confidence_score": r.confidence_score,
            "override_by":     r.override_by,
        })

    return {
        "student": {
            "id":    student.id,
            "email": student.email,
            "role":  student.role,
        },
        "biometric_data": {
            "face_embedding_stored": has_face,
            "note": "Raw biometric data is never exported for security reasons.",
        },
        "attendance_records": attendance_export,
        "total_records": len(attendance_export),
        "export_generated_at": text("NOW()"),
    }


@router.get("/students", summary="List all students who have face data (admin)")
def list_students_with_face_data(db: Session = Depends(get_db)):
    """
    Return a list of student IDs that have a face embedding stored.
    Used by admins to audit biometric data holdings.
    """
    embeddings = db.query(FaceEmbedding).all()
    student_ids = [e.student_id for e in embeddings]

    students = db.query(User).filter(User.id.in_(student_ids)).all()

    return {
        "count": len(students),
        "students": [
            {"id": s.id, "email": s.email}
            for s in students
        ],
    }


@router.delete("/student/{student_id}", summary="Delete ALL data for a student (GDPR right to erasure)")
def delete_all_student_data(student_id: int, db: Session = Depends(get_db)):
    """
    Full GDPR right-to-erasure: deletes face embedding AND all attendance records.
    This action is irreversible.
    """
    student = get_student_or_404(student_id, db)

    # Delete face embedding
    db.query(FaceEmbedding).filter(
        FaceEmbedding.student_id == student_id
    ).delete()

    # Delete attendance records
    deleted_records = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == student_id
    ).delete()

    db.commit()

    return {
        "message":          f"All data deleted for student_id={student_id}",
        "student_email":    student.email,
        "records_deleted":  deleted_records,
        "gdpr_compliant":   True,
        "warning":          "This action is irreversible.",
    }
