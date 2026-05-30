from fastapi import APIRouter
from pydantic import BaseModel
from services import ai_service

router = APIRouter(prefix="/ai", tags=["AI"])


class AnalyzeRequest(BaseModel):
    title: str
    description: str
    image_url: str | None = None


@router.post("/analyze")
async def analyze_complaint(body: AnalyzeRequest):
    result = await ai_service.analyze_complaint_with_image(
        body.title,
        body.description,
        body.image_url,
    )
    return result
