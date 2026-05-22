"""
Planner agent — quality gate between research/trends and creative nodes.

Reads raw research + trends, filters out topics with no genuine RE angle,
and emits a list of ContentBrief objects that tell each creative node exactly
what to produce: angle, tone, platforms, city, urgency, SEO keywords.

Model: model_fast (Haiku / Gemini Flash) — classification + brief generation only.
"""
from __future__ import annotations

import json
import logging

from config import get_settings
from models.state import ContentBrief, WorkflowState
from tools.llm_router import call_json_async

logger = logging.getLogger(__name__)

SYSTEM = """You are the content planning director for Housing.com India.

Your job: review incoming research stories and trending topics, decide which ones
deserve a content piece, and write a tight ContentBrief for each one.

QUALITY GATE — only generate a brief when the topic has a GENUINE real estate angle:
  - A housing/property metaphor that feels natural (not forced)
  - A direct RE news angle (RERA, policy, builder news, price data)
  - A lifestyle/career story where home/property is a natural part of the context

OMIT topics that have NO conceivable housing angle — do not generate a brief for them.
Fewer briefs = focused creative output = higher quality. Do not pad.

DECISION RULES (use these to classify each item):
  - Viral/entertainment with wordplay potential → social, ["twitter","instagram"]
  - IT/AI/layoffs/career trend → social, ["twitter","linkedin"]
  - RE policy/RERA/builder news → news, ["housing_news"]
  - Rich explainer (budget, market data, city guide) → news, ["housing_news","youtube"]
  - City-specific price/infra news → social or news based on depth
  - No plausible RE angle → OMIT

OUTPUT FORMAT — return a JSON object with a single "briefs" array (max 5 social + 3 news):
{
  "briefs": [
    {
      "topic": "one-line topic description",
      "angle": "the specific RE/home angle to use",
      "draft_type": "social",
      "target_platforms": ["twitter", "instagram"],
      "tone": "hinglish_viral",
      "city_hint": "bengaluru or null",
      "urgency": "why this is timely",
      "seo_keywords": [],
      "source_summary": "1-2 sentence context for the creative agent"
    }
  ]
}

TONE VALUES:
  "hinglish_viral"   — social posts: punchy, meme-worthy, Hinglish
  "formal_seo"       — news articles: authoritative, keyword-rich
  "educational"      — YouTube/long-form: explainer style, step-by-step

Return ONLY the JSON object."""


async def planner_node(state: WorkflowState) -> dict:
    """LangGraph node: filters inputs and emits ContentBriefs for creative nodes."""
    from tools.run_logger import log_agent_io

    settings = get_settings()

    if not settings.enable_planner:
        logger.info("Planner: disabled via config — passing through empty briefs")
        return {"content_briefs": []}

    research = state.get("research", [])
    trends = state.get("trends", [])

    if not research and not trends:
        logger.warning("Planner: no research and no trends — emitting empty briefs")
        return {"content_briefs": []}

    def _compact_research(items: list[dict]) -> list[dict]:
        return [{"headline": r.get("headline", ""), "summary": r.get("summary", "")[:200]}
                for r in items]

    def _compact_trends(items: list[dict]) -> list[dict]:
        return [{"hashtag": t.get("hashtag", ""), "context": t.get("context", ""),
                 "creative_hook": t.get("creative_hook", ""), "tags": t.get("tags", [])}
                for t in items]

    user_msg = f"""Here are today's inputs. Generate ContentBriefs for items with a genuine RE angle.

━━━ REAL ESTATE RESEARCH ({len(research)} stories) ━━━
{json.dumps(_compact_research(research), indent=2)}

━━━ TRENDING TOPICS ({len(trends)} trends) ━━━
{json.dumps(_compact_trends(trends), indent=2)}

Review each item. Generate a brief ONLY when there is a genuine, natural housing/property angle.
Omit items with no RE connection. Max 5 social + 3 news briefs."""

    logger.info("Planner: evaluating %d research + %d trends", len(research), len(trends))

    result = await call_json_async(
        tier="balanced",
        system=SYSTEM,
        user_msg=user_msg,
        max_tokens=2000,
        log_label="planner",
    )

    briefs_raw = result.get("briefs", []) if isinstance(result, dict) else []
    briefs: list[ContentBrief] = []
    for b in briefs_raw:
        if not isinstance(b, dict):
            continue
        b.setdefault("seo_keywords", [])
        b.setdefault("city_hint", None)
        b.setdefault("source_summary", "")
        # Normalize draft_type — Gemini may return "Social", "social_post", etc.
        dt = b.get("draft_type", "").lower().strip().replace("_", " ").replace("-", " ")
        if "social" in dt:
            b["draft_type"] = "social"
        elif "news" in dt:
            b["draft_type"] = "news"
        else:
            logger.warning("Planner: unknown draft_type %r in brief, defaulting to 'social'", b.get("draft_type"))
            b["draft_type"] = "social"
        briefs.append(b)

    # Enforce hard limits: max 5 social + 3 news — LLM may exceed what the prompt says
    social_briefs = [b for b in briefs if b.get("draft_type") == "social"][:5]
    news_briefs = [b for b in briefs if b.get("draft_type") == "news"][:3]
    if len(briefs) > len(social_briefs) + len(news_briefs):
        logger.warning("Planner: truncated from %d to %d briefs (limits: 5 social + 3 news)",
                       len(briefs), len(social_briefs) + len(news_briefs))
    briefs = social_briefs + news_briefs

    n_social = len(social_briefs)
    n_news = len(news_briefs)
    logger.info("planner: %d briefs from %d inputs (social=%d, news=%d)",
                len(briefs), len(research) + len(trends), n_social, n_news)
    for i, b in enumerate(briefs, 1):
        logger.info(
            "  brief #%d [%s → %s] %s | tone=%s | platforms=%s",
            i, b.get("draft_type", "?"), ",".join(b.get("target_platforms", [])),
            b.get("angle", "")[:80], b.get("tone", ""), b.get("urgency", ""),
        )

    log_agent_io(
        logger, agent="planner",
        inputs={"research": len(research), "trends": len(trends)},
        outputs={"briefs": [{"topic": b.get("topic", "")[:60], "type": b.get("draft_type")}
                             for b in briefs]},
    )
    return {"content_briefs": briefs}
