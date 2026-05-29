from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, field_validator


class ComplaintCreate(BaseModel):
    zone_id: UUID | None = None
    title: str
    description: str
    lat: float | None = None
    lng: float | None = None

    @field_validator("title", "description")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Bu sahə boş ola bilməz")
        return v.strip()


class ComplaintRead(BaseModel):
    id: UUID
    user_id: UUID | None = None
    zone_id: UUID | None = None
    title: str
    description: str
    category: str | None = None
    priority: str
    status: str
    ai_summary: str | None = None
    attachments: list[str] | None = None
    lat: float | None = None
    lng: float | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ComplaintUpdate(BaseModel):
    status: str | None = None
    priority: str | None = None
    category: str | None = None
