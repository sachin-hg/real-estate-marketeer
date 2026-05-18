from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path

import asyncio

import anthropic

from config import get_settings
from db.connection import get_db_session
from models.state import CreativeDraft, WorkflowState

logger = logging.getLogger(__name__)

# ── Social track system prompt (base — examples injected at runtime) ───────────
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
  "meme_concept": "if meme_overlay: describe EXACTLY what source content to use (e.g. 'FA9LA hookstep clip from Dhurandhar trailer, overlay text top-center') — else leave empty",
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

# ── News track system prompt ───────────────────────────────────────────────────
NEWS_SYSTEM = """You are Housing.com's senior content strategist.

Create real estate news content briefs for housing.com/news articles and YouTube.
These must be SEO-focused, authoritative, and useful to home buyers/investors.

Make articles "sparkly":
- Headline: curiosity-gap hook, not just keyword-stuffed (e.g. "The City Nobody Expected \
  to Beat Mumbai in 2025 Property Prices" > "Pune Property Prices 2025")
- Opening sentence: conversational and engaging BEFORE going formal
- Pull quote: independently shareable — a stat or insight that stands alone
- Structure: H1 → engaging opener → H2 sections → data → strong CTA conclusion

Tone: Authoritative but accessible. Think Economic Times Real Estate meets a smart friend.

PLATFORM SELECTION — pick only where this story genuinely fits:

  "housing_news" — always include for any genuine RE news story.
  "youtube"      — include ONLY when the story warrants a 3-5 min video explainer:
                    complex policy (budget, RERA overhaul, stamp duty changes),
                    data-heavy city comparisons, "guide to buying in X city" content.
                    Skip for routine price updates or short news items.

Most news → ["housing_news"]. Rich explainer stories → ["housing_news", "youtube"].

For EACH news draft, return:
{{
  "id": "uuid",
  "draft_type": "news",
  "angle": "the real estate angle",
  "headline": "punchy SEO headline (under 70 chars)",
  "hook": "opening 2 engaging lines",
  "body": "full article outline / 300-word draft",
  "meme_concept": "data callout or infographic idea",
  "hashtags": ["#RealEstate", "#HousingNews", ...],
  "seo_keywords": ["long tail kw 1", ...],
  "target_platforms": ["housing_news"],
  "urgency_hook": "why this is timely",
  "zomato_hook": "",
  "caption": "",
  "city_hint": null,
  "internal_links": []
}}

Return ONLY a JSON array of news drafts."""


