"""
Social creative agent — generates Zomato-style social media drafts for Housing.com.

Reads from state["content_briefs"] (filtered to draft_type=="social") if the planner
has run; otherwise falls back to state["trends"] directly (WS1 temporary behaviour).
"""
from __future__ import annotations

import json
import logging

import anthropic

from config import get_settings
from models.state import WorkflowState
from tools.creative_utils import get_performance_history, normalize_drafts, parse_drafts

logger = logging.getLogger(__name__)

SOCIAL_SYSTEM_BASE = """You are Housing.com India's viral content creator.

Your mission: take trending news events/topics and craft Zomato-style social posts \
that drive brand recall and engagement for Housing.com. Engagement first, real estate second.

ZOMATO'S METHOD (study this):
Zomato takes ANY news and finds the food delivery angle INSIDE it — not bolted on.
- Pakistan cricket loss → "order placed for home delivery of pak team"
- Victory parade delays → "sorry Mumbai, aaj thoda late hoga"

YOUR METHOD: Find the REAL ESTATE / HOME angle INSIDE the trend.
- A wordplay on "ghar" (home)
- A situation where you'd naturally need/want a home
- A metaphor that connects the event to home ownership/search
- A Hinglish punchline that ends with Housing.com + city SRP link as CTA

CITY LINK RULE: Whenever a city is mentioned, embed its Housing.com SRP URL:
- Delhi/NCR → housing.com/in/buy/new-delhi
- Bengaluru  → housing.com/in/buy/bengaluru
- Mumbai     → housing.com/in/buy/mumbai
- Noida      → housing.com/in/buy/noida
- Pune       → housing.com/in/buy/pune
- Hyderabad  → housing.com/in/buy/hyderabad
- Bareilly   → housing.com/in/buy/bareilly
(use the correct slug for any other city)

TONE RULES:
- Hinglish by default (natural Hindi+English mix, not forced)
- Regional language if trend is regional (e.g., Tamil Nadu, Bengal news)
- Max 2-3 lines for the card text — punchy, scrollstopper
- Rhymes, movie dialogues, meme formats welcome
- Tag relevant handles where appropriate (e.g., @NoidaAuthority for Noida civic issues)
  — BUT avoid tagging politicians and major business tycoons
- Avoid: religious sentiments, communal angles, defamation of named individuals
- Sensitive topics (court cases, tragedies): stay very light, use the pride/irony angle

HASHTAG RULE — CRITICAL:
The FIRST hashtag in every social post MUST be the original trending hashtag that \
is driving the trend (e.g. #FA9LA, #AuraFarming, #Dhurandhar, #ChampionsTrophy).
This ensures the post surfaces inside the actual trending conversation.
Add Housing.com branded tags (#HousingDotCom, #GharKhojna) AFTER the trend hashtag.
Also set "trend_hashtag" to this single primary trend tag.

MEDIA FORMAT RULES — choose one per draft:
- "branded_card": generate our purple Housing.com card with white text overlay.
  Use when: general wordplay/commentary, non-visual trends, finance/policy news.
- "meme_overlay": use the actual trending video, GIF, or meme image as the visual,
  with our text overlayed. Do NOT generate a purple card.
  Use when: the trend has a viral dance/reel/hook step (e.g. FA9LA), a recognizable
  meme format (Arjun Kapoor face, Chill Guy, Ghibli), or a viral video clip.
  Describe the source content in "meme_concept" so the social media team can find it.
- "text_only": no image needed. Just punchy copy.
  Use when: pure wit/wordplay that stands alone, Twitter-native jokes.

{examples_block}

PLATFORM SELECTION — pick only where this specific trend genuinely fits:

  "twitter"   — almost always. Any trend with wit, commentary, or wordplay potential.
  "instagram" — include when trend has strong VISUAL or EMOTIONAL resonance:
                  cricket/IPL, Bollywood, celebrity moments, city lifestyle,
                  aspirational events, viral challenges, meme-able moments.
                  Skip for dry policy/finance trends with no visual hook.
  "linkedin"  — include ONLY when trend has a clear CAREERS / JOBS / EMPLOYER angle:
                  IT layoffs, FAANG/MAANG news, salary benchmarks, WFH/RTO mandates,
                  AI replacing jobs, fresher hiring, startup culture, tech work trends.
                  NEVER for cricket, Bollywood, entertainment, weather, or civic news.

Most trends → ["twitter", "instagram"].
Trends with professional angle → ["twitter", "instagram", "linkedin"] or ["twitter", "linkedin"].
Pure career/tech trends with no visual pop → ["twitter", "linkedin"].
Entertainment-only with no work angle → ["twitter", "instagram"] — exclude linkedin.

For EACH social draft, return:
{{
  "id": "uuid",
  "draft_type": "social",
  "angle": "the creative connection being made",
  "trend_hashtag": "#OriginalTrendingHashtag — the ONE hashtag driving this trend",
  "media_format": "branded_card | meme_overlay | text_only",
  "zomato_hook": "punchy 1-3 line card/overlay text in Hinglish",
  "meme_concept": "if meme_overlay: describe EXACTLY what source content to use — else leave empty",
  "caption": "post caption ≤150 chars — Hinglish, ends with CTA or city link",
  "city_hint": "city slug if city-specific (e.g. bengaluru), else null",
  "hashtags": ["#OriginalTrendTag", "#HousingDotCom", "#GharKhojna", ...],
  "headline": "internal ref only — describes what trend/event this riffs on",
  "hook": "",
  "body": "",
  "seo_keywords": [],
  "target_platforms": ["twitter", "instagram"],
  "urgency_hook": "why this is timely right now",
  "internal_links": []
}}

Return ONLY a JSON array of social drafts."""


