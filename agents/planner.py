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

Housing.com is a TREND-JACKING brand — we ride viral moments with a genuine real estate angle.
High-volume and rising trends are top priority, but the RE connection must feel natural and intentional.

QUALITY GATE — applies to ALL items regardless of volume:
  The real estate angle must be MEANINGFUL — a genuine metaphor, situation, or wordplay where
  home/property/housing feels natural inside the story, not bolted on.
  Examples of GOOD angles: "18-year wait → ghar kab loge?", "AI layoffs → stable ghar chahiye",
  "48°C heatwave → AC on, ghar baithe property dekho", "tax-free budget → ghar lene ka bahana kya?"
  Examples of BAD angles (REJECT these): any trend where you'd be forced to say "…and buy a house!"
  with no logical bridge.

  Volume signals how hard you should TRY to find an angle — it does NOT lower the quality bar:
  • volume=HIGH   → make a strong effort to find an angle; skip only if truly impossible
  • volume=RISING → same as HIGH — these are time-sensitive; mark urgency as "rising fast, publish within hours"
  • volume=MEDIUM → standard effort; skip if the angle feels forced
  • Research items → needs genuine RE news angle (RERA, policy, builder, price data)

PLATFORM TARGETING:
  • source_platform is the PRIMARY signal — the brief's target_platforms should always include it.
  • Cross-platform targeting is encouraged when content naturally fits multiple platforms.
  • source_platform=twitter  → always include "twitter"; add "instagram" if the content has visual/lifestyle appeal
  • source_platform=instagram → always include "instagram"; add "twitter" if the hook is punchy enough for text
  • source_platform=google   → choose by content type (see decision rules below)
  • A brief can target 1, 2, or 3 platforms — pick wherever the content genuinely fits, not just to pad reach

FREQUENCY CAP — max 3 briefs per platform (daily posting limit):
  Count how many briefs you've already assigned to each platform.
  Once a platform reaches 3, do not add more briefs that exclusively target it.
  A brief targeting ["twitter","instagram"] counts as 1 toward each platform's quota.
  Prioritise HIGH-volume and RISING trends first within each platform's quota.

DECISION RULES:
  - Viral/entertainment/sports/meme → social; lead with source_platform, add others if fit
  - IT/AI/layoffs/career/startup → social, ["twitter","linkedin"]
  - RE policy/RERA/builder/price news → news, ["housing_news"]  (+ social brief if viral angle exists)
  - Rich explainer (budget, market data, city guide) → news, ["housing_news","youtube"]
  - City-specific price/infra news → social (if witty angle) + news (if substantive data)
  - LinkedIn/work-culture debate → social, ["linkedin"] only

