"""
Topic Trend Researcher — viral/social context for the Slack-triggered direct pipeline.

Takes the raw user topic and produces TrendItem data using Serper news (if configured)
or Tavily as fallback, then has Claude craft Hinglish creative hooks.
"""
from __future__ import annotations

import json
import logging
import re

import anthropic

from config import get_settings
from models.state import WorkflowState
from tools.web_search import serper_news_search, web_search_async

logger = logging.getLogger(__name__)

SYSTEM = """You are a viral content strategist for Housing.com India.

Given a topic and news context, produce trend items with Zomato-style Housing.com hooks.

Return a JSON object:
{
  "trends": [
    {
      "hashtag": "#ExactHashtag",
      "volume": "high|medium|rising",
      "platform": "google|twitter|instagram",
      "context": "what the trend is about in 1 sentence",
      "creative_hook": "punchy Hinglish Housing.com post idea",
      "city_hint": "city name if city-specific, else null",
      "tags": ["tag1", "tag2"]
    }
  ]
}

RULES:
- Generate 2-5 trend items
- creative_hook: find HOME/REAL ESTATE angle INSIDE the event (Zomato style)
- Use actual hashtags people are using for this event
- tags: cricket, sports, bollywood, celebrity, viral, finance, ipo, investment,
  homeloan, emi, tech, ai, jobs, layoffs, weather, monsoon, infrastructure,
  luxury, festival, delhi, mumbai, bengaluru, noida, pune, hyderabad, chennai

Return ONLY valid JSON."""


def _detect_url(text: str) -> str | None:
    match = re.search(r"https?://[^\s]+", text)
    return match.group(0) if match else None


async def topic_trend_researcher_node(state: WorkflowState) -> dict:
    """LangGraph node: produce TrendItems from a user-supplied topic."""
    topic = state.get("slack_topic") or state.get("topic_hint") or ""
    if not topic:
        logger.warning("topic_trend_researcher: no topic — returning empty trends")
        return {"trends": []}

    logger.info("topic_trend_researcher: researching topic='%s'", topic[:80])
    settings = get_settings()

    # Prefer Serper for fresh social signals; fall back to Tavily
    news_items: list[dict] = []
    if settings.serper_api_key:
        try:
            news_items = await serper_news_search(topic, settings.serper_api_key, num=6)
        except Exception as exc:
            logger.warning("topic_trend_researcher: Serper failed (%s) — falling back to Tavily", exc)

    if not news_items:
        results = await web_search_async(
            f"{topic} viral trending India social media 2025", max_results=5)
        news_items = [{"title": r.get("title", ""), "snippet": r.get("content", "")[:200]}
                      for r in results]

    ctx_lines = [
        f"{n.get('title','')} — {n.get('snippet', n.get('content',''))[:150]}"
        for n in news_items[:8]
    ]
    context_block = "\n".join(ctx_lines) or "No news context found."

    aclient = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    user_msg = f"""TOPIC: {topic}

NEWS CONTEXT (social/viral angle):
{context_block}

Generate the trends JSON for this topic."""

    response = await aclient.messages.create(
        model=settings.model_balanced,
        max_tokens=1500,
        system=SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )
    raw = response.content[0].text.strip()

    from tools.json_utils import extract_json
    data = extract_json(raw)
    trends = data.get("trends", []) if isinstance(data, dict) else []
    for t in trends:
        t.setdefault("city_hint", None)
        t.setdefault("tags", [])

    logger.info("topic_trend_researcher: '%s' → %d trends", topic[:60], len(trends))
    return {"trends": trends}
