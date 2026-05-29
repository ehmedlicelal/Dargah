import json
import logging
from core.openrouter_client import openrouter_chat

logger = logging.getLogger(__name__)

_DEFAULT_CLASSIFICATION = {
    "category": "other",
    "priority": "medium",
    "ai_summary": None,
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
