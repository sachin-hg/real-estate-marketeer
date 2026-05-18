"""
Topic Enricher agent.

Converts a raw user-supplied topic (text, URL, or trending event description)
into the synthetic research + trends that creative_marketeer normally receives
from the researcher + trend_researcher nodes.

Used exclusively in the Slack-triggered "direct" pipeline — the automated
research and trend-fetching phases are skipped and replaced by this single node.
"""
from __future__ import annotations

import json
import logging
import re

import anthropic

from config import get_settings
from models.state import WorkflowState
from tools.web_search import web_search

logger = logging.getLogger(__name__)

ENRICHER_SYSTEM = """You are a research assistant for Housing.com India's content team.

A marketing team member has provided a topic, article, URL, or trend description.
Your job: turn it into structured research and trend data so the creative team
can immediately start writing posts — no further research needed.

Return a JSON object with two keys:

{
  "research": [
    {
      "headline": "...",
      "source": "...",
      "url": "...",
      "summary": "...",
      "relevance": "why this matters for housing.com real estate audience"
    }
  ],
  "trends": [
    {
      "hashtag": "#ExactHashtag",
      "volume": "high|medium|rising",
      "platform": "google|twitter|instagram",
      "context": "what the trend is about in 1 sentence",
      "creative_hook": "punchy Hinglish Housing.com post idea using this trend",
      "city_hint": "city name if city-specific, else null",
      "tags": ["tag1", "tag2"]
    }
  ]
}

RULES:
- Generate 1-3 research items if the topic is news/article/policy (RE-relevant)
- Generate 2-5 trend items for any topic (even non-RE topics — find the Housing.com angle)
- creative_hook should follow the Zomato style: find the HOME/REAL ESTATE angle INSIDE the event
- If the topic is purely social/viral/entertainment, research can be [] (empty)
- If the topic is purely RE news, trends can have 1-2 items mapping the news to a viral hook
- Use actual hashtags people are using for the event (e.g. #IPLFinal2025 not #IPL)
- tags vocabulary: cricket, sports, bollywood, music, comedy, celebrity, viral, politics,
  elections, india, finance, ipo, investment, homeloan, emi, tax, budget, tech, ai, jobs,
  layoffs, weather, monsoon, heatwave, infrastructure, luxury, festival, wedding,
  delhi, mumbai, bengaluru, noida, gurgaon, pune, hyderabad, chennai, kolkata

Return ONLY valid JSON — no prose, no markdown."""


def _detect_url(text: str) -> str | None:
    """Extract the first URL from the text, if any."""
    match = re.search(r"https?://[^\s]+", text)
    return match.group(0) if match else None


def topic_enricher_node(state: WorkflowState) -> dict:
    """LangGraph node: synthesise research + trends from a raw Slack topic."""
    topic = state.get("slack_topic") or state.get("topic_hint") or ""
    if not topic:
        logger.warning("topic_enricher: no topic provided — returning empty research")
        return {"research": [], "trends": []}

    logger.info("topic_enricher: enriching topic='%s'", topic[:80])

    # Fetch web context for the topic (and the URL if one is embedded)
    web_context: list[dict] = []
    url = _detect_url(topic)
    if url:
        results = web_search(url, max_results=3)
        web_context.extend(results)

    results = web_search(f"{topic} India 2025", max_results=5)
    web_context.extend(results)

    # Format context compactly for the prompt
    ctx_lines = []
    for r in web_context[:8]:
        title = r.get("title", "")
        snippet = r.get("content", "")[:200]
        src = r.get("url", "")
        ctx_lines.append(f"[{src}] {title}: {snippet}")
    context_block = "\n".join(ctx_lines) or "No additional web context found."

    client = anthropic.Anthropic(api_key=get_settings().anthropic_api_key)
    user_msg = f"""TOPIC PROVIDED BY MARKETING TEAM:
{topic}

WEB CONTEXT (search results):
{context_block}

Generate the research + trends JSON for this topic."""

    response = client.messages.create(
        model=get_settings().model_balanced,
        max_tokens=2000,
        system=ENRICHER_SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )
    raw = response.content[0].text.strip()

    from tools.json_utils import extract_json
    data = extract_json(raw)
    if not isinstance(data, dict):
        logger.error("topic_enricher: failed to parse JSON — raw=%s", raw[:300])
        return {"research": [], "trends": []}

    research = data.get("research", [])
    trends   = data.get("trends", [])

    # Normalise trend items (same defaults as social_trend_researcher)
    for t in trends:
        t.setdefault("city_hint", None)
        t.setdefault("tags", [])

    logger.info(
        "topic_enricher: topic='%s' → %d research items, %d trends",
        topic[:60], len(research), len(trends),
    )
    return {"research": research, "trends": trends}
