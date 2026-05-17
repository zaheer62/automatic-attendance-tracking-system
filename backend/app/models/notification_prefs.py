from sqlalchemy import Column, Integer, Boolean, String, ForeignKey
from app.core.database import Base

class NotificationPrefs(Base):
    __tablename__ = "notification_prefs"

    id                     = Column(Integer, primary_key=True, index=True)
    student_id             = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    email_enabled          = Column(Boolean, default=False)
    email_address          = Column(String, default="")
    email_threshold        = Column(Integer, default=75)
    notify_on_absent       = Column(Boolean, default=True)
    notify_weekly_summary  = Column(Boolean, default=False)
    sms_enabled            = Column(Boolean, default=False)
    sms_number             = Column(String, default="")
    sms_threshold          = Column(Integer, default=75)
    sms_on_absent          = Column(Boolean, default=True)