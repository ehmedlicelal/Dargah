from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from services import ai_service

router = APIRouter(prefix="/reports", tags=["Reports"])


class ReportRequest(BaseModel):
    submission_type: str        # Ərizə / Şikayət / Təklif
    citizen_text: str
    full_name: Optional[str] = ""
    father_name: Optional[str] = ""
    address: Optional[str] = ""
    phone: Optional[str] = ""
    image_url: Optional[str] = None   # base64 data URL or public URL


@router.post("/generate")
async def generate_report(body: ReportRequest):
    report = await ai_service.generate_official_report(
        submission_type=body.submission_type,
        citizen_text=body.citizen_text,
        full_name=body.full_name or "",
        father_name=body.father_name or "",
        address=body.address or "",
        phone=body.phone or "",
        image_url=body.image_url,
    )
    return {"report": report}
