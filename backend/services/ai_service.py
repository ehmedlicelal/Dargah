import json
import logging
from core.openrouter_client import openrouter_chat
from core.config import settings

logger = logging.getLogger(__name__)

_DEFAULT_CLASSIFICATION = {
    "category": "other",
    "priority": "medium",
    "ai_summary": None,
    "reasoning": None,
}


async def classify_complaint(title: str, description: str) -> dict:
    """
    Calls OpenRouter to classify a complaint.
    Returns dict with keys: category, priority, ai_summary.
    Always returns safe defaults if AI call fails.
    """
    prompt = f"""Aşağıdakı şikayəti analiz et və YALNIZ JSON formatında cavab ver.

Şikayət başlığı: {title}
Şikayət məzmunu: {description}

Cavabı bu JSON formatında ver (başqa heç nə yazma):
{{
  "category": "<road|utilities|environment|safety|social|other>",
  "priority": "<low|medium|high|critical>",
  "ai_summary": "<50 sözdən az Azərbaycan dilində xülasə>"
}}"""

    response = await openrouter_chat([{"role": "user", "content": prompt}])

    if response is None:
        return _DEFAULT_CLASSIFICATION.copy()

    try:
        content = response["choices"][0]["message"]["content"].strip()
        # Strip markdown code fences if model wraps response
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        result = json.loads(content)
        return {
            "category": result.get("category", "other"),
            "priority": result.get("priority", "medium"),
            "ai_summary": result.get("ai_summary"),
        }
    except (KeyError, json.JSONDecodeError, IndexError) as exc:
        logger.warning("Failed to parse AI classification response: %s", exc)
        return _DEFAULT_CLASSIFICATION.copy()


async def analyze_complaint_with_image(
    title: str,
    description: str,
    image_url: str | None = None,
) -> dict:
    """
    Analyzes a complaint with optional image.
    Returns category, priority, ai_summary, reasoning.
    Uses a vision model when image_url is provided (base64 data URL or public URL).
    """
    text_block = f"Şikayət başlığı: {title}\nŞikayət məzmunu: {description}"
    json_schema = (
        '{\n'
        '  "category": "<road|utilities|environment|safety|social|other>",\n'
        '  "priority": "<low|medium|high|critical>",\n'
        '  "ai_summary": "<50 sözdən az Azərbaycan dilində xülasə>",\n'
        '  "reasoning": "<25 sözdən az — niyə bu prioritet seçildi>"\n'
        '}'
    )
    instruction = (
        "Aşağıdakı şikayəti analiz et"
        + (" və şəkli nəzərə al." if image_url else ".")
        + " YALNIZ JSON formatında cavab ver:\n\n"
        + text_block
        + "\n\nJSON:\n"
        + json_schema
    )

    if image_url:
        messages = [{
            "role": "user",
            "content": [
                {"type": "text", "text": instruction},
                {"type": "image_url", "image_url": {"url": image_url}},
            ],
        }]
        model = settings.OPENROUTER_VISION_MODEL
    else:
        messages = [{"role": "user", "content": instruction}]
        model = None

    response = await openrouter_chat(messages, model=model)

    if response is None:
        return _DEFAULT_CLASSIFICATION.copy()

    try:
        content = response["choices"][0]["message"]["content"].strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        result = json.loads(content)
        return {
            "category": result.get("category", "other"),
            "priority": result.get("priority", "medium"),
            "ai_summary": result.get("ai_summary"),
            "reasoning": result.get("reasoning"),
        }
    except (KeyError, json.JSONDecodeError, IndexError) as exc:
        logger.warning("Failed to parse AI analysis response: %s", exc)
        return _DEFAULT_CLASSIFICATION.copy()


async def summarize_report(monitoring_rows: list[dict]) -> str:
    """
    Generates a natural-language Azerbaijani summary of monitoring data.
    Returns a plain text summary string.
    """
    if not monitoring_rows:
        return "Hal-hazırda monitorinq məlumatı mövcud deyil."

    sample = json.dumps(monitoring_rows[:10], ensure_ascii=False, default=str)
    prompt = f"""Aşağıdakı monitorinq məlumatlarını analiz et və Azərbaycan dilində qısa (3-5 cümlə) ictimai hesabat xülasəsi yaz:

{sample}

Xülasə aydın, rəsmi və informativ olmalıdır."""

    response = await openrouter_chat([{"role": "user", "content": prompt}])

    if response is None:
        return "Xülasə hazırlanarkən xəta baş verdi."

    try:
        return response["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError):
        return "Xülasə hazırlanarkən xəta baş verdi."
