"""
backend/app/routers/admin_stats.py
Admin-only endpoints powering the AdminDashboard.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db

router = APIRouter(prefix="/attendance/admin", tags=["Admin Stats"])


@router.get("/overview")
def get_overview(db: Session = Depends(get_db)):
    students = db.execute(text(
        "SELECT COUNT(*) FROM users WHERE role='student'"
    )).scalar()

    subjects = db.execute(text(
        "SELECT COUNT(*) FROM subjects"
    )).scalar()

    avg = db.execute(text("""
        SELECT ROUND(
            COUNT(*) FILTER (WHERE ar.is_present = true) * 100.0 /
            NULLIF(COUNT(*), 0), 1
        )
        FROM attendance_records ar
    """)).scalar()

    # FIX: was using .rowcount which always returns -1 or 0 on SELECT
    # Wrap in a subquery and use scalar() instead
    defaulters = db.execute(text("""
        SELECT COUNT(*) FROM (
            SELECT ar.student_id
            FROM attendance_records ar
            GROUP BY ar.student_id
            HAVING
                COUNT(*) FILTER (WHERE ar.is_present = true) * 100.0 /
                NULLIF(COUNT(*), 0) < 75
        ) AS defaulter_list
    """)).scalar()

    return {
        "total_students": students or 0,
        "total_subjects": subjects or 0,
        "avg_attendance": float(avg) if avg else 0.0,
        "defaulters": defaulters or 0,
    }


@router.get("/defaulters")
def get_defaulters(threshold: float = 75.0, db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT
            u.id AS student_id,
            u.full_name AS student_name,
            s.name AS subject_name,
            ROUND(
                COUNT(*) FILTER (WHERE ar.is_present = true) * 100.0 /
                NULLIF(COUNT(*), 0), 1
            ) AS percentage
        FROM attendance_records ar
        JOIN users u ON u.id = ar.student_id
        JOIN attendance_sessions sess ON sess.id = ar.session_id
        JOIN subjects s ON s.id = sess.subject_id
        GROUP BY u.id, u.full_name, s.id, s.name
        HAVING
            COUNT(*) FILTER (WHERE ar.is_present = true) * 100.0 /
            NULLIF(COUNT(*), 0) < :threshold
        ORDER BY percentage ASC
    """), {"threshold": threshold}).fetchall()

    return [
        {
            "student_id": r.student_id,
            "student_name": r.student_name,
            "subject_name": r.subject_name,
            "percentage": float(r.percentage) if r.percentage else 0.0,
            "threshold": threshold,
        }
        for r in rows
    ]


@router.get("/subjects")
def get_subject_stats(threshold: float = 75.0, db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT
            s.name AS subject_name,
            ROUND(
                COUNT(*) FILTER (WHERE ar.is_present = true) * 100.0 /
                NULLIF(COUNT(*), 0), 1
            ) AS avg_percentage,
            COUNT(DISTINCT ar.student_id) AS total_students,
            -- FIX: added below_threshold count that AdminDashboard.tsx needs
            COUNT(DISTINCT CASE
                WHEN (
                    SELECT COUNT(*) FILTER (WHERE ar2.is_present = true) * 100.0 /
                           NULLIF(COUNT(*), 0)
                    FROM attendance_records ar2
                    WHERE ar2.student_id = ar.student_id
                      AND ar2.session_id IN (
                          SELECT id FROM attendance_sessions WHERE subject_id = s.id
                      )
                ) < :threshold THEN ar.student_id
            END) AS below_threshold
        FROM attendance_records ar
        JOIN attendance_sessions sess ON sess.id = ar.session_id
        JOIN subjects s ON s.id = sess.subject_id
        GROUP BY s.id, s.name
        ORDER BY avg_percentage ASC
    """), {"threshold": threshold}).fetchall()

    return [
        {
            "subject_name": r.subject_name,
            "avg_percentage": float(r.avg_percentage) if r.avg_percentage else 0.0,
            "total_students": r.total_students or 0,
            "below_threshold": r.below_threshold or 0,   # now included
        }
        for r in rows
    ]


@router.get("/trends")
def get_trends(days: int = 14, db: Session = Depends(get_db)):
    rows = db.execute(text(f"""
        SELECT
            DATE(sess.session_date) AS day,
            COUNT(*) FILTER (WHERE ar.is_present = true) AS present,
            COUNT(*) AS total
        FROM attendance_records ar
        JOIN attendance_sessions sess ON sess.id = ar.session_id
        WHERE sess.session_date >= NOW() - INTERVAL '{days} days'
        GROUP BY day
        ORDER BY day ASC
    """)).fetchall()

    return [
        {
            "date": str(r.day),
            "present": r.present or 0,
            "total": r.total or 0,
            "percentage": round((r.present or 0) * 100 / r.total, 1) if r.total else 0.0,
        }
        for r in rows
    ]


class OverrideRequest(BaseModel):
    record_id: int
    is_present: bool
    reason: Optional[str] = ""


@router.post("/override")
def manual_override(req: OverrideRequest, db: Session = Depends(get_db)):
    db.execute(text("""
        UPDATE attendance_records
        SET is_present = :is_present,
            override_by = 1
        WHERE id = :id
    """), {"is_present": req.is_present, "id": req.record_id})
    db.commit()
    return {"message": f"Record {req.record_id} updated to is_present={req.is_present}"}
