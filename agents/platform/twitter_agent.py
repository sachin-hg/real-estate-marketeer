from __future__ import annotations

import logging
import uuid

import anthropic

from config import get_settings
from models.state import CreativeDraft, PlatformPost
from tools.housing_urls import city_srp_url, resolve_city

logger = logging.getLogger(__name__)

SYSTEM = """You are Housing.com's Twitter/X content specialist.

Housing.com on Twitter is punchy, witty, Hinglish — like Zomato but for homes.
One perfect tweet > a long thread. Engagement and brand recall first.

RULES:
- Main tweet: ≤280 characters (HARD limit — count carefully)
- Hinglish by default. Use the draft's zomato_hook as the base — compress if needed.
- Images are OPTIONAL. Only suggest one if it dramatically improves the post.
- 2-4 relevant hashtags max (Twitter penalises stuffing)
- The original trend hashtag (provided as trend_hashtag) MUST be the first hashtag — this surfaces the tweet inside the live conversation
- No emoji overload — max 2 emojis
- Threads only when the topic genuinely needs it (rare). Most posts = single tweet.

HANDLE TAGGING:
- For well-known accounts (Microsoft, Google, TCS, Zomato, RCB, etc.) use their @handle directly
- For any entity you want to tag but aren't certain of their exact handle, write [LOOKUP: EntityName]
  The pipeline will resolve it to the correct @handle before publishing
- Avoid tagging individual politicians or named executives

Return JSON:
{
  "main_tweet": "...",
  "thread": [],
  "is_thread": false,
  "hashtags": ["#tag1", "#tag2"],
  "include_image": false,
  "hook_type": "wit|stat|question|hot_take|nostalgia"
}

Return ONLY the JSON."""


async def run_twitter_agent(draft: CreativeDraft, settings) -> PlatformPost:
    from tools.run_logger import Timer, log_llm_call, log_agent_io
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    zomato_hook = draft.get("zomato_hook") or draft.get("hook", "")
    # If no explicit city_hint, fall back to first city extracted by re_signals
    re_signals = draft.get("re_signals", {}) or {}
    city_hint = draft.get("city_hint") or (re_signals.get("cities") or [None])[0]
    city_link = _resolve_city_link(city_hint)
    links = draft.get("internal_links", [])
    primary_link = city_link or (links[0]["url"] if links else "https://housing.com")
    trend_hashtag = draft.get("trend_hashtag", "")

    user_message = f"""
Zomato-style hook (use as base): {zomato_hook}
Draft caption: {draft.get('caption', '')}
Angle: {draft.get('angle', '')}
Primary link: {primary_link}
City hint: {city_hint or 'none'}
Original trend hashtag (MUST be first): {trend_hashtag or draft.get('hashtags', [''])[0]}
Other hashtags available: {' '.join(draft.get('hashtags', [])[:6])}
Urgency: {draft.get('urgency_hook', '')}

Produce the tweet now. Keep it ≤280 chars."""

    logger.info("Twitter agent: draft='%s'", draft.get("headline", "")[:60])

    from tools.llm_router import acall_message
    with Timer() as t:
        resp = await acall_message(
            client, settings.model_balanced, SYSTEM,
            [{"role": "user", "content": user_message}], 600,
        )
    raw_response = resp.content[0].text
    log_llm_call(
        logger, agent="twitter_agent",
        model=settings.model_balanced,
        system_prompt=SYSTEM,
        user_message=user_message,
        response_text=raw_response,
        stop_reason=resp.stop_reason,
        elapsed_ms=t.elapsed_ms,
        extra={"draft_headline": draft.get("headline", "")[:60],
               "input_tokens": resp.usage.input_tokens,
               "output_tokens": resp.usage.output_tokens},
    )

    data = _parse(raw_response)
    main_tweet = data.get("main_tweet", zomato_hook[:280])
    main_tweet = main_tweet.replace("{{HOUSING_LINK}}", primary_link)
    thread = [tw.replace("{{HOUSING_LINK}}", primary_link) for tw in data.get("thread", [])]

    # Resolve any [LOOKUP: EntityName] placeholders the LLM left in the tweet
    from tools.handle_resolver import resolve_handles_in_text
    main_tweet, resolved = resolve_handles_in_text(main_tweet, platform="twitter")
    thread = [resolve_handles_in_text(tw, "twitter")[0] for tw in thread]
    if resolved:
        logger.info("Twitter agent: resolved handles %s", resolved)

    content = main_tweet
    if thread:
        content = "\n\n---\n\n".join([main_tweet] + thread)

    # If model suggests an image, generate the branded card
    include_image = data.get("include_image", False)
    media_urls = []
    if include_image:
        try:
            from tools.branded_image_generator import generate_branded_card
            import tempfile, asyncio
            from pathlib import Path
            card_text = zomato_hook or main_tweet
            tmp = Path(tempfile.mkdtemp()) / "twitter_card.png"
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, generate_branded_card, card_text, tmp)
            media_urls = [str(tmp)]
        except Exception as exc:
            logger.warning("Twitter card generation failed: %s", exc)

    raw_tags = data.get("hashtags", draft.get("hashtags", []))[:4]
    hashtags = _prioritise_trend_hashtag(raw_tags, trend_hashtag)

    post = {
        "id": str(uuid.uuid4()),
        "draft_id": draft["id"],
        "platform": "twitter",
        "content": content,
        "hashtags": hashtags,
        "media_urls": media_urls,
        "image_prompt": zomato_hook[:200] if include_image else "",
        "internal_links": ([{"url": city_link, "anchor_text": city_hint,
                              "page_type": "city_srp", "placement": "tweet"}]
                           if city_link else links[:1]),
        "extra": {
            "main_tweet": main_tweet,
            "thread": thread,
            "is_thread": data.get("is_thread", False),
            "hook_type": data.get("hook_type", "wit"),
            "char_count": len(main_tweet),
            "include_image": include_image,
        },
        "status": "draft",
    }
    logger.info("Twitter agent: done | char_count=%d | is_thread=%s | hook_type=%s | image=%s",
                len(main_tweet), data.get("is_thread", False),
                data.get("hook_type", ""), include_image)
    log_agent_io(
        logger, agent="twitter_agent",
        inputs={"headline": draft.get("headline", ""), "zomato_hook": zomato_hook[:60]},
        outputs={"main_tweet": main_tweet[:200], "char_count": len(main_tweet),
                 "is_thread": data.get("is_thread", False), "include_image": include_image},
    )
    return post


def _prioritise_trend_hashtag(tags: list[str], trend_hashtag: str) -> list[str]:
    if trend_hashtag and not trend_hashtag.startswith("#"):
        trend_hashtag = "#" + trend_hashtag
    result = [t for t in tags if t.lower() != trend_hashtag.lower()]
    if trend_hashtag:
        result.insert(0, trend_hashtag)
    return result[:4]


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
    return data if isinstance(data, dict) else {"main_tweet": raw[:280]}
