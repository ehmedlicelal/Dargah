"""
WATI WhatsApp Webhook
─────────────────────
Flow:
  1. Someone sends a WhatsApp message to your WATI number
  2. WATI POSTs to  POST /webhook/wati
  3. AI classifies the message (category, priority, summary)
  4. Complaint saved to Supabase → appears in /dashboard instantly
  5. Auto-reply sent back to the user via WATI API
"""

import logging
from typing import Any

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from supabase import Client

from core.config import settings
from core.supabase_client import get_supabase
from crud.complaints import create_complaint
from services.ai_service import classify_complaint

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhook", tags=["Webhook"])

# ── Human-readable labels (Azerbaijani) ───────────────────────────────────────

CATEGORY_AZ = {
    "road":        "Yol infrastrukturu",
    "utilities":   "Kommunal xidmətlər",
    "environment": "Ətraf mühit",
    "safety":      "Təhlükəsizlik",
    "social":      "Sosial xidmətlər",
    "other":       "Digər",
}

PRIORITY_AZ = {
    "low":      ("Aşağı",   "30 gün"),
    "medium":   ("Orta",    "14 gün"),
    "high":     ("Yüksək",  "7 gün"),
    "critical": ("Kritik",  "48 saat"),
}

PRIORITY_EMOJI = {
    "low": "🟢", "medium": "🔵", "high": "🟠", "critical": "🔴",
}

# ── WATI payload helpers ───────────────────────────────────────────────────────

def _extract_text(payload: dict) -> str | None:
    if payload.get("text"):
        return str(payload["text"]).strip()
    data = payload.get("data") or {}
    if isinstance(data, dict) and data.get("text"):
        return str(data["text"]).strip()
    if payload.get("type") == "button" and isinstance(data, dict) and data.get("title"):
        return str(data["title"]).strip()
    return None


def _extract_sender(payload: dict) -> dict:
    contact = payload.get("messageContact") or payload.get("contact") or {}
    name = (
        contact.get("name")
        or contact.get("fullName")
        or payload.get("senderName")
        or "WhatsApp İstifadəçisi"
    )
    phone = (
        contact.get("phone")
        or payload.get("waId")
        or payload.get("from")
        or ""
    )
    if phone and not phone.startswith("+"):
        phone = f"+{phone}"
    return {"name": str(name), "phone": str(phone)}


# ── WATI reply sender ──────────────────────────────────────────────────────────

async def _send_wati_reply(phone: str, message: str) -> None:
    """Send a WhatsApp reply via WATI's session message API."""
    api_url   = settings.WATI_API_URL.rstrip("/")
    # Strip "Bearer " prefix if the user pasted the full header value
    api_token = settings.WATI_API_TOKEN.removeprefix("Bearer ").strip()

    if not api_url or not api_token or api_token == "your_token_here":
        logger.warning("[WATI] Reply skipped — WATI_API_URL / WATI_API_TOKEN not configured in .env")
        return

    # WATI expects the phone without the leading +
    clean_phone = phone.lstrip("+")

    url = f"{api_url}/api/v1/sendSessionMessage/{clean_phone}"
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type":  "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # WATI requires messageText as a query param, not JSON body
            resp = await client.post(url, headers=headers, params={"messageText": message})
            if resp.status_code == 200:
                logger.info("[WATI] Reply sent to %s", phone)
            else:
                logger.warning("[WATI] Reply failed %s — %s", resp.status_code, resp.text[:200])
    except Exception as exc:
        logger.warning("[WATI] Reply error: %s", exc)


# ── Background task: AI classify → save → reply ───────────────────────────────

async def _process_message(text: str, sender: dict, supabase: Client) -> None:
    try:
        first_line = text.split("\n")[0][:80]
        title = first_line if first_line else text[:80]

        # AI classification
        ai = await classify_complaint(title, text)

        priority  = ai.get("priority", "medium")
        category  = ai.get("category", "other")
        summary   = ai.get("ai_summary") or ""

        # Save complaint
        complaint_data = {
            "title":           title,
            "description":     text,
            "status":          "open",
            "priority":        priority,
            "category":        category,
            "ai_summary":      summary,
            "submission_type": "WhatsApp",
            "citizen_name":    sender["name"],
            "citizen_phone":   sender["phone"],
            "source":          "whatsapp",
        }
        create_complaint(supabase, complaint_data)

        logger.info("[WATI] Saved — from=%s priority=%s category=%s", sender["phone"], priority, category)

        # Build reply
        priority_label, deadline = PRIORITY_AZ.get(priority, ("Orta", "14 gün"))
        category_label           = CATEGORY_AZ.get(category, "Digər")
        emoji                    = PRIORITY_EMOJI.get(priority, "🔵")

        reply = (
            f"✅ Müraciətiniz qəbul edildi, {sender['name']}!\n\n"
            f"🗂 Kateqoriya: {category_label}\n"
            f"{emoji} Prioritet: {priority_label}\n"
            f"⏱ Həll müddəti: {deadline}\n"
        )
        if summary:
            reply += f"\n📝 Qısa xülasə: {summary}\n"

        reply += (
            "\nNərimanov Rayon İcra Hakimiyyəti qısa müddətdə "
            "sizinlə əlaqə saxlayacaq. Müraciətiniz üçün təşəkkür edirik! 🙏"
        )

        await _send_wati_reply(sender["phone"], reply)

    except Exception as exc:
        logger.exception("[WATI] Processing failed: %s", exc)


# ── Webhook endpoint ───────────────────────────────────────────────────────────

@router.post("/wati")
async def wati_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    supabase: Client = Depends(get_supabase),
):
    try:
        payload: dict[str, Any] = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    logger.debug("[WATI] Payload: %s", payload)

    # Ignore outbound messages and status events
    if payload.get("owner") or payload.get("eventType") not in ("message", "", None):
        return {"received": True, "processed": False, "reason": "not_inbound"}

    text   = _extract_text(payload)
    sender = _extract_sender(payload)

    if not text:
        return {"received": True, "processed": False, "reason": "no_text"}

    background_tasks.add_task(_process_message, text, sender, supabase)
    logger.info("[WATI] Queued from %s: %.60s…", sender["phone"], text)
    return {"received": True, "processed": True}


@router.get("/wati")
async def wati_verify():
    return {"status": "ok", "service": "Nərimanov Digital WATI Webhook"}


@router.post("/wati/test-reply")
async def test_reply(supabase: Client = Depends(get_supabase)):
    """Dev-only: runs the full pipeline synchronously so errors are visible."""
    sender = {"name": "Test", "phone": "994504000599"}
    text   = "Yolda cala var, kömək edin"
    await _process_message(text, sender, supabase)
    return {"done": True}
