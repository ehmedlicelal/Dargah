from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from core.supabase_client import get_supabase
from crud import complaints as crud
from schemas.complaints import ComplaintCreate, ComplaintRead, ComplaintUpdate
from services import ai_service

router = APIRouter(prefix="/complaints", tags=["Complaints"])


@router.get("/", response_model=list[ComplaintRead])
def list_complaints(
    complaint_status: str | None = None,
    limit: int = 50,
    offset: int = 0,
    supabase: Client = Depends(get_supabase),
):
    return crud.get_complaints(supabase, complaint_status, limit, offset)


@router.get("/{complaint_id}", response_model=ComplaintRead)
def get_complaint(
    complaint_id: UUID,
    supabase: Client = Depends(get_supabase),
):
    complaint = crud.get_complaint_by_id(supabase, complaint_id)
    if not complaint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Şikayət tapılmadı")
    return complaint


@router.post("/", response_model=ComplaintRead, status_code=status.HTTP_201_CREATED)
async def create_complaint(
    body: ComplaintCreate,
    supabase: Client = Depends(get_supabase),
):
    # TODO: extract user_id from Authorization header / Supabase session
    insert_data = body.model_dump(exclude_none=True)
    if insert_data.get("zone_id"):
        insert_data["zone_id"] = str(insert_data["zone_id"])

    created = crud.create_complaint(supabase, insert_data)

    # AI classification — degrades gracefully on failure
    ai_result = await ai_service.classify_complaint(body.title, body.description)
    update_payload = {
        "category": ai_result["category"],
        "priority": ai_result["priority"],
    }
    if ai_result.get("ai_summary"):
        update_payload["ai_summary"] = ai_result["ai_summary"]

    enriched = crud.update_complaint(supabase, created["id"], update_payload)
    return enriched or created


@router.patch("/{complaint_id}", response_model=ComplaintRead)
def update_complaint(
    complaint_id: UUID,
    body: ComplaintUpdate,
    supabase: Client = Depends(get_supabase),
):
    # TODO: add role check — only operator/admin can update
    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Yeniləmə məlumatı boşdur")
    updated = crud.update_complaint(supabase, complaint_id, update_data)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Şikayət tapılmadı")
    return updated


@router.delete("/{complaint_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_complaint(
    complaint_id: UUID,
    supabase: Client = Depends(get_supabase),
):
    # TODO: add role check — only admin can delete
    deleted = crud.delete_complaint(supabase, complaint_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Şikayət tapılmadı")
