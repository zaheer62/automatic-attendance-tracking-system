"""
notifications.py  –  /notifications router
Handles student notification preferences, email alerts (SMTP), and SMS alerts (Twilio).

Dependencies (add to requirements.txt):
    twilio>=8.0.0
    python-dotenv           # already likely present

Environment variables required (.env):
    # Email (SMTP — works with Gmail, SendGrid, etc.)
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_USER=your@gmail.com
    SMTP_PASS=your_app_password
    MAIL_FROM=your@gmail.com

    # SMS (Twilio)
    TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    TWILIO_AUTH_TOKEN=your_auth_token
    TWILIO_FROM_NUMBER=+1xxxxxxxxxx
"""

from __future__ import annotations

import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

# ── adjust these imports to match your project layout ──────────────────────────
from app.database import get_db
from app.models import NotificationPrefs as NotificationPrefsModel   # see model below

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications", tags=["notifications"])


# ─── Pydantic schemas ──────────────────────────────────────────────────────────

class NotificationPrefsSchema(BaseModel):
    email_enabled: bool = False
    email_address: str = ""
    email_threshold: int = 75
    notify_on_absent: bool = True
    notify_weekly_summary: bool = False
    sms_enabled: bool = False
    sms_number: str = ""
    sms_threshold: int = 75
    sms_on_absent: bool = True

    class Config:
        from_attributes = True


class TestEmailRequest(BaseModel):
    email: str


class TestSmsRequest(BaseModel):
    phone: str


# ─── DB helpers ───────────────────────────────────────────────────────────────

def get_or_create_prefs(student_id: int, db: Session) -> NotificationPrefsModel:
    prefs = db.query(NotificationPrefsModel).filter_by(student_id=student_id).first()
    if not prefs:
        prefs = NotificationPrefsModel(student_id=student_id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    return prefs


# ─── Email helper ─────────────────────────────────────────────────────────────

def send_email(to: str, subject: str, html_body: str) -> None:
    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", 587))
    user = os.getenv("SMTP_USER", "")
    password = os.getenv("SMTP_PASS", "")
    from_addr = os.getenv("MAIL_FROM", user)

    if not user or not password:
        raise RuntimeError("SMTP credentials not configured in environment")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(host, port) as server:
        server.ehlo()
        server.starttls()
        server.login(user, password)
        server.sendmail(from_addr, to, msg.as_string())


def build_test_email_html(student_id: int) -> str:
    return f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;">
      <h2 style="color:#1e40af;">🔔 Attendance Alerts Active</h2>
      <p>Hi there! This is a test notification from the <strong>Attendance System</strong>.</p>
      <p>Your email alerts are configured correctly for student ID <strong>{student_id}</strong>.
         You will receive alerts when your attendance drops below your set threshold.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
      <p style="color:#94a3b8;font-size:12px;">
        You can manage your notification preferences from the Student Dashboard.
      </p>
    </div>
    """


def build_absence_email_html(student_name: str, subject_name: str, date: str, pct: float) -> str:
    color = "#dc2626" if pct < 75 else "#d97706"
    return f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;">
      <h2 style="color:#1e40af;">⚠️ Absence Recorded</h2>
      <p>Hi <strong>{student_name}</strong>,</p>
      <p>You were marked <strong>absent</strong> in <strong>{subject_name}</strong> on {date}.</p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="margin:0;color:{color};font-weight:700;">
          Current attendance: {pct:.1f}%
          {"— Below the 75% requirement!" if pct < 75 else ""}
        </p>
      </div>
      <p>Log in to the student portal to view your full attendance history.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
      <p style="color:#94a3b8;font-size:12px;">
        To stop these alerts, update your Notification Preferences in the Student Dashboard.
      </p>
    </div>
    """


# ─── SMS helper ───────────────────────────────────────────────────────────────

def send_sms(to: str, body: str) -> None:
    try:
        from twilio.rest import Client  # type: ignore
    except ImportError:
        raise RuntimeError("twilio package not installed — run: pip install twilio")

    sid = os.getenv("TWILIO_ACCOUNT_SID", "")
    token = os.getenv("TWILIO_AUTH_TOKEN", "")
    from_number = os.getenv("TWILIO_FROM_NUMBER", "")

    if not sid or not token or not from_number:
        raise RuntimeError("Twilio credentials not configured in environment")

    client = Client(sid, token)
    client.messages.create(body=body, from_=from_number, to=to)


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/prefs/{student_id}", response_model=NotificationPrefsSchema)
def get_prefs(student_id: int, db: Session = Depends(get_db)):
    return get_or_create_prefs(student_id, db)


@router.post("/prefs/{student_id}", response_model=NotificationPrefsSchema)
def save_prefs(
    student_id: int,
    body: NotificationPrefsSchema,
    db: Session = Depends(get_db),
):
    prefs = get_or_create_prefs(student_id, db)
    for field, value in body.dict().items():
        setattr(prefs, field, value)
    db.commit()
    db.refresh(prefs)
    return prefs


@router.post("/test-email/{student_id}")
def test_email(student_id: int, body: TestEmailRequest, db: Session = Depends(get_db)):
    try:
        send_email(
            to=body.email,
            subject="✅ Attendance Alert Test",
            html_body=build_test_email_html(student_id),
        )
        return {"status": "sent"}
    except Exception as e:
        logger.error("test_email failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test-sms/{student_id}")
def test_sms(student_id: int, body: TestSmsRequest, db: Session = Depends(get_db)):
    try:
        send_sms(
            to=body.phone,
            body="✅ Attendance System: Your SMS alerts are configured correctly!",
        )
        return {"status": "sent"}
    except Exception as e:
        logger.error("test_sms failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ─── Trigger functions (call these from your attendance recording logic) ───────

def trigger_absence_notifications(
    student_id: int,
    student_name: str,
    subject_name: str,
    date: str,
    current_pct: float,
    db: Session,
) -> None:
    """
    Call this whenever a student is marked absent.
    It checks their prefs and fires email / SMS as configured.
    """
    prefs = db.query(NotificationPrefsModel).filter_by(student_id=student_id).first()
    if not prefs:
        return

    # ── Email ──────────────────────────────────────────────────────────────────
    if (
        prefs.email_enabled
        and prefs.notify_on_absent
        and prefs.email_address
        and current_pct < prefs.email_threshold
    ):
        try:
            send_email(
                to=prefs.email_address,
                subject=f"⚠️ Absence Alert – {subject_name}",
                html_body=build_absence_email_html(student_name, subject_name, date, current_pct),
            )
        except Exception as e:
            logger.error("absence email failed for student %s: %s", student_id, e)

    # ── SMS ────────────────────────────────────────────────────────────────────
    if (
        prefs.sms_enabled
        and prefs.sms_on_absent
        and prefs.sms_number
        and current_pct < prefs.sms_threshold
    ):
        try:
            send_sms(
                to=prefs.sms_number,
                body=(
                    f"Attendance Alert: You were absent in {subject_name} on {date}. "
                    f"Current attendance: {current_pct:.1f}%"
                    + (" — below 75%!" if current_pct < 75 else "")
                ),
            )
        except Exception as e:
            logger.error("absence SMS failed for student %s: %s", student_id, e)
