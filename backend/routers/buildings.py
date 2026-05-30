from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from supabase import Client
from core.supabase_client import get_supabase

router = APIRouter(prefix="/buildings", tags=["Buildings"])


class NamedBuildingUpsert(BaseModel):
    feature_id: str          # stable Mapbox/OSM feature id
    name: str
    lat: Optional[float] = None
    lng: Optional[float] = None


@router.get("/named")
def list_named_buildings(supabase: Client = Depends(get_supabase)):
    return supabase.table("named_buildings").select("*").order("created_at", desc=True).execute().data


@router.get("/named/{feature_id}")
def get_named_building(feature_id: str, supabase: Client = Depends(get_supabase)):
    result = supabase.table("named_buildings").select("*").eq("feature_id", feature_id).execute()
    return result.data[0] if result.data else None


@router.post("/named", status_code=status.HTTP_201_CREATED)
def upsert_named_building(body: NamedBuildingUpsert, supabase: Client = Depends(get_supabase)):
    result = supabase.table("named_buildings").upsert(
        {"feature_id": body.feature_id, "name": body.name, "lat": body.lat, "lng": body.lng},
        on_conflict="feature_id",
    ).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Saxlama uğursuz oldu")
    return result.data[0]


@router.delete("/named/{feature_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_named_building(feature_id: str, supabase: Client = Depends(get_supabase)):
    supabase.table("named_buildings").delete().eq("feature_id", feature_id).execute()