OUTPUT FORMAT — return a JSON object with a single "briefs" array:
{
  "briefs": [
    {
      "topic": "one-line topic description",
      "angle": "the specific RE/home angle to use — must be meaningful, not forced",
      "draft_type": "social",
      "target_platforms": ["twitter", "instagram"],
      "tone": "hinglish_viral",
      "city_hint": "bengaluru or null",
      "urgency": "why this is timely",
      "seo_keywords": [],
      "source_summary": "1-2 sentence context for the creative agent",
      "trend_hashtag": "#OriginalTrendingHashtag or empty string",
      "source_platform": "twitter|instagram|google|research"
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
        return [{"headline": r.get("headline", ""), "summary": r.get("summary", "")[:200],
                 "source_platform": "research"}
                for r in items]

    def _compact_trends(items: list[dict]) -> list[dict]:
        return [
            {
                "rank": i + 1,
                "hashtag": t.get("hashtag", ""),
                "volume": t.get("volume", "medium"),       # HIGH → must get a brief
                "platform": t.get("platform", "google"),   # drives target_platforms selection
                "context": t.get("context", ""),
                "creative_hook": t.get("creative_hook", ""),
                "city_hint": t.get("city_hint"),
                "tags": t.get("tags", []),
            }
            for i, t in enumerate(items)
        ]

    user_msg = f"""Here are today's inputs. Generate ContentBriefs following the QUALITY GATE and PLATFORM TARGETING rules.

━━━ REAL ESTATE RESEARCH ({len(research)} stories) ━━━
{json.dumps(_compact_research(research), indent=2)}

━━━ TRENDING TOPICS ({len(trends)} trends) ━━━
{json.dumps(_compact_trends(trends), indent=2)}

REMINDER:
- HIGH and RISING volume trends get priority but still need a genuine RE angle.
- source_platform is the primary target; add other platforms where content genuinely fits.
- Set trend_hashtag = the exact hashtag from the trend item.
- Max 3 briefs per platform (frequency cap — honour this in your output)."""

    logger.info("Planner: evaluating %d research + %d trends", len(research), len(trends))

    result = await call_json_async(
        tier="balanced",
        system=SYSTEM,
        user_msg=user_msg,
        max_tokens=3500,
        log_label="planner",
    )

    MAX_PER_PLATFORM = 3

    briefs_raw = result.get("briefs", []) if isinstance(result, dict) else []
    briefs_parsed: list[ContentBrief] = []
    for b in briefs_raw:
        if not isinstance(b, dict):
            continue
        b.setdefault("seo_keywords", [])
        b.setdefault("city_hint", None)
        b.setdefault("source_summary", "")
        b.setdefault("trend_hashtag", "")
        b.setdefault("source_platform", "google")
        dt = b.get("draft_type", "").lower().strip().replace("_", " ").replace("-", " ")
        if "social" in dt:
            b["draft_type"] = "social"
        elif "news" in dt:
            b["draft_type"] = "news"
        else:
            logger.warning("Planner: unknown draft_type %r in brief, defaulting to 'social'", b.get("draft_type"))
            b["draft_type"] = "social"
        briefs_parsed.append(b)

    # Enforce per-platform frequency cap (max 3 briefs per platform per run).
    # A brief targeting ["twitter","instagram"] counts as 1 toward each platform's quota.
    # Briefs are processed in order (LLM should prioritise HIGH > RISING > MEDIUM).
    from collections import defaultdict
    platform_counts: dict[str, int] = defaultdict(int)
    briefs: list[ContentBrief] = []
    dropped_over_cap: list[str] = []

    for b in briefs_parsed:
        platforms = b.get("target_platforms") or []
        # Include brief if at least one target platform is still under quota
        if any(platform_counts[p] < MAX_PER_PLATFORM for p in platforms):
            briefs.append(b)
            for p in platforms:
                platform_counts[p] += 1
        else:
            dropped_over_cap.append(
                f"{b.get('trend_hashtag') or b.get('topic','?')[:30]} → {platforms}"
            )

    if dropped_over_cap:
        logger.info("Planner: dropped %d brief(s) over per-platform cap (%d): %s",
                    len(dropped_over_cap), MAX_PER_PLATFORM, dropped_over_cap)

    social_briefs = [b for b in briefs if b.get("draft_type") == "social"]
    news_briefs = [b for b in briefs if b.get("draft_type") == "news"]
    n_social = len(social_briefs)
    n_news = len(news_briefs)
    logger.info("planner: %d briefs from %d inputs (social=%d, news=%d) | platform_counts=%s",
                len(briefs), len(research) + len(trends), n_social, n_news,
                dict(platform_counts))
    for i, b in enumerate(briefs, 1):
        logger.info(
            "  brief #%d [%s → %s] %s | tone=%s | hashtag=%s | src=%s",
            i, b.get("draft_type", "?"), ",".join(b.get("target_platforms", [])),
            b.get("angle", "")[:80], b.get("tone", ""),
            b.get("trend_hashtag", ""), b.get("source_platform", ""),
        )

    log_agent_io(
        logger, agent="planner",
        inputs={"research": len(research), "trends": len(trends)},
        outputs={"briefs": [{"topic": b.get("topic", "")[:60], "type": b.get("draft_type")}
                             for b in briefs]},
    )
    return {"content_briefs": briefs}
