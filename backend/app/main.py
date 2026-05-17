from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.routers import auth, subjects, attendance, face, alerts, reports, privacy, sync, admin_stats, users
from app.services.alert_engine import start_alert_scheduler
from app.core.database import get_db
import app.models

app = FastAPI(title="Attendance Tracking System", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001","http://localhost:3002",],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)
app.include_router(users.router)
app.include_router(auth.router)
app.include_router(subjects.router)
app.include_router(attendance.router)
app.include_router(face.router)
app.include_router(alerts.router)
app.include_router(reports.router)
app.include_router(privacy.router)
app.include_router(sync.router)
app.include_router(admin_stats.router)

@app.on_event("startup")
def startup():
    start_alert_scheduler(get_db)

@app.get("/")
def root():
    return {"message": "Attendance System API is running"}

@app.get("/health")
def health():
    return {"status": "ok"}