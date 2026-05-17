from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Enum
from sqlalchemy.sql import func
from app.core.database import Base
import enum

class AttendanceMethod(str, enum.Enum):
    face = "face"
    rfid = "rfid"
    manual = "manual"

class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    classroom = Column(String, nullable=False)
    session_date = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("attendance_sessions.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    method = Column(Enum(AttendanceMethod), default=AttendanceMethod.face)
    confidence_score = Column(Float, nullable=True)  # for face recognition
    is_present = Column(Boolean, default=True)
    override_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    marked_at = Column(DateTime(timezone=True), server_default=func.now())