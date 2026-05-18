from __future__ import annotations

import logging
import uuid
from pathlib import Path

import anthropic

from config import get_settings
from models.state import CreativeDraft, PlatformPost
from tools.branded_image_generator import generate_branded_card_async
from tools.housing_urls import city_srp_url, resolve_city

logger = logging.getLogger(__name__)

SYSTEM = """You are Housing.com's Instagram content specialist.

Housing.com's Instagram is engagement-first. We post like Zomato — Hinglish, witty, \
trend-aware. Formal English corporate copy is WRONG for this platform.

Given a content draft, produce the final Instagram post:

CAPTION RULES:
- ≤150 chars (people don't expand — make it complete in one view)
- Hinglish by default. Regional language if the trend is regional.
- Punchy, GenZ-relatable. Rhymes and movie dialogues are welcome.
- End with a CTA: Housing.com link or "Link in bio 🔗"
- No bullet points, no formal tone, no jargon

HANDLE TAGGING:
- For well-known accounts (SRK, Virat Kohli, RCB, Zomato, etc.) use their @handle directly
- For any entity you want to tag but aren't certain of their exact handle, write [LOOKUP: EntityName]
  The pipeline will resolve it to the correct @handle before publishing
- Avoid tagging individual politicians

HASHTAG RULES:
- 15-20 tags total
- The trend_hashtag (original trending tag) MUST be first — this puts us inside the live conversation
- Then: #HousingDotCom #GharKhojna + city tags if applicable
- Then: supporting topic tags

Return JSON:
{
  "caption": "short Hinglish caption ≤150 chars",
  "hashtags": ["#OriginalTrendTag", "#HousingDotCom", "#GharKhojna", ...],
  "alt_text": "accessibility description of the image/video"
}

Return ONLY the JSON."""


