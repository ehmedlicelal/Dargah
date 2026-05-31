from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from core.auth import require_auth
from services import ai_service

router = APIRouter(prefix="/reports", tags=["Reports"])


class ReportRequest(BaseModel):
    submission_type: str
    citizen_text: str
    full_name: Optional[str] = ""
    father_name: Optional[str] = ""
    address: Optional[str] = ""
    phone: Optional[str] = ""
    priority: Optional[str] = None
    zone_name: Optional[str] = None
    image_url: Optional[str] = None


@router.post("/generate")
async def generate_report(body: ReportRequest, _: dict = Depends(require_auth)):
    report = await ai_service.generate_official_report(
        submission_type=body.submission_type,
        citizen_text=body.citizen_text,
        full_name=body.full_name or "",
        father_name=body.father_name or "",
        address=body.address or "",
        phone=body.phone or "",
        priority=body.priority,
        zone_name=body.zone_name,
        image_url=body.image_url,
    )
    return {"report": report}