async def social_creative_node(state: WorkflowState) -> dict:
    """LangGraph node: generates social media drafts (Zomato-style, trend-driven)."""
    from tools.run_logger import Timer, log_llm_call, log_agent_io
    from tools.example_retriever import get_relevant_examples
    from tools.llm_router import acall_message

    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    # ── Source material: prefer planner briefs, fall back to raw trends ────────
    content_briefs = state.get("content_briefs", [])
    social_briefs = [b for b in content_briefs if b.get("draft_type") == "social"]
    trends = state.get("trends", [])

    if not social_briefs and not trends:
        logger.warning("Social creative: no briefs and no trends — skipping")
        return {"creative_drafts": []}

    # ── Trend tags for example retrieval ─────────────────────────────────────
    all_trend_tags: list[str] = []
    for t in trends:
        all_trend_tags.extend(t.get("tags", []))
        ht = t.get("hashtag", "").lstrip("#").lower().replace(" ", "-")
        if ht:
            all_trend_tags.append(ht)
        city = (t.get("city_hint") or "").lower()
        if city:
            all_trend_tags.append(city)
    if social_briefs:
        for b in social_briefs:
            # Extract meaningful tags from brief fields (not just tone)
            topic_words = b.get("topic", "").lower().split()[:3]
            all_trend_tags.extend(w for w in topic_words if len(w) > 3)
            city = (b.get("city_hint") or "").lower()
            if city:
                all_trend_tags.append(city)

    examples_block = get_relevant_examples(all_trend_tags, top_n=5)
    system = SOCIAL_SYSTEM_BASE.format(examples_block=examples_block)
    history_ctx = get_performance_history()

    n = settings.max_creative_drafts
    n_social = max(1, round(n * 0.6))

    def _compact_trends(items: list[dict]) -> list[dict]:
        return [
            {k: t.get(k) for k in ("hashtag", "volume", "context", "creative_hook", "city_hint")}
            for t in items
        ]

    if social_briefs:
        source_section = f"""━━━ CONTENT BRIEFS (from planner) ━━━
{json.dumps(social_briefs, indent=2)}

━━━ TRENDING TOPICS (for additional context) ━━━
{json.dumps(_compact_trends(trends[:5]), indent=2)}"""
    else:
        source_section = f"""━━━ TRENDING TOPICS & VIRAL NEWS (India, today) ━━━
{json.dumps(_compact_trends(trends), indent=2)}"""

    user_msg = f"""Generate {n_social} social post ideas for Housing.com.

{source_section}

━━━ HISTORICAL PERFORMANCE ━━━
{history_ctx}

Rules:
- Each post must riff on a DIFFERENT trending topic (no repeats)
- Prioritise high-volume / viral events over RE hashtags
- The real estate connection must feel NATURAL, not forced
- Vary tones: witty, nostalgic, sarcastic, proud — not all the same
- Embed city SRP links wherever a specific city is mentioned

Generate {n_social} social drafts now."""

    logger.info("Social creative: generating %d drafts | model=%s | tags=%d",
                n_social, settings.model_creative, len(all_trend_tags))

    with Timer() as t_llm:
        result = await acall_message(
            client, settings.model_creative, system,
            [{"role": "user", "content": user_msg}], 4000,
        )

    if isinstance(result, Exception):
        logger.error("Social creative LLM call failed: %s", result)
        return {"creative_drafts": []}

    raw = result.content[0].text
    log_llm_call(
        logger, agent="social_creative",
        model=settings.model_creative,
        system_prompt=system[:500],
        user_message=user_msg,
        response_text=raw,
        stop_reason=result.stop_reason,
        elapsed_ms=t_llm.elapsed_ms,
        extra={"drafts_requested": n_social,
               "input_tokens": result.usage.input_tokens,
               "output_tokens": result.usage.output_tokens},
    )

    drafts = normalize_drafts(parse_drafts(raw, default_type="social"))
    logger.info("Social creative: produced %d drafts", len(drafts))
    for d in drafts:
        logger.info("  draft [social] angle=%s | #%s | platforms=%s",
                    d.get("angle", "")[:70], d.get("trend_hashtag", ""), ",".join(d.get("target_platforms", [])))
    log_agent_io(
        logger, agent="social_creative",
        inputs={"n_social": n_social, "trends": len(trends), "briefs": len(social_briefs)},
        outputs={"drafts": [{"id": d.get("id", "")[:8], "headline": d.get("headline", "")[:60]}
                             for d in drafts]},
    )
    return {"creative_drafts": drafts}
