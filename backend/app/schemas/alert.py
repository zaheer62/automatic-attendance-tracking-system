from pydantic import BaseModel
from typing import Optional

class AlertConfigCreate(BaseModel):
    subject_id: Optional[int] = None
    threshold_percentage: float = 75.0
    email_enabled: bool = True
    sms_enabled: bool = False

class AlertConfigResponse(BaseModel):
    id: int
    subject_id: Optional[int] = None
    threshold_percentage: float
    email_enabled: bool
    sms_enabled: bool
    created_by: int

    class Config:
        from_attributes = True

class AlertLogResponse(BaseModel):
    id: int
    student_id: int
    subject_id: Optional[int] = None
    message: str
    channel: str

    class Config:
        from_attributes = True