async def run_instagram_agent(draft: CreativeDraft, settings, run_id: str) -> PlatformPost:
    from tools.run_logger import Timer, log_llm_call, log_tool_call, log_agent_io
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    zomato_hook = draft.get("zomato_hook") or draft.get("hook", "")
    # If no explicit city_hint, fall back to first city extracted by re_signals
    re_signals = draft.get("re_signals", {}) or {}
    city_hint = draft.get("city_hint") or (re_signals.get("cities") or [None])[0]
    city_link = _resolve_city_link(city_hint)
    links = draft.get("internal_links", [])
    primary_link = city_link or (links[0]["url"] if links else "https://housing.com")
    media_format = draft.get("media_format") or "branded_card"
    trend_hashtag = draft.get("trend_hashtag", "")
    meme_concept = draft.get("meme_concept", "")

    user_message = f"""
Content angle: {draft.get('angle', '')}
Overlay text: {zomato_hook}
Draft caption: {draft.get('caption', '')}
City hint: {city_hint or 'none'}
City link (embed if city-specific): {primary_link}
Trending topic context: {draft.get('urgency_hook', '')}
Original trend hashtag (MUST be first): {trend_hashtag or draft.get('hashtags', [''])[0]}
Other hashtags available: {' '.join(draft.get('hashtags', [])[:12])}
Media format: {media_format}

Produce the final Instagram post now."""

    logger.info("Instagram agent: draft='%s' | media_format=%s",
                draft.get("headline", "")[:60], media_format)

    from tools.llm_router import acall_message
    with Timer() as t:
        resp = await acall_message(
            client, settings.model_balanced, SYSTEM,
            [{"role": "user", "content": user_message}], 1000,
        )
    raw_response = resp.content[0].text
    log_llm_call(
        logger, agent="instagram_agent",
        model=settings.model_balanced,
        system_prompt=SYSTEM,
        user_message=user_message,
        response_text=raw_response,
        stop_reason=resp.stop_reason,
        elapsed_ms=t.elapsed_ms,
        extra={"draft_headline": draft.get("headline", "")[:60], "media_format": media_format,
               "input_tokens": resp.usage.input_tokens,
               "output_tokens": resp.usage.output_tokens},
    )

    data = _parse(raw_response)
    caption = data.get("caption") or draft.get("caption", zomato_hook[:150])

    # Resolve any [LOOKUP: EntityName] placeholders the LLM left in the caption
    from tools.handle_resolver import resolve_handles_in_text
    caption, resolved = resolve_handles_in_text(caption, platform="instagram")
    if resolved:
        logger.info("Instagram agent: resolved handles %s", resolved)

    # ── Media: route by format ──────────────────────────────────────────────────
    media_urls: list[str] = []
    image_prompt = ""

    if media_format == "branded_card":
        img_path = Path("output") / run_id / f"instagram_{draft['id'][:8]}.png"
        card_text = zomato_hook or draft.get("headline", "housing.com")
        image_prompt = card_text
        logger.info("Instagram agent: generating branded card | text='%s'", card_text[:60])
        with Timer() as t_img:
            try:
                await generate_branded_card_async(card_text, img_path)
                media_urls = [str(img_path)]
            except Exception as exc:
                logger.warning("Branded card generation failed: %s", exc)
        log_tool_call(
            logger, tool_name="generate_branded_card",
            inputs={"text": card_text[:100], "output_path": str(img_path)},
            outputs={"success": bool(media_urls), "path": str(img_path)},
            elapsed_ms=t_img.elapsed_ms,
        )

    elif media_format == "meme_overlay":
        # Generate a branded card as placeholder for review; social team does the actual meme overlay.
        concept = meme_concept or f"Overlay '{zomato_hook}' on trending visual for {trend_hashtag}"
        image_prompt = concept
        logger.info("Instagram agent: meme_overlay concept recorded | '%s'", concept[:80])
        img_path = Path("output") / run_id / f"instagram_{draft['id'][:8]}_meme_placeholder.png"
        card_text = zomato_hook or draft.get("headline", "housing.com")
        with Timer() as t_img:
            try:
                await generate_branded_card_async(card_text, img_path)
                media_urls = [str(img_path)]
                logger.info("Instagram agent: meme placeholder card at %s", img_path)
            except Exception as exc:
                logger.warning("Meme placeholder card generation failed: %s", exc)
        log_tool_call(
            logger, tool_name="generate_branded_card/meme_placeholder",
            inputs={"text": card_text[:100], "output_path": str(img_path)},
            outputs={"success": bool(media_urls), "path": str(img_path)},
            elapsed_ms=t_img.elapsed_ms,
        )

    elif media_format == "text_only":
        logger.info("Instagram agent: text_only post, no visual")

    # ── Hashtags: trend tag must be first ──────────────────────────────────────
    raw_tags = data.get("hashtags", draft.get("hashtags", []))
    hashtags = _prioritise_trend_hashtag(raw_tags, trend_hashtag)

    post = {
        "id": str(uuid.uuid4()),
        "draft_id": draft["id"],
        "platform": "instagram",
        "content": caption,
        "hashtags": hashtags,
        "media_urls": media_urls,
        "image_prompt": image_prompt,
        "internal_links": ([{"url": city_link, "anchor_text": city_hint, "page_type": "city_srp", "placement": "caption"}]
                           if city_link else links[:2]),
        "extra": {
            "media_format": media_format,
            "meme_concept": meme_concept,
            "card_text": zomato_hook,
            "trend_hashtag": trend_hashtag,
            "city_hint": city_hint,
            "city_link": city_link,
            "alt_text": data.get("alt_text", f"Housing.com post: {zomato_hook[:80]}"),
        },
        "status": "draft",
    }
    log_agent_io(
        logger, agent="instagram_agent",
        inputs={"headline": draft.get("headline", ""), "media_format": media_format,
                "trend_hashtag": trend_hashtag},
        outputs={"caption_chars": len(caption), "hashtags_count": len(hashtags),
                 "media_urls": media_urls, "city_hint": city_hint},
    )
    return post


def _prioritise_trend_hashtag(tags: list[str], trend_hashtag: str) -> list[str]:
    """Ensure the original trend hashtag appears first, followed by Housing branded tags."""
    result = list(tags)
    # Normalise trend_hashtag to have a leading #
    if trend_hashtag and not trend_hashtag.startswith("#"):
        trend_hashtag = "#" + trend_hashtag
    # Remove it from wherever it is, re-insert at front
    result = [t for t in result if t.lower() != trend_hashtag.lower()]
    if trend_hashtag:
        result.insert(0, trend_hashtag)
    # Ensure Housing branded tags are present (but not necessarily first)
    for tag in ["#HousingDotCom", "#GharKhojna"]:
        if tag not in result:
            result.append(tag)
    return result[:20]


def _resolve_city_link(city_hint: str | None) -> str | None:
    if not city_hint:
        return None
    try:
        slug = resolve_city(city_hint)
        if slug:
            return city_srp_url(slug)
    except Exception:
        pass
    return None


def _parse(raw: str) -> dict:
    from tools.json_utils import extract_json
    data = extract_json(raw)
    return data if isinstance(data, dict) else {"caption": raw[:150], "hashtags": []}
