from pydantic import BaseModel
from typing import Optional

class SubjectCreate(BaseModel):
    name: str
    code: str
    teacher_id: Optional[int] = None

class SubjectResponse(BaseModel):
    id: int
    name: str
    code: str
    teacher_id: Optional[int] = None
    is_active: bool = True

    class Config:
        from_attributes = True