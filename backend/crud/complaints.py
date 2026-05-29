from uuid import UUID
from supabase import Client


def get_complaints(
    supabase: Client,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list:
    query = (
        supabase.table("complaints")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .offset(offset)
    )
    if status:
        query = query.eq("status", status)
    return query.execute().data


def get_complaint_by_id(supabase: Client, complaint_id: UUID) -> dict | None:
    result = (
        supabase.table("complaints")
        .select("*")
        .eq("id", str(complaint_id))
        .single()
        .execute()
    )
    return result.data


def create_complaint(supabase: Client, data: dict) -> dict:
    return supabase.table("complaints").insert(data).execute().data[0]


def update_complaint(supabase: Client, complaint_id: UUID, data: dict) -> dict | None:
    result = (
        supabase.table("complaints")
        .update(data)
        .eq("id", str(complaint_id))
        .execute()
    )
    return result.data[0] if result.data else None


def delete_complaint(supabase: Client, complaint_id: UUID) -> bool:
    result = (
        supabase.table("complaints")
        .delete()
        .eq("id", str(complaint_id))
        .execute()
    )
    return bool(result.data)
