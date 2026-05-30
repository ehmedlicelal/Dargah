import logging
import httpx
from .config import settings

logger = logging.getLogger(__name__)


async def openrouter_chat(messages: list[dict], model: str | None = None) -> dict | None:
    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": settings.FRONTEND_URL,
        "X-Title": "Narimanov Digital",
    }
    payload = {
        "model": model or settings.OPENROUTER_MODEL,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 1024,
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as exc:
        logger.error("OpenRouter HTTP error %s: %s", exc.response.status_code, exc.response.text)
    except httpx.RequestError as exc:
        logger.error("OpenRouter request error: %s", exc)
    except Exception as exc:
        logger.error("OpenRouter unexpected error: %s", exc)
    return None
