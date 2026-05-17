"""
backend/app/services/alert_engine.py
Monitors attendance thresholds and fires email / SMS alerts.
 
Sends alerts to:
  1. TEACHER — the email_address stored in the alert_configs rule
  2. STUDENT — their own registered email automatically
"""
 
import os
import logging
from datetime import datetime, date
 
from sqlalchemy.orm import Session
from sqlalchemy import text
 
logger = logging.getLogger(__name__)
 
# ── optional deps (graceful fallback if not installed) ────────────────────────
try:
    import emails as emaillib
    _EMAIL_AVAILABLE = True
except ImportError:
    _EMAIL_AVAILABLE = False
    logger.warning("'emails' package not installed — email alerts disabled")
 
try:
    from twilio.rest import Client as TwilioClient
    _SMS_AVAILABLE = True
except ImportError:
    _SMS_AVAILABLE = False
    logger.warning("'twilio' package not installed — SMS alerts disabled")
 
 
# ── email sender ──────────────────────────────────────────────────────────────
 
def _send_email(to: str, subject: str, body: str) -> bool:
    if not _EMAIL_AVAILABLE:
        logger.info("Email (skipped — not installed): %s → %s", subject, to)
        return False
    try:
        msg = emaillib.Message(
            subject=subject,
            html=f"<pre style='font-family:sans-serif'>{body}</pre>",
            mail_from=os.getenv("ALERT_FROM", "attendance@system.edu"),
        )
        resp = msg.send(
            to=to,
            smtp={
                "host": os.getenv("SMTP_HOST", "smtp.gmail.com"),
                "port": int(os.getenv("SMTP_PORT", 587)),
                "user": os.getenv("SMTP_USER", ""),
                "password": os.getenv("SMTP_PASSWORD", ""),
                "tls": True,
            },
        )
        ok = resp.status_code == 250
        if ok:
            logger.info("Email sent to %s: %s", to, subject)
        else:
            logger.error("Email failed (%s) to %s", resp.status_code, to)
        return ok
    except Exception as exc:
        logger.error("Email error: %s", exc)
        return False
 
 
# ── SMS sender ────────────────────────────────────────────────────────────────
 
def _send_sms(to: str, body: str) -> bool:
    if not _SMS_AVAILABLE:
        logger.info("SMS (skipped — not installed): %s", body[:60])
        return False
    try:
        client = TwilioClient(
            os.getenv("TWILIO_ACCOUNT_SID"),
            os.getenv("TWILIO_AUTH_TOKEN"),
        )
        msg = client.messages.create(
            body=body,
            from_=os.getenv("TWILIO_FROM"),
            to=to,
        )
        logger.info("SMS sent to %s: sid=%s", to, msg.sid)
        return True
    except Exception as exc:
        logger.error("SMS error: %s", exc)
        return False
 
 
# ── message builders ──────────────────────────────────────────────────────────
 
def _teacher_email_body(student_name: str, subject_name: str, pct: float, threshold: float, today: str) -> str:
    return (
        f"⚠️  Low Attendance Alert — Teacher Notification\n"
        f"{'─' * 45}\n\n"
        f"Student  : {student_name}\n"
        f"Subject  : {subject_name}\n"
        f"Current  : {pct}%\n"
        f"Required : {threshold}%\n"
        f"Shortfall: {round(threshold - pct, 1)}%\n"
        f"Date     : {today}\n\n"
        f"Please follow up with this student regarding their attendance.\n"
        f"This is an automated message from the Attendance System."
    )
 
 
def _student_email_body(student_name: str, subject_name: str, pct: float, threshold: float, today: str) -> str:
    return (
        f"⚠️  Low Attendance Warning — Action Required\n"
        f"{'─' * 45}\n\n"
        f"Dear {student_name},\n\n"
        f"Your attendance in {subject_name} has fallen below the required threshold.\n\n"
        f"Subject      : {subject_name}\n"
        f"Your attendance : {pct}%\n"
        f"Required     : {threshold}%\n"
        f"Shortfall    : {round(threshold - pct, 1)}%\n"
        f"Date         : {today}\n\n"
        f"Please ensure you attend upcoming classes regularly to avoid any\n"
        f"academic consequences.\n\n"
        f"If you have any concerns, please contact your teacher immediately.\n\n"
        f"— Attendance Management System"
    )
 
 
def _sms_body(student_name: str, subject_name: str, pct: float, threshold: float) -> str:
    return (
        f"[Attendance Alert] {student_name} has {pct}% attendance in "
        f"{subject_name} (required: {threshold}%). Please take action."
    )
 
 
# ── core check ────────────────────────────────────────────────────────────────
 
