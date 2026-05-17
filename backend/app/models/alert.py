from sqlalchemy import Column, Integer, Float, Boolean, DateTime, ForeignKey, String
from sqlalchemy.sql import func
from app.core.database import Base

class AlertConfig(Base):
    __tablename__ = "alert_configs"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)  # None = global
    threshold_percentage = Column(Float, default=75.0)
    email_enabled = Column(Boolean, default=True)
    sms_enabled = Column(Boolean, default=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

class AlertLog(Base):
    __tablename__ = "alert_logs"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    message = Column(String, nullable=False)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    channel = Column(String, nullable=False)  # email or sms