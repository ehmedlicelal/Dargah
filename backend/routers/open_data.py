from fastapi import APIRouter, Depends
from supabase import Client
from core.supabase_client import get_supabase
from crud import monitoring as monitoring_crud
from services import ai_service

router = APIRouter(prefix="/open-data", tags=["Open Data"])


@router.get("/")
def list_reports(supabase: Client = Depends(get_supabase)):
    return supabase.table("open_data_reports").select("*").order("published_at", desc=True).execute().data


@router.get("/summary")
async def get_ai_summary(supabase: Client = Depends(get_supabase)):
    # Collect recent monitoring data across all types for the summary
    rows = (
        supabase.table("monitoring_data")
        .select("type, value, recorded_at, zone_id")
        .order("recorded_at", desc=True)
        .limit(20)
        .execute()
        .data
    )
    summary = await ai_service.summarize_report(rows)
    return {"summary": summary, "data_points": len(rows)}
