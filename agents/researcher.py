from __future__ import annotations

import json
import logging

import anthropic

from config import get_settings
from models.state import NewsItem, WorkflowState
from tools.web_search import RE_CREDIBLE_DOMAINS, RE_SEARCH_QUERIES, web_search

logger = logging.getLogger(__name__)

TOOLS = [
    {
        "name": "web_search",
        "description": (
            "Search the web for the latest real estate news and developments in India. "
            "Prefer credible sources: government portals, RERA, top business newspapers."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "include_domains": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Restrict results to these domains",
                },
                "days_back": {
                    "type": "integer",
                    "default": 7,
                    "description": "Only return results from the last N days",
                },
                "max_results": {"type": "integer", "default": 5},
            },
            "required": ["query"],
        },
    }
]

SYSTEM = f"""You are a senior real estate research analyst for Housing.com, India's \
leading property platform. Your job is to find the most newsworthy and audience-relevant \
real estate developments from the past 7 days.

Focus areas (in priority order):
1. RERA orders, penalties, project registrations
2. Government policy: stamp duty changes, circle rates, PMAY, budget housing schemes
3. Major builder activity: DLF, Godrej Properties, Prestige, Lodha, Sobha, Brigade, Puravankara
4. Price movements in tier-1 cities: Mumbai, Delhi NCR, Bengaluru, Hyderabad, Pune, Chennai
5. Infrastructure impacting real estate: metro lines, highways, smart city projects
6. NRI investment news, PropTech, co-living, warehousing

Preferred domains: {', '.join(RE_CREDIBLE_DOMAINS[:8])}

EFFICIENCY RULE: Stop searching as soon as you have 6 or more unique, high-quality stories.
Do not search more than 5 times total.

After researching, return a JSON array of the top 8 stories. Each item must match:
{{
  "headline": "...",
  "source": "publication name",
  "url": "...",
  "summary": "2-sentence summary",
  "relevance": "why this matters for Housing.com's buyer/seller audience"
}}

Return ONLY the JSON array, no prose, no markdown fences."""


def _fetch_serpapi_news_sync(api_key: str) -> list[dict]:
    """Run the async SerpAPI news fetch synchronously (in a fresh event loop)."""
    import asyncio
    from tools.serpapi_utils import get_serpapi_re_news
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(get_serpapi_re_news(api_key))
    finally:
        loop.close()


def researcher_node(state: WorkflowState) -> dict:
    """LangGraph node: runs the real estate researcher agent."""
    from tools.run_logger import Timer, log_llm_call, log_tool_call, log_agent_io
    settings = get_settings()
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    hint = state.get("topic_hint")

    # Pre-fetch SerpAPI Google News for India RE (parallel signal, no extra LLM cost)
    serpapi_news: list[dict] = []
    if settings.serp_api_key:
        try:
            serpapi_news = _fetch_serpapi_news_sync(settings.serp_api_key)
            logger.info("Researcher: SerpAPI pre-fetched %d India RE articles", len(serpapi_news))
        except Exception as exc:
            logger.warning("Researcher: SerpAPI pre-fetch failed: %s", exc)

    serpapi_context = ""
    if serpapi_news:
        lines = [f"  [{i+1}] {a['title']} ({a['source']}, {a['date']})\n      {a['snippet'][:200]}"
                 for i, a in enumerate(serpapi_news[:12])]
        serpapi_context = (
            "\n\nPRE-FETCHED NEWS via SerpAPI Google News (use these as seed stories — "
            "verify or expand with web_search):\n" + "\n".join(lines)
        )

    base_msg = (
        f"Research the latest Indian real estate developments. Focus especially on: {hint}. "
        if hint else "Research the latest Indian real estate developments. "
    )
    user_msg = base_msg + "Use multiple searches. Cover RERA, policy, builders, and market trends." + serpapi_context

    logger.info("Researcher: starting web search loop | model=%s | topic_hint=%s | serpapi=%d",
                settings.model_balanced, hint or "none", len(serpapi_news))

    messages = [{"role": "user", "content": user_msg}]
    round_num = 0

    for round_num in range(5):  # max 5 tool-use rounds (stop early if ≥6 stories found)
        with Timer() as t:
            response = client.messages.create(
                model=settings.model_balanced,
                max_tokens=4096,
                system=SYSTEM,
                tools=TOOLS,
                messages=messages,
            )

        logger.debug("Researcher round %d | stop_reason=%s | elapsed_ms=%.0f",
                     round_num + 1, response.stop_reason, t.elapsed_ms)

        if response.stop_reason == "end_turn":
            raw = _extract_text(response)
            log_llm_call(
                logger,
                agent="researcher/end_turn",
                model=settings.model_balanced,
                system_prompt=SYSTEM,
                user_message=user_msg,
                response_text=raw,
                stop_reason=response.stop_reason,
                elapsed_ms=t.elapsed_ms,
                extra={"round": round_num + 1,
                       "input_tokens": response.usage.input_tokens,
                       "output_tokens": response.usage.output_tokens},
            )
            items = _parse_news(raw)
            logger.info("Researcher: found %d stories after %d rounds",
                        len(items), round_num + 1)
            log_agent_io(
                logger,
                agent="researcher",
                inputs={"topic_hint": hint, "rounds": round_num + 1},
                outputs={"stories": [i.get("headline", "") for i in items]},
            )
            return {"research": items}

        tool_results = []
        for block in response.content:
            if block.type == "tool_use" and block.name == "web_search":
                logger.info("Researcher: web_search round=%d query=%r",
                            round_num + 1, block.input.get("query", ""))
                with Timer() as tsearch:
                    results = web_search(
                        **{**block.input, "search_depth": "advanced"},
                        _use_case=f"Researcher: {block.input.get('query', '')[:120]}",
                    )
                logger.debug("Researcher: web_search returned %d results", len(results))
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(results),
                })

        messages += [
            {"role": "assistant", "content": response.content},
            {"role": "user", "content": tool_results},
        ]

    logger.warning("Researcher: hit max rounds (%d), using partial results", round_num + 1)
    # Try to parse whatever the last assistant message said
    for msg in reversed(messages):
        if msg.get("role") == "assistant":
            for block in (msg["content"] if isinstance(msg["content"], list) else []):
                if hasattr(block, "text"):
                    items = _parse_news(block.text)
                    if items:
                        logger.info("Researcher: recovered %d stories from last partial response", len(items))
                        return {"research": items}
    return {"research": []}


def _extract_text(response) -> str:
    for block in response.content:
        if hasattr(block, "text"):
            return block.text
    return "[]"


def _parse_news(raw: str) -> list[NewsItem]:
    from tools.json_utils import extract_json
    data = extract_json(raw)
    if isinstance(data, list):
        return data[:8]
    logger.error("Failed to parse research JSON.\nRaw: %s", raw[:300])
    return []
