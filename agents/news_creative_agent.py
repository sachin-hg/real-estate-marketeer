"""
News creative agent — generates housing.com/news article briefs and YouTube outlines.

Reads from state["content_briefs"] (filtered to draft_type=="news") if the planner
has run; otherwise falls back to state["research"] directly (WS1 temporary behaviour).
"""
from __future__ import annotations

import json
import logging

import anthropic

from config import get_settings
from models.state import WorkflowState
from tools.creative_utils import get_performance_history, normalize_drafts, parse_drafts

logger = logging.getLogger(__name__)

NEWS_SYSTEM = """You are Housing.com's senior content strategist and SEO editor.

Turn raw real estate news into authoritative, engaging housing.com/news articles
that rank on Google AND are genuinely worth reading.

━━━ ARTICLE STANDARDS ━━━

LENGTH: 700-1000 words in the `body` field. Write the FULL article — not an outline.
HEADLINE: Under 70 characters. Curiosity-gap hook, not a keyword dump.
  ✓ "The City Nobody Expected to Beat Mumbai in 2025 Property Prices"
  ✗ "Pune Property Prices 2025 Real Estate Market Update"
META DESCRIPTION: ≤160 characters. Natural language sentence. Must include the primary
  keyword. No truncation — complete thought.
SLUG: kebab-case, ≤60 characters, keyword-first (e.g. "pune-property-prices-beat-mumbai-2025")

━━━ REQUIRED ARTICLE STRUCTURE ━━━

## [Keyword-rich H2: What happened / the core data point]
Opening paragraph (2-3 sentences): Hook BEFORE going formal. Start with a surprising
stat, a human consequence, or a bold claim — NOT "In the wake of..." or "Recently...".

## [H2: Why this matters for buyers/investors]
The so-what. Concrete implications, not generic "this is important".

## [H2: City/locality specifics or data deep-dive]
Numbers, comparisons, named localities. Ground the story.

## [H2: Expert take or what to watch next]
Forward-looking. Quote, prediction, or action item for the reader.

PULL QUOTE: One independently-shareable sentence — a surprising stat or insight
that works as a tweet or social caption on its own.

CLOSING CTA: Link the reader to a relevant Housing.com search (e.g. "Browse 2BHK flats
in Pune under ₹80L → [link]"). Natural, not pushy.

━━━ SEO RULES ━━━
- Primary keyword in H1 + opening paragraph + at least 2 H2s
- Secondary keywords woven in naturally (3-5 uses total, not stuffed)
- Minimum 2 internal link opportunities identified (city SRP, builder, project microsite)
- No passive voice for the opening sentence

━━━ TONE ━━━
Economic Times Real Estate meets a smart friend. Plain English. Short paragraphs
(2-3 sentences max). Define any jargon the first time it appears.

━━━ PLATFORM SELECTION ━━━
"housing_news" — always include for any genuine RE news story.
"youtube" — only for rich 3-5 min explainer topics: complex policy (RERA overhaul,
  stamp duty changes, budget impact), data-heavy city comparisons, city buying guides.
  Skip for routine price updates or short news items.
Most news → ["housing_news"]. Rich explainers → ["housing_news", "youtube"].

━━━ OUTPUT FORMAT ━━━
Return ONLY a JSON array. Each draft must include ALL these fields:
{
  "id": "uuid",
  "draft_type": "news",
  "angle": "one-sentence real estate angle",
  "headline": "curiosity-gap SEO headline (under 70 chars)",
  "hook": "opening 2 lines — conversational, surprising, not formal",
  "body": "FULL ARTICLE TEXT (700-1000 words) with ## H2 headings in markdown",
  "pull_quote": "one standalone shareable insight or stat sentence",
  "meta_description": "SEO meta description (≤160 chars, includes primary keyword)",
  "slug": "kebab-case-slug-under-60-chars",
  "meme_concept": "data callout or infographic idea (e.g. '43% cheaper than Mumbai')",
  "hashtags": ["#RealEstate", "#HousingNews", "#CityName"],
  "seo_keywords": ["primary keyword", "secondary keyword 1", "secondary keyword 2"],
  "target_platforms": ["housing_news"],
  "urgency_hook": "why this story matters RIGHT NOW (deadline, data release, event)",
  "zomato_hook": "",
  "caption": "",
  "city_hint": null,
  "internal_links": []
}"""


async def news_creative_node(state: WorkflowState) -> dict:
    """LangGraph node: generates housing.com/news article briefs and YouTube outlines."""
    from tools.run_logger import Timer, log_llm_call, log_agent_io
    from tools.llm_router import acall_message

    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    # ── Source material: prefer planner briefs, fall back to raw research ─────
    content_briefs = state.get("content_briefs", [])
    news_briefs = [b for b in content_briefs if b.get("draft_type") == "news"]
    research = state.get("research", [])

    if not news_briefs and not research:
        logger.warning("News creative: no briefs and no research — skipping")
        return {"creative_drafts": []}

    history_ctx = get_performance_history()
    n = settings.max_creative_drafts
    n_news = max(1, n - max(1, round(n * 0.6)))

    if news_briefs:
        source_section = f"""━━━ CONTENT BRIEFS (from planner) ━━━
{json.dumps(news_briefs, indent=2)}

━━━ RAW RESEARCH (additional context) ━━━
{json.dumps(research[:3], indent=2)}"""
    else:
        source_section = f"""━━━ REAL ESTATE NEWS (past 7 days) ━━━
{json.dumps(research, indent=2)}"""

    user_msg = f"""Generate {n_news} housing.com/news article brief(s).

{source_section}

━━━ HISTORICAL PERFORMANCE ━━━
{history_ctx}

Rules:
- Focus on RERA, policy, builder launches, city price movements, infrastructure
- Each brief covers a different news angle
- Headlines must be curiosity-gap — not boring keyword dumps

Generate {n_news} news draft(s) now."""

    logger.info("News creative: generating %d drafts | model=%s | research=%d",
                n_news, settings.model_balanced, len(research))

    with Timer() as t_llm:
        result = await acall_message(
            client, settings.model_balanced, NEWS_SYSTEM,
            [{"role": "user", "content": user_msg}], 4096,
        )

    if isinstance(result, Exception):
        logger.error("News creative LLM call failed: %s", result)
        return {"creative_drafts": []}

    raw = result.content[0].text
    log_llm_call(
        logger, agent="news_creative",
        model=settings.model_balanced,
        system_prompt=NEWS_SYSTEM[:500],
        user_message=user_msg,
        response_text=raw,
        stop_reason=result.stop_reason,
        elapsed_ms=t_llm.elapsed_ms,
        extra={"drafts_requested": n_news,
               "input_tokens": result.usage.input_tokens,
               "output_tokens": result.usage.output_tokens},
    )

    drafts = normalize_drafts(parse_drafts(raw, default_type="news"))
    logger.info("News creative: produced %d drafts", len(drafts))
    for d in drafts:
        logger.info("  draft [news] angle=%s | platforms=%s",
                    d.get("angle", "")[:70], ",".join(d.get("target_platforms", [])))
    log_agent_io(
        logger, agent="news_creative",
        inputs={"n_news": n_news, "research": len(research), "briefs": len(news_briefs)},
        outputs={"drafts": [{"id": d.get("id", "")[:8], "headline": d.get("headline", "")[:60]}
                             for d in drafts]},
    )
    return {"creative_drafts": drafts}
