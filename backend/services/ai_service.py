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


async def is_complaint_message(text: str) -> bool:
    """
    Returns True if the text looks like a genuine citizen complaint/request.
    Returns False for greetings, questions, test messages, spam, etc.
    Defaults to True on AI failure so we never silently drop a real complaint.
    """
    prompt = (
        "Aşağıdakı mesajın vətəndaş şikayəti, müraciəti və ya icra hakimiyyətinə "
        "ünvanlanan real bir problem olub-olmadığını müəyyən et.\n\n"
        f"Mesaj: {text}\n\n"
        'YALNIZ JSON cavab ver: {"is_complaint": true} və ya {"is_complaint": false}\n'
        "Salam, test, sual, mənasız mətn → false\n"
        "İnfrastruktur, yol, su, işıq, təmizlik, təhlükəsizlik problemi → true"
    )
    response = await openrouter_chat([{"role": "user", "content": prompt}])
    if response is None:
        return True  # fail open — don't drop real complaints
    try:
        content = response["choices"][0]["message"]["content"].strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        return json.loads(content).get("is_complaint", True)
    except Exception:
        return True


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


async def suggest_service(
    title: str,
    description: str,
    category: str | None,
    services: list[dict],
) -> dict:
    """
    Suggests the most relevant service(s) for a complaint.
    Returns {suggested_ids: [...], reasoning: str}
    """
    if not services:
        return {"suggested_ids": [], "reasoning": "Xidmət siyahısı boşdur."}

    service_list = "\n".join(
        f"- ID: {s['id']} | Ad: {s.get('name_az') or s.get('name')} | Kateqoriya: {s.get('category') or '-'}"
        for s in services
    )

    prompt = f"""Aşağıdakı şikayəti nəzərə alaraq ən uyğun xidməti seç.

Şikayət başlığı: {title}
Şikayət məzmunu: {description}
Kateqoriya: {category or "Bilinmir"}

Mövcud xidmətlər:
{service_list}

YALNIZ JSON formatında cavab ver:
{{
  "suggested_ids": ["<id1>", "<id2>"],
  "reasoning": "<30 sözdən az Azərbaycan dilində izahat>"
}}
(suggested_ids — ən çox 2 uyğun xidmətin ID-si)"""

    response = await openrouter_chat([{"role": "user", "content": prompt}])

    if response is None:
        return {"suggested_ids": [], "reasoning": "AI xidmət tövsiyəsi alına bilmədi."}

    try:
        content = response["choices"][0]["message"]["content"].strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        result = json.loads(content)
        return {
            "suggested_ids": result.get("suggested_ids", []),
            "reasoning": result.get("reasoning", ""),
        }
    except (KeyError, json.JSONDecodeError, IndexError) as exc:
        logger.warning("Failed to parse service suggestion response: %s", exc)
        return {"suggested_ids": [], "reasoning": "AI cavabı oxuna bilmədi."}


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
    priority: str | None = None,
    zone_name: str | None = None,
    image_url: str | None = None,
) -> str:
    """Generate a structured official Azerbaijani government report from a citizen submission."""
    import datetime
    today = datetime.date.today().strftime("%d.%m.%Y")

    priority_labels = {"low": "Aşağı", "medium": "Orta", "high": "Yüksək", "critical": "Kritik"}
    user_text = f"""Submission Type: {submission_type}
Tarix: {today}
Ad Soyad: {full_name or "Göstərilməyib"}
Ata adı: {father_name or "Göstərilməyib"}
Ünvan: {address or "Göstərilməyib"}
Telefon: {phone or "Göstərilməyib"}
Prioritet: {priority_labels.get(priority, priority) if priority else "Göstərilməyib"}
Zona: {zone_name or "Göstərilməyib"}

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


# ── Telegram conversational AI ────────────────────────────────────────────────

_TELEGRAM_SYSTEM_PROMPT = """Sən Bakı şəhəri Nərimanov Rayon İcra Hakimiyyətinin rəsmi Telegram bot assistantısan.

Vəzifən:
- Vətəndaşların şikayət, ərizə və təkliflərini qəbul etmək
- Onlara mehriban və peşəkar şəkildə kömək etmək
- Lazım olduqda əlavə məlumat istəmək

Qaydalar:
- HƏMİŞƏ Azərbaycan dilində cavab ver
- Məlumat kifayət qədər olduqda şikayəti rəsmiləşdir
- Cavabın HƏMİŞƏ düzgün JSON formatında olmalıdır, başqa heç nə yazma

JSON formatları:
1. Söhbət — daha çox məlumat lazımdır:
{"action":"chat","reply":"..."}

2. Şikayət hazırdır — kifayət qədər məlumat var:
{"action":"file","reply":"...","title":"...","description":"..."}

Şikayəti "file" et yalnız problem aydın olduqda (nə, harada).
Salam, test, ümumi sual kimi mesajlara "chat" ilə cavab ver."""


async def telegram_ai_reply(
    history: list[dict],
    new_user_message: str,
) -> dict:
    """
    Given conversation history + new user message, returns one of:
      {"action": "chat",  "reply": "..."}
      {"action": "file",  "reply": "...", "title": "...", "description": "..."}
    Falls back to {"action": "chat", "reply": <fallback>} on any error.
    """
    messages = [{"role": "system", "content": _TELEGRAM_SYSTEM_PROMPT}]
    messages.extend(history)
    messages.append({"role": "user", "content": new_user_message})

    response = await openrouter_chat(messages, temperature=0.4, max_tokens=512)

    fallback = {"action": "chat", "reply": "Zəhmət olmasa probleminizi ətraflı izah edin."}

    if response is None:
        return fallback

    try:
        content = response["choices"][0]["message"]["content"].strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        result = json.loads(content)
        if result.get("action") not in ("chat", "file"):
            return fallback
        return result
    except Exception as exc:
        logger.warning("[TG-AI] Failed to parse AI reply: %s", exc)
        return fallback
