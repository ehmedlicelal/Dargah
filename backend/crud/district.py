from uuid import UUID
from supabase import Client


def get_zones(supabase: Client) -> list:
    return supabase.table("district_zones").select("*").execute().data


def get_zone_by_id(supabase: Client, zone_id: UUID) -> dict | None:
    result = (
        supabase.table("district_zones")
        .select("*")
        .eq("id", str(zone_id))
        .single()
        .execute()
    )
    return result.data
