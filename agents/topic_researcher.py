"""
Topic Researcher — RE news deep-dive for the Slack-triggered direct pipeline.

Takes the raw user topic and produces structured NewsItem research via Tavily +
Claude, exactly as the automated researcher node does for scheduled runs.
"""
from __future__ import annotations

import json
import logging
import re

import anthropic

from config import get_settings
from models.state import WorkflowState
from tools.web_search import web_search_async

logger = logging.getLogger(__name__)

SYSTEM = """You are a real estate research assistant for Housing.com India.

Given a topic and web search results, produce a structured list of real estate
research items that the content team can use to create news articles and posts.

Return a JSON object:
{
  "research": [
    {
      "headline": "clear news headline",
      "source": "publication name",
      "url": "source URL or empty string",
      "summary": "2-3 sentence summary of the RE angle",
      "relevance": "why this matters for housing.com audience"
    }
  ]
}

RULES:
- Generate 1-4 research items with genuine RE angles
- If the topic has no RE news angle, return {"research": []}
- Focus on: RERA, builder launches, price data, policy, infra, city markets
- Use the web context provided; do not invent facts

Return ONLY valid JSON."""


def _detect_url(text: str) -> str | None:
    match = re.search(r"https?://[^\s]+", text)
    return match.group(0) if match else None


async def topic_researcher_node(state: WorkflowState) -> dict:
    """LangGraph node: produce research NewsItems from a user-supplied topic."""
    topic = state.get("slack_topic") or state.get("topic_hint") or ""
    if not topic:
        logger.warning("topic_researcher: no topic — returning empty research")
        return {"research": []}

    logger.info("topic_researcher: researching topic='%s'", topic[:80])
    settings = get_settings()

    web_context: list[dict] = []
    url = _detect_url(topic)
    if url:
        results = await web_search_async(url, max_results=3)
        web_context.extend(results)

    results = await web_search_async(f"{topic} real estate India 2025", max_results=5)
    web_context.extend(results)

    ctx_lines = []
    for r in web_context[:8]:
        ctx_lines.append(
            f"[{r.get('url','')}] {r.get('title','')}: {r.get('content','')[:200]}")
    context_block = "\n".join(ctx_lines) or "No web context found."

    aclient = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    user_msg = f"""TOPIC: {topic}

WEB CONTEXT:
{context_block}

Generate the research JSON for this topic."""

    response = await aclient.messages.create(
        model=settings.model_balanced,
        max_tokens=1500,
        system=SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )
    raw = response.content[0].text.strip()

    from tools.json_utils import extract_json
    data = extract_json(raw)
    research = data.get("research", []) if isinstance(data, dict) else []

    logger.info("topic_researcher: '%s' → %d research items", topic[:60], len(research))
    return {"research": research}
