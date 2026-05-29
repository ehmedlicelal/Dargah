from uuid import UUID
from fastapi import APIRouter, Depends
from supabase import Client
from core.supabase_client import get_supabase
from crud import monitoring as crud
from schemas.monitoring import MonitoringDataRead

router = APIRouter(prefix="/monitoring", tags=["Monitoring"])


@router.get("/air-quality", response_model=list[MonitoringDataRead])
def get_air_quality(
    zone_id: UUID | None = None,
    limit: int = 50,
    supabase: Client = Depends(get_supabase),
):
    # TODO: connect real sensor API here
    return crud.get_air_quality(supabase, zone_id, limit)


@router.get("/traffic", response_model=list[MonitoringDataRead])
def get_traffic(
    zone_id: UUID | None = None,
    limit: int = 50,
    supabase: Client = Depends(get_supabase),
):
    # TODO: connect real traffic API here
    return crud.get_traffic(supabase, zone_id, limit)


@router.get("/utilities", response_model=list[MonitoringDataRead])
def get_utilities(
    zone_id: UUID | None = None,
    limit: int = 50,
    supabase: Client = Depends(get_supabase),
):
    # TODO: connect real utilities sensor API here
    return crud.get_utilities(supabase, zone_id, limit)


@router.get("/incidents", response_model=list[MonitoringDataRead])
def get_incidents(
    zone_id: UUID | None = None,
    limit: int = 50,
    supabase: Client = Depends(get_supabase),
):
    return crud.get_incidents(supabase, zone_id, limit)
