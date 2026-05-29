from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from core.supabase_client import get_supabase
from crud import district as crud
from crud import monitoring as monitoring_crud
from schemas.district import DistrictZoneRead

router = APIRouter(prefix="/district-map", tags=["District Map"])


@router.get("/zones", response_model=list[DistrictZoneRead])
def get_zones(supabase: Client = Depends(get_supabase)):
    return crud.get_zones(supabase)


@router.get("/zones/{zone_id}")
def get_zone_detail(
    zone_id: UUID,
    supabase: Client = Depends(get_supabase),
):
    zone = crud.get_zone_by_id(supabase, zone_id)
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zona tapılmadı")

    # Attach latest monitoring summary for this zone
    latest_air = monitoring_crud.get_air_quality(supabase, zone_id, limit=1)
    latest_traffic = monitoring_crud.get_traffic(supabase, zone_id, limit=1)

    return {
        **zone,
        "latest_air_quality": latest_air[0] if latest_air else None,
        "latest_traffic": latest_traffic[0] if latest_traffic else None,
    }
