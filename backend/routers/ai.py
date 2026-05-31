from fastapi import APIRouter, Depends
from pydantic import BaseModel
from supabase import Client
from core.supabase_client import get_supabase
from core.auth import require_auth
from services import ai_service

router = APIRouter(prefix="/ai", tags=["AI"])


class AnalyzeRequest(BaseModel):
    title: str
    description: str
    image_url: str | None = None


class SuggestServiceRequest(BaseModel):
    title: str
    description: str
    category: str | None = None


@router.post("/analyze")
async def analyze_complaint(body: AnalyzeRequest, _: dict = Depends(require_auth)):
    result = await ai_service.analyze_complaint_with_image(
        body.title,
        body.description,
        body.image_url,
    )
    return result


@router.post("/suggest-service")
async def suggest_service(
    body: SuggestServiceRequest,
    supabase: Client = Depends(get_supabase),
    _: dict = Depends(require_auth),
):
    services = supabase.table("services").select("id, name, name_az, category").eq("is_active", True).execute().data
    return await ai_service.suggest_service(
        body.title,
        body.description,
        body.category,
        services,
    )
