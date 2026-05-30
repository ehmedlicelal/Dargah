from fastapi import APIRouter, Depends
from supabase import Client
from core.supabase_client import get_supabase

router = APIRouter(prefix="/services", tags=["Services"])


@router.get("/")
def list_services(supabase: Client = Depends(get_supabase)):
    return (
        supabase.table("services")
        .select("*")
        .eq("is_active", True)
        .order("name_az")
        .execute()
        .data or []
    )
