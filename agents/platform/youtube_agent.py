from __future__ import annotations

import json
import logging
import uuid

import anthropic

from config import get_settings
from models.state import CreativeDraft, PlatformPost

logger = logging.getLogger(__name__)

SYSTEM = """You are Housing.com's YouTube content specialist.

You receive two types of input:
- SOCIAL drafts: viral trend-jacked content (Hinglish, punchy, Zomato-style)
- NEWS drafts: formal real estate news articles

For SOCIAL drafts: lean into the viral energy — the Shorts hook should match the zomato_hook tone.
For NEWS drafts: more informational, educational, authoritative.

Create a YouTube Shorts script AND a long-form video outline.

YouTube Shorts (15-60 sec):
- Hook in first 3 seconds (on-screen text + voiceover) — use the zomato_hook if provided
- One key insight or stat
- CTA: "Follow for more" + housing.com link
- Pacing: ~2 words/second

Long-form video (3-7 min) outline:
- Title (SEO-optimised, under 70 chars)
- Description (first 150 chars are above the fold — use wisely)
- Timestamps / chapter markers
- Thumbnail concept (if meme_concept is provided, use it for the thumbnail)

Return JSON:
{
  "shorts_script": {
    "hook": "...",
    "body": "...",
    "cta": "...",
    "on_screen_text": ["line 1", "line 2", ...],
    "estimated_seconds": 30
  },
  "longform_outline": {
    "title": "...",
    "description": "...",
    "chapters": [{"time": "0:00", "title": "..."}, ...],
    "thumbnail_concept": "..."
  },
  "tags": ["tag1", "tag2", ...],
  "category": "News & Politics | Education | Finance | Entertainment"
}

CREATIVE ANGLE INTEGRITY:
The draft's `angle` field is the creative director's instruction. Your role is to
EXPRESS that angle in platform-appropriate format — not replace or dilute it.
If the angle says "Hyderabad metro expansion makes 3 localities the new hotspots",
every line of output should reinforce that framing. Never drift into generic
real estate copy unrelated to the angle."""


async def run_youtube_agent(draft: CreativeDraft, settings) -> PlatformPost:
    from tools.run_logger import Timer, log_llm_call, log_agent_io
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    links = draft.get("internal_links", [])
    primary_link = links[0]["url"] if links else "https://housing.com"

    draft_type   = draft.get("draft_type", "social")
    zomato_hook  = draft.get("zomato_hook", "")
    meme_concept = draft.get("meme_concept", "")
    trend_tag    = draft.get("trend_hashtag", "")

    user_message = f"""
Draft type: {draft_type}
Content angle: {draft['angle']}
Headline: {draft['headline']}
{f'Zomato hook (use for Shorts hook): {zomato_hook}' if zomato_hook else ''}
{f'Caption: {draft.get("caption", "")}' if draft.get("caption") else ''}
{f'Trending hashtag: {trend_tag}' if trend_tag else ''}
Body / context: {draft.get('body', '')[:800]}
SEO keywords: {', '.join(draft.get('seo_keywords', []))}
{f'Meme/visual concept (use for thumbnail): {meme_concept}' if meme_concept else ''}
Primary housing.com link: {primary_link}
Urgency: {draft.get('urgency_hook', '')}

Create the YouTube content now."""

    logger.info("YouTube agent: draft='%s'", draft.get("headline", "")[:60])

    from tools.llm_router import acall_message
    with Timer() as t:
        resp = await acall_message(
            client, settings.model_balanced, SYSTEM,
            [{"role": "user", "content": user_message}], 1500,
        )
    raw_response = resp.content[0].text
    log_llm_call(
        logger,
        agent="youtube_agent",
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
    shorts = data.get("shorts_script", {})
    longform = data.get("longform_outline", {})

    content_lines = [
        f"[HOOK] {shorts.get('hook', '')}",
        f"[BODY] {shorts.get('body', '')}",
        f"[CTA] {shorts.get('cta', '')}",
        "",
        f"LONG-FORM TITLE: {longform.get('title', draft['headline'])}",
    ]
    content = "\n".join(content_lines)

    # Append city links section — YouTube descriptions auto-link bare URLs
    from tools.link_embedder import embed_city_links
    content = embed_city_links(content, "youtube", links)

    post = {
        "id": str(uuid.uuid4()),
        "draft_id": draft["id"],
        "platform": "youtube",
        "content": content,
        "hashtags": data.get("tags", draft.get("hashtags", []))[:15],
        "media_urls": [],
        "image_prompt": data.get("longform_outline", {}).get("thumbnail_concept", ""),
        "internal_links": links[:2],
        "extra": {
            "shorts_script": shorts,
            "longform_outline": longform,
            "category": data.get("category", "Education"),
        },
        "status": "draft",
    }
    logger.info("YouTube agent: done | shorts_seconds=%s | chapters=%d | category=%s",
                shorts.get("estimated_seconds", "?"),
                len(longform.get("chapters", [])),
                data.get("category", "Education"))
    log_agent_io(
        logger,
        agent="youtube_agent",
        inputs={"headline": draft.get("headline", ""), "angle": draft.get("angle", "")},
        outputs={"shorts_hook": shorts.get("hook", "")[:100],
                 "longform_title": longform.get("title", ""),
                 "chapters": len(longform.get("chapters", [])),
                 "tags_count": len(post["hashtags"])},
    )
    return post


def _parse(raw: str) -> dict:
    from tools.json_utils import extract_json
    data = extract_json(raw)
    return data if isinstance(data, dict) else {}