async def creative_node(state: WorkflowState) -> dict:
    """LangGraph node: generates social + news creative drafts in parallel."""
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    # Guard: nothing to create without source material
    if not state.get("research") and not state.get("trends"):
        logger.error("Creative: both research[] and trends[] are empty — skipping creative phase")
        return {"creative_drafts": []}

    history_ctx = _get_performance_history()  # sync DB call, run before async gather
    n = settings.max_creative_drafts
    # Split: ~60% social, ~40% news (minimum 1 each)
    n_social = max(1, round(n * 0.6))
    n_news = max(1, n - n_social)

    from tools.run_logger import Timer, log_llm_call, log_agent_io
    from tools.example_retriever import get_relevant_examples
    from tools.llm_router import acall_message

    # Collect all trend tags + hashtag entities to retrieve relevant examples.
    # The hashtag (stripped of #, lowercased) acts as an entity tag so entries
    # with specific keywords like "fa9la" or "rcb" match on name, not just category.
    all_trend_tags: list[str] = []
    for t in state.get("trends", []):
        all_trend_tags.extend(t.get("tags", []))
        ht = t.get("hashtag", "").lstrip("#").lower().replace(" ", "-")
        if ht:
            all_trend_tags.append(ht)

    examples_block = get_relevant_examples(all_trend_tags, top_n=8)
    social_system = SOCIAL_SYSTEM_BASE.format(examples_block=examples_block)

    # ── Compact serialization — only pass fields each model actually uses ────────
    def _compact_trends(trends: list[dict]) -> list[dict]:
        return [
            {k: t.get(k) for k in ("hashtag", "volume", "context", "creative_hook", "city_hint")}
            for t in trends
        ]

    def _compact_research(items: list[dict]) -> list[dict]:
        return [
            {k: r.get(k) for k in ("headline", "source", "summary")}
            for r in items
        ]

    # ── Social drafts (trend-driven, Zomato-style) ────────────────────────────
    social_msg = f"""Generate {n_social} social post ideas for Housing.com.

━━━ TRENDING TOPICS & VIRAL NEWS (India, today) ━━━
{json.dumps(_compact_trends(state.get('trends', [])), indent=2)}

━━━ REAL ESTATE NEWS (for context / inspiration) ━━━
{json.dumps(_compact_research(state.get('research', [])[:3]), indent=2)}

━━━ HISTORICAL PERFORMANCE ━━━
{history_ctx}

Rules:
- Each post must riff on a DIFFERENT trending topic (no repeats)
- Prioritise high-volume / viral events over RE hashtags
- The real estate connection must feel NATURAL, not forced
- Vary tones: witty, nostalgic, sarcastic, proud — not all the same
- Embed city SRP links wherever a specific city is mentioned

Generate {n_social} social drafts now."""

    # ── News drafts user message ───────────────────────────────────────────────
    news_msg = f"""Generate {n_news} housing.com/news article brief(s).

━━━ REAL ESTATE NEWS (past 7 days) ━━━
{json.dumps(state.get('research', []), indent=2)}


━━━ HISTORICAL PERFORMANCE ━━━
{history_ctx}

Rules:
- Focus on RERA, policy, builder launches, city price movements, infrastructure
- Each brief covers a different news angle
- Headlines must be curiosity-gap — not boring keyword dumps

Generate {n_news} news draft(s) now."""

    logger.info("Creative marketeer: generating %d social + %d news drafts in parallel | model=%s | example_tags=%d",
                n_social, n_news, settings.model_creative, len(all_trend_tags))

    # ── Run both LLM calls in parallel ────────────────────────────────────────
    with Timer() as t_total:
        social_r, news_r = await asyncio.gather(
            acall_message(client, settings.model_creative, social_system,
                          [{"role": "user", "content": social_msg}], 4000),
            acall_message(client, settings.model_balanced, NEWS_SYSTEM,
                          [{"role": "user", "content": news_msg}], 2500),
            return_exceptions=True,
        )

    # ── Handle partial failures gracefully ────────────────────────────────────
    if isinstance(social_r, Exception):
        logger.error("Creative social call failed: %s", social_r)
        raw_social, social_resp = "", None
    else:
        raw_social = social_r.content[0].text
        social_resp = social_r
        log_llm_call(
            logger, agent="creative_marketeer/social",
            model=settings.model_creative,
            system_prompt=social_system[:500],
            user_message=social_msg,
            response_text=raw_social,
            stop_reason=social_r.stop_reason,
            elapsed_ms=t_total.elapsed_ms,
            extra={"drafts_requested": n_social,
                   "input_tokens": social_r.usage.input_tokens,
                   "output_tokens": social_r.usage.output_tokens},
        )

    if isinstance(news_r, Exception):
        logger.error("Creative news call failed: %s", news_r)
        raw_news = ""
    else:
        raw_news = news_r.content[0].text
        log_llm_call(
            logger, agent="creative_marketeer/news",
            model=settings.model_balanced,
            system_prompt=NEWS_SYSTEM[:500],
            user_message=news_msg,
            response_text=raw_news,
            stop_reason=news_r.stop_reason,
            elapsed_ms=t_total.elapsed_ms,
            extra={"drafts_requested": n_news,
                   "input_tokens": news_r.usage.input_tokens,
                   "output_tokens": news_r.usage.output_tokens},
        )

    social_drafts = _parse_drafts(raw_social, default_type="social")
    news_drafts = _parse_drafts(raw_news, default_type="news")
    all_drafts = social_drafts + news_drafts

    for d in all_drafts:
        if not d.get("id"):
            d["id"] = str(uuid.uuid4())
        d.setdefault("internal_links", [])
        d.setdefault("zomato_hook", "")
        d.setdefault("caption", "")
        d.setdefault("city_hint", None)
        d.setdefault("draft_type", "social")
        d.setdefault("media_format", "branded_card")
        d.setdefault("trend_hashtag", "")
        d.setdefault("meme_concept", "")
        # Fallback: LLM should set target_platforms; if missing use type-appropriate default
        if not d.get("target_platforms"):
            d["target_platforms"] = (
                ["twitter", "instagram"] if d["draft_type"] == "social" else ["housing_news"]
            )

    logger.info("Creative marketeer: %d social + %d news drafts | total=%d",
                len(social_drafts), len(news_drafts), len(all_drafts))
    log_agent_io(
        logger, agent="creative_marketeer",
        inputs={"n_social": n_social, "n_news": n_news,
                "trends": len(state.get("trends", [])),
                "research": len(state.get("research", []))},
        outputs={"drafts": [{"id": d.get("id", "")[:8],
                              "type": d.get("draft_type"),
                              "headline": d.get("headline", "")[:60]} for d in all_drafts]},
    )
    return {"creative_drafts": all_drafts}


def _get_performance_history() -> str:
    try:
        from db.models import PublishedPostRecord
        from sqlalchemy import desc, asc
        with get_db_session() as session:
            top = (
                session.query(PublishedPostRecord)
                .filter(PublishedPostRecord.actual_engagement_7d.isnot(None))
                .order_by(desc(PublishedPostRecord.actual_engagement_7d))
                .limit(3).all()
            )
            bottom = (
                session.query(PublishedPostRecord)
                .filter(PublishedPostRecord.actual_engagement_7d.isnot(None))
                .order_by(asc(PublishedPostRecord.actual_engagement_7d))
                .limit(2).all()
            )
            if not top and not bottom:
                return "No historical data yet — this is an early run."

            def fmt(records, label):
                lines = [f"{label}:"]
                for r in records:
                    lines.append(
                        f"  [{r.platform}] {r.content[:120]}... "
                        f"→ actual ER {r.actual_engagement_7d:.1%}"
                    )
                return "\n".join(lines)

            return fmt(top, "TOP PERFORMERS") + "\n\n" + fmt(bottom, "WORST PERFORMERS")
    except Exception as exc:
        logger.debug("History fetch skipped: %s", exc)
        return "No historical data yet — this is an early run."


def _parse_drafts(raw: str, default_type: str = "social") -> list[CreativeDraft]:
    from tools.json_utils import extract_json
    data = extract_json(raw)
    if isinstance(data, list):
        for d in data:
            d.setdefault("draft_type", default_type)
        return data
    logger.error("Failed to parse %s drafts. Raw: %s", default_type, raw[:300])
    return []
