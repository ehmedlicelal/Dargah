from datetime import datetime
from uuid import UUID
from typing import Literal
from pydantic import BaseModel, field_validator

PriorityLevel = Literal["low", "medium", "high", "critical"]


class ComplaintCreate(BaseModel):
    zone_id: UUID | None = None
    title: str
    description: str
    priority: PriorityLevel | None = None
    lat: float | None = None
    lng: float | None = None
    submission_type: str | None = "Şikayət"
    citizen_name:   str | None = None
    citizen_father: str | None = None
    citizen_phone:  str | None = None
    deadline: datetime | None = None

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
    submission_type: str | None = None
    citizen_name:   str | None = None
    citizen_father: str | None = None
    citizen_phone:  str | None = None
    report_content: str | None = None
    deadline: datetime | None = None
    assigned_service_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ComplaintUpdate(BaseModel):
    status: str | None = None
    priority: str | None = None
    category: str | None = None
    report_content: str | None = None
    deadline: datetime | None = None
    assigned_service_id: UUID | None = None
