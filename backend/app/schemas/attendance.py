from pydantic import BaseModel
from datetime import datetime
from enum import Enum

class AttendanceMethod(str, Enum):
    face = "face"
    rfid = "rfid"
    manual = "manual"

class SessionCreate(BaseModel):
    subject_id: int
    classroom: str

class AttendanceMark(BaseModel):
    session_id: int
    student_id: int
    method: AttendanceMethod = AttendanceMethod.manual
    confidence_score: float = None

class AttendanceOverride(BaseModel):
    is_present: bool

class AttendanceRecordResponse(BaseModel):
    id: int
    session_id: int
    student_id: int
    method: AttendanceMethod
    confidence_score: float = None
    is_present: bool
    marked_at: datetime

    class Config:
        from_attributes = True

class SessionResponse(BaseModel):
    id: int
    subject_id: int
    teacher_id: int
    classroom: str
    session_date: datetime
    is_active: bool

    class Config:
        from_attributes = True
        