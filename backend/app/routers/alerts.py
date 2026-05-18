from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.alert import AlertConfig, AlertLog
from app.models.attendance import AttendanceRecord
from app.models.user import User, UserRole
from app.schemas.alert import AlertConfigCreate, AlertConfigResponse, AlertLogResponse
from typing import List, Optional
from pydantic import BaseModel
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import requests

router = APIRouter(prefix="/alerts", tags=["Alerts"])


# ─── Helpers ────────────────────────────────────────────────────────────────

def send_email(to: str, subject: str, body: str):
    """Send an email via SMTP. Reads config from environment variables."""
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    mail_from = os.getenv("MAIL_FROM", smtp_user)

    if not smtp_user or not smtp_pass:
        print(f"[EMAIL SKIPPED] SMTP not configured. Would send to {to}: {subject}")
        return False

    if smtp_user == "your@gmail.com" or smtp_pass == "your_app_password":
        print(f"[EMAIL SKIPPED] SMTP credentials are still placeholders. Update your .env file.")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = mail_from
        msg["To"] = to
        msg.attach(MIMEText(body, "html"))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(mail_from, to, msg.as_string())
        print(f"[EMAIL SENT] To: {to} | Subject: {subject}")
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] {e}")
        return False


def send_sms(to: str, body: str):
    """Send SMS via Fast2SMS — works with Indian numbers."""
    api_key = os.getenv("FAST2SMS_API_KEY", "")
    if not api_key:
        print(f"[SMS SKIPPED] FAST2SMS_API_KEY not configured. Would send to {to}: {body}")
        return False

    # Strip +91 prefix, keep only 10 digits
    number = to.strip()
    if number.startswith("+91"):
        number = number[3:]
    elif number.startswith("91") and len(number) == 12:
        number = number[2:]

    if len(number) != 10 or not number.isdigit():
        print(f"[SMS ERROR] Invalid Indian mobile number: {to}")
        return False

    try:
        response = requests.get(
            "https://www.fast2sms.com/dev/bulkV2",
            headers={"authorization": api_key},
            params={
                "route": "q",
                "message": body,
                "language": "english",
                "flash": 0,
                "numbers": number,
            },
            timeout=10
        )
        result = response.json()
        print(f"[SMS] Fast2SMS response: {result}")

        if result.get("return"):
            print(f"[SMS SENT] To: {number}")
            return True
        else:
            print(f"[SMS ERROR] {result.get('message', result)}")
            return False
    except Exception as e:
        print(f"[SMS ERROR] {e}")
        return False


