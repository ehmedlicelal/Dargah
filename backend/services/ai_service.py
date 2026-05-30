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


# ── Official report generation ────────────────────────────────────────────────

_REPORT_SYSTEM_PROMPT = """You are an expert government reporting assistant for Nərimanov Rayon İcra Hakimiyyəti.

Your task is to analyze citizen submissions (text + optional multimedia) and generate a structured official report in Azerbaijani.

You may receive data from OpenRouter AI multimodal analysis (image, video, audio). Use that analysis to enrich understanding of the issue.

---

## INPUT FIELDS

### Required:
* Submission Type: (Ərizə / Şikayət / Təklif)
* Full citizen text

### Optional:
* Images: [list of image URLs or base64]
* OpenRouter AI Analysis Result (if available): image_analysis, detected_objects / scenes / issues

---

## INSTRUCTIONS

### 1. Extract core information:
* Müraciət növü, Ad Soyad, Ata adı, Ünvan, Telefon, Tarix, Problem / təklif təsviri, Ərazi

### 2. Use multimedia intelligence (if provided):
* From images: detect visible issues (e.g., potholes, flooding, broken lights, garbage, infrastructure damage)
* Merge with text input but do NOT hallucinate missing facts

---

## OUTPUT FORMAT (use exactly this structure)

# MÜRACİƏT HESABATI

## Ümumi Məlumatlar
* Müraciət ID: [auto-generate unique ID like MH-YYYYMMDD-XXXX]
* Müraciət növü:
* Qəbul tarixi:
* Status: Yeni

## Müraciət edən şəxs
* Ad Soyad:
* Ata adı:
* Ünvan:
* Telefon:

## Müraciətin Xülasəsi
Rəsmi üslubda 2–4 cümləlik ümumi xülasə.

## Multimedia Təhlili (əgər mövcuddursa)
* Şəkil analizi:
* AI müşahidələri:

## Əsas Məsələ
Problemin detallı izahı (text + multimedia əsaslı).

## Kateqoriya
(Yol infrastrukturu / Küçə işıqlandırılması / Kanalizasiya / Təmizlik / Yaşıllaşdırma / İctimai təhlükəsizlik / Nəqliyyat / Sosial layihələr / İdman və gənclər / Digər)

## Prioritet Səviyyəsi
(Aşağı / Orta / Yüksək / Təcili)

## Tövsiyə olunan tədbirlər
1.
2.
3.
4.
5.

## Aidiyyəti Qurumlar
Məsul dövlət və ya bələdiyyə qurumları.

## Nəticə
Yekun rəsmi qiymətləndirmə (1 paragraph).

---

## RULES
* Tam rəsmi dövlət dili (Azerbaycan dili)
* Fakt olmayan şeyləri əlavə etmə
* Multimedia yalnız dəstək kimi istifadə olunur
* Hallucination qadağandır
* Çıxış yalnız bu formatda olmalıdır"""


async def generate_official_report(
    submission_type: str,
    citizen_text: str,
    full_name: str = "",
    father_name: str = "",
    address: str = "",
    phone: str = "",
    image_url: str | None = None,
) -> str:
    """Generate a structured official Azerbaijani government report from a citizen submission."""
    import datetime
    today = datetime.date.today().strftime("%d.%m.%Y")

    user_text = f"""Submission Type: {submission_type}
Tarix: {today}
Ad Soyad: {full_name or "Göstərilməyib"}
Ata adı: {father_name or "Göstərilməyib"}
Ünvan: {address or "Göstərilməyib"}
Telefon: {phone or "Göstərilməyib"}

Full citizen text:
{citizen_text}"""

    if image_url:
        messages = [
            {"role": "system", "content": _REPORT_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_text},
                    {"type": "image_url", "image_url": {"url": image_url}},
                ],
            },
        ]
        model = settings.OPENROUTER_VISION_MODEL
    else:
        messages = [
            {"role": "system", "content": _REPORT_SYSTEM_PROMPT},
            {"role": "user", "content": user_text},
        ]
        model = settings.OPENROUTER_MODEL

    response = await openrouter_chat(
        messages,
        model=model,
        max_tokens=4096,
        temperature=0.3,
        timeout=90.0,
    )

    if response is None:
        return "Hesabat hazırlanarkən xəta baş verdi. Zəhmət olmasa yenidən cəhd edin."

    try:
        return response["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError):
        return "Hesabat hazırlanarkən xəta baş verdi."