def check_and_alert(db: Session) -> int:
    """
    Pull all active alert configs, compute each student's attendance %
    per subject, and fire notifications for anyone below threshold.
 
    Alerts are sent to:
      - Teacher: email_address field in the alert_configs rule
      - Student: their own registered email in the users table
 
    Returns the number of alerts fired.
    """
    fired = 0
    today = date.today().isoformat()
 
    # Fetch active alert configs
    try:
        rules = db.execute(text("""
            SELECT
                ac.id,
                ac.subject_id,
                ac.threshold_percentage  AS threshold,
                ac.email_enabled         AS notify_email,
                ac.sms_enabled           AS notify_sms,
                ac.email_address         AS teacher_email,
                ac.phone_number          AS teacher_phone,
                s.name                   AS subject_name
            FROM alert_configs ac
            JOIN subjects s ON s.id = ac.subject_id
            WHERE ac.subject_id IS NOT NULL
        """)).fetchall()
    except Exception as exc:
        logger.error("Failed to fetch alert configs: %s", exc)
        return 0
 
    if not rules:
        logger.info("No active alert configs found.")
        return 0
 
    # Fetch all students
    try:
        students = db.execute(text(
            "SELECT id, full_name, email FROM users WHERE role = 'student'"
        )).fetchall()
    except Exception as exc:
        logger.error("Failed to fetch students: %s", exc)
        return 0
 
    for rule in rules:
        for student in students:
            try:
                # Compute attendance % for this student in this subject
                row = db.execute(text("""
                    SELECT
                        COUNT(*) FILTER (WHERE ar.is_present = true) AS present,
                        COUNT(*) AS total
                    FROM attendance_records ar
                    JOIN attendance_sessions sess ON sess.id = ar.session_id
                    WHERE ar.student_id = :sid
                      AND sess.subject_id = :subj
                """), {"sid": student.id, "subj": rule.subject_id}).fetchone()
 
                if not row or row.total == 0:
                    continue
 
                pct = round(row.present * 100 / row.total, 1)
 
                if pct < rule.threshold:
                    subject_line = (
                        f"Low Attendance: {student.full_name} — "
                        f"{rule.subject_name} ({pct}%)"
                    )
 
                    # ── 1. Notify TEACHER ─────────────────────────────────
                    if rule.notify_email and rule.teacher_email:
                        teacher_body = _teacher_email_body(
                            student.full_name, rule.subject_name,
                            pct, rule.threshold, today
                        )
                        _send_email(rule.teacher_email, subject_line, teacher_body)
                        fired += 1
                        logger.info(
                            "Teacher alert sent → %s for student=%s subject=%s pct=%.1f",
                            rule.teacher_email, student.id, rule.subject_id, pct
                        )
 
                    if rule.notify_sms and rule.teacher_phone:
                        sms_body = _sms_body(
                            student.full_name, rule.subject_name,
                            pct, rule.threshold
                        )
                        _send_sms(rule.teacher_phone, sms_body)
                        fired += 1
 
                    # ── 2. Notify STUDENT (always, if they have an email) ─
                    if rule.notify_email and student.email:
                        student_body = _student_email_body(
                            student.full_name, rule.subject_name,
                            pct, rule.threshold, today
                        )
                        student_subject = (
                            f"⚠️ Your attendance in {rule.subject_name} is {pct}% "
                            f"— action required"
                        )
                        _send_email(student.email, student_subject, student_body)
                        fired += 1
                        logger.info(
                            "Student alert sent → %s subject=%s pct=%.1f",
                            student.email, rule.subject_id, pct
                        )
 
            except Exception as exc:
                logger.error(
                    "Alert check error student=%s rule=%s: %s",
                    student.id, rule.id, exc
                )
 
    return fired
 
 
# ── scheduler setup ───────────────────────────────────────────────────────────
 
def start_alert_scheduler(get_db_func) -> None:
    """
    Starts APScheduler to run check_and_alert() every hour.
 
    Usage in main.py:
        from app.services.alert_engine import start_alert_scheduler
        from app.core.database import get_db
 
        @app.on_event("startup")
        def startup():
            start_alert_scheduler(get_db)
    """
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
    except ImportError:
        logger.warning("apscheduler not installed — alert scheduler disabled.")
        return
 
    def _job():
        db_gen = get_db_func()
        db = next(db_gen)
        try:
            n = check_and_alert(db)
            logger.info("Alert job complete — %d alert(s) fired", n)
        finally:
            try:
                next(db_gen)
            except StopIteration:
                pass
 
    scheduler = BackgroundScheduler()
    scheduler.add_job(_job, "interval", hours=1, next_run_time=datetime.now())
    scheduler.start()
    logger.info("Alert scheduler started — running every 1 hour")
 