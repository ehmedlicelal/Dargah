from uuid import UUID
from supabase import Client


def get_air_quality(supabase: Client, zone_id: UUID | None = None, limit: int = 50) -> list:
    query = (
        supabase.table("monitoring_data")
        .select("*")
        .eq("type", "air_quality")
        .order("recorded_at", desc=True)
        .limit(limit)
    )
    if zone_id:
        query = query.eq("zone_id", str(zone_id))
    return query.execute().data


def get_traffic(supabase: Client, zone_id: UUID | None = None, limit: int = 50) -> list:
    query = (
        supabase.table("monitoring_data")
        .select("*")
        .eq("type", "traffic")
        .order("recorded_at", desc=True)
        .limit(limit)
    )
    if zone_id:
        query = query.eq("zone_id", str(zone_id))
    return query.execute().data


def get_utilities(supabase: Client, zone_id: UUID | None = None, limit: int = 50) -> list:
    query = (
        supabase.table("monitoring_data")
        .select("*")
        .eq("type", "utilities")
        .order("recorded_at", desc=True)
        .limit(limit)
    )
    if zone_id:
        query = query.eq("zone_id", str(zone_id))
    return query.execute().data


def get_incidents(supabase: Client, zone_id: UUID | None = None, limit: int = 50) -> list:
    query = (
        supabase.table("monitoring_data")
        .select("*")
        .eq("type", "incident")
        .order("recorded_at", desc=True)
        .limit(limit)
    )
    if zone_id:
        query = query.eq("zone_id", str(zone_id))
    return query.execute().data


def create_monitoring_entry(supabase: Client, data: dict) -> dict:
    return supabase.table("monitoring_data").insert(data).execute().data[0]
