"""
notifications.py  –  /notifications router
Handles student notification preferences, email alerts (SMTP), and SMS alerts (Twilio).
"""
 
from __future__ import annotations
 
import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional
 
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
 
from app.core.database import get_db
from app.models.notification_prefs import NotificationPrefs as NotificationPrefsModel
 
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
    host      = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port      = int(os.getenv("SMTP_PORT", 587))
    user      = os.getenv("SMTP_USER", "")
    password  = os.getenv("SMTP_PASS", "")
    from_addr = os.getenv("MAIL_FROM", user)
 
    if not user or not password:
        raise RuntimeError("SMTP credentials not configured in environment")
 
    if user == "your@gmail.com" or password == "your_app_password":
        raise RuntimeError("SMTP credentials are still placeholders — update your .env file")
 
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = from_addr
    msg["To"]      = to
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
 
 
# ─── SMS helper (Twilio) ──────────────────────────────────────────────────────
 
def clean_phone(number: str) -> str:
    """Normalize to E.164 format — strip spaces, ensure + prefix."""
    number = number.strip().replace(" ", "").replace("-", "")
    if not number.startswith("+"):
        # Assume Indian number if no country code
        if len(number) == 10 and number.isdigit():
            number = "+91" + number
        elif number.startswith("91") and len(number) == 12:
            number = "+" + number
        else:
            number = "+" + number
    return number
 
 
def send_sms(to: str, body: str) -> None:
    account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
    auth_token  = os.getenv("TWILIO_AUTH_TOKEN", "")
    from_number = os.getenv("TWILIO_FROM_NUMBER", "")
 
    if not account_sid or not auth_token:
        raise RuntimeError("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not configured in .env")
 
    if not from_number:
        raise RuntimeError("TWILIO_FROM_NUMBER not configured in .env")
 
    to_clean = clean_phone(to)
    logger.info("[SMS] Sending to %s via Twilio", to_clean)
 
    try:
        client  = Client(account_sid, auth_token)
        message = client.messages.create(
            body=body,
            from_=from_number,
            to=to_clean,
        )
        logger.info("[SMS] Sent OK — SID: %s  status: %s", message.sid, message.status)
 
    except TwilioRestException as e:
        logger.error("[SMS] Twilio error %s: %s", e.code, e.msg)
        raise RuntimeError(f"Twilio error {e.code}: {e.msg}")
 
 
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
            body="Attendance Alert: Your attendance is being tracked. You will be notified when it drops below 75%.",
        )
        return {"status": "sent"}
    except Exception as e:
        logger.error("test_sms failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
 
 
# ─── Trigger functions ────────────────────────────────────────────────────────
 
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
    Checks their prefs and fires email / SMS as configured.
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
                subject=f"Absence Alert – {subject_name}",
                html_body=build_absence_email_html(student_name, subject_name, date, current_pct),
            )
            logger.info("[Email] Absence alert sent to %s", prefs.email_address)
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
                    f"Attendance Alert: {student_name} was absent in {subject_name} on {date}. "
                    f"Current attendance: {current_pct:.1f}%"
                    + (" - below 75%!" if current_pct < 75 else "")
                ),
            )
            logger.info("[SMS] Absence alert sent to %s", prefs.sms_number)
        except Exception as e:
            logger.error("absence SMS failed for student %s: %s", student_id, e)