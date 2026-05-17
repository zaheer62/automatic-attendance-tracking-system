from sqlalchemy import Column, Integer, String, Boolean
from app.core.database import Base

class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=False)
    teacher_id = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)