def build_email_body(student_name: str, percentage: float, threshold: float, subject_name: str = "") -> str:
    subject_line = f" for <strong>{subject_name}</strong>" if subject_name else ""
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #fecaca;border-radius:10px;overflow:hidden;">
      <div style="background:#dc2626;padding:24px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:22px;">⚠️ Low Attendance Alert</h1>
      </div>
      <div style="padding:28px;background:#fff;">
        <p style="font-size:15px;color:#111;">Dear <strong>{student_name}</strong>,</p>
        <p style="font-size:14px;color:#374151;">
          Your attendance{subject_line} has dropped to
          <strong style="color:#dc2626;font-size:18px;">{round(percentage, 1)}%</strong>,
          which is below the required threshold of <strong>{threshold}%</strong>.
        </p>
        <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:14px 18px;border-radius:6px;margin:20px 0;">
          <p style="margin:0;font-size:13px;color:#991b1b;">
            Please attend upcoming classes regularly to avoid academic penalties.
          </p>
        </div>
        <p style="font-size:12px;color:#9ca3af;margin-top:24px;">
          This is an automated alert from the Attendance Tracking System.
        </p>
      </div>
    </div>
    """


# ─── Schemas ────────────────────────────────────────────────────────────────

class AlertRuleCreate(BaseModel):
    subject_id: int
    threshold_percent: Optional[float] = None
    threshold_percentage: Optional[float] = None
    notify_email: Optional[bool] = True
    notify_sms: Optional[bool] = False
    email_enabled: Optional[bool] = None
    sms_enabled: Optional[bool] = None
    email_address: Optional[str] = ""
    phone_number: Optional[str] = ""
    is_active: Optional[bool] = True

    def resolved_threshold(self) -> float:
        return self.threshold_percent or self.threshold_percentage or 75.0

    def resolved_email(self) -> bool:
        if self.email_enabled is not None:
            return self.email_enabled
        return self.notify_email or False

    def resolved_sms(self) -> bool:
        if self.sms_enabled is not None:
            return self.sms_enabled
        return self.notify_sms or False


# ─── Routes ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[AlertConfigResponse])
def get_all_alert_configs(db: Session = Depends(get_db)):
    return db.query(AlertConfig).all()


@router.post("/")
def create_alert_rule(rule: AlertRuleCreate, db: Session = Depends(get_db)):
    admin = db.query(User).filter(User.role == UserRole.admin).first()
    if not admin:
        raise HTTPException(status_code=500, detail="No admin user found in database.")

    config = AlertConfig(
        subject_id=rule.subject_id,
        threshold_percentage=rule.resolved_threshold(),
        email_enabled=rule.resolved_email(),
        sms_enabled=rule.resolved_sms(),
        created_by=admin.id
    )
    db.add(config)
    db.commit()
    db.refresh(config)

    return {
        "id": config.id,
        "subject_id": config.subject_id,
        "threshold_percent": config.threshold_percentage,
        "threshold_percentage": config.threshold_percentage,
        "notify_email": config.email_enabled,
        "notify_sms": config.sms_enabled,
        "email_address": rule.email_address or "",
        "phone_number": rule.phone_number or "",
        "is_active": True,
    }


@router.delete("/{config_id}")
def delete_alert_rule(config_id: int, db: Session = Depends(get_db)):
    config = db.query(AlertConfig).filter(AlertConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    db.delete(config)
    db.commit()
    return {"message": f"Alert rule {config_id} deleted"}


@router.post("/config", response_model=AlertConfigResponse)
def create_alert_config(config_data: AlertConfigCreate, db: Session = Depends(get_db)):
    admin = db.query(User).filter(User.role == UserRole.admin).first()
    config = AlertConfig(
        subject_id=config_data.subject_id,
        threshold_percentage=config_data.threshold_percentage,
        email_enabled=config_data.email_enabled,
        sms_enabled=config_data.sms_enabled,
        created_by=admin.id if admin else None
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


@router.get("/config", response_model=List[AlertConfigResponse])
def get_alert_configs(db: Session = Depends(get_db)):
    return db.query(AlertConfig).all()


@router.post("/check")
def check_attendance_alerts(
    teacher_email: Optional[str] = None,
    teacher_phone: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Check all students' attendance against alert configs.
    Sends real email/SMS to:
      - The student (their registered email)
      - The teacher (teacher_email / teacher_phone if provided)
    """
    configs = db.query(AlertConfig).all()
    if not configs:
        return {"message": "No alert configs found"}

    alerts_sent = []
    students = db.query(User).filter(User.role == UserRole.student).all()

    from app.models.subject import Subject
    subject_map = {s.id: s.name for s in db.query(Subject).all()}

    for student in students:
        total = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == student.id
        ).count()
        present = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == student.id,
            AttendanceRecord.is_present == True
        ).count()

        if total == 0:
            continue

        percentage = (present / total) * 100

        for config in configs:
            if percentage < config.threshold_percentage:

                existing = db.query(AlertLog).filter(
                    AlertLog.student_id == student.id,
                    AlertLog.subject_id == config.subject_id
                ).first()
                if existing:
                    continue

                subject_name = subject_map.get(config.subject_id, "")
                alert_msg = (
                    f"Alert: {student.full_name} attendance is "
                    f"{round(percentage, 1)}% — below {config.threshold_percentage}%"
                )
                email_body = build_email_body(
                    student.full_name, percentage,
                    config.threshold_percentage, subject_name
                )
                email_subject = f"⚠️ Low Attendance Alert – {student.full_name}"
                sms_body = (
                    f"Alert: {student.full_name}'s attendance is "
                    f"{round(percentage, 1)}%, below the {config.threshold_percentage}% threshold."
                )

                sent_channels = []

                # ── Email alerts ──────────────────────────────────────────
                if config.email_enabled:
                    if getattr(student, "email", None):
                        ok = send_email(student.email, email_subject, email_body)
                        if ok:
                            sent_channels.append("email→student")

                    if teacher_email:
                        ok = send_email(teacher_email, email_subject, email_body)
                        if ok:
                            sent_channels.append("email→teacher")

                # ── SMS alerts ────────────────────────────────────────────
                if config.sms_enabled:
                    student_phone = getattr(student, "phone_number", None)
                    if student_phone:
                        ok = send_sms(student_phone, sms_body)
                        if ok:
                            sent_channels.append("sms→student")

                    if teacher_phone:
                        ok = send_sms(teacher_phone, sms_body)
                        if ok:
                            sent_channels.append("sms→teacher")

                # ── Log the alert ─────────────────────────────────────────
                log = AlertLog(
                    student_id=student.id,
                    subject_id=config.subject_id,
                    message=alert_msg,
                    channel=",".join(sent_channels) if sent_channels else "logged"
                )
                db.add(log)
                db.commit()

                alerts_sent.append({
                    "student": student.full_name,
                    "percentage": round(percentage, 1),
                    "threshold": config.threshold_percentage,
                    "channels": sent_channels,
                })

    return {
        "alerts_checked": len(students),
        "alerts_sent": len(alerts_sent),
        "details": alerts_sent
    }


@router.get("/logs", response_model=List[AlertLogResponse])
def get_alert_logs(db: Session = Depends(get_db)):
    return db.query(AlertLog).all()