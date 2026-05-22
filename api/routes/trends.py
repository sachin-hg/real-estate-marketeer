from __future__ import annotations

import logging
import time
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/trends", tags=["trends"])

# Module-level cache: (timestamp, data)
_trends_cache: tuple[float, list] = (0.0, [])
_CACHE_TTL = 300  # 5 minutes

_PLATFORM_MAP = {
    "google_trends":    "google",
    "youtube_trending": "youtube",
    "reddit_viral":     "reddit",
    "twitter_trends":   "twitter",
}


def _flatten(raw) -> list[dict]:
    """Convert fetch_all_trends() dict OR already-flat list into a list[dict] with platform field."""
    if isinstance(raw, list):
        return raw
    result: list[dict] = []
    for key, items in raw.items():
        if not isinstance(items, list):
            continue
        plat = _PLATFORM_MAP.get(key, "google")
        for item in items:
            if isinstance(item, dict):
                entry = dict(item)
                entry.setdefault("platform", plat)
                result.append(entry)
    return result


@router.get("/live")
def get_live_trends():
    global _trends_cache
    now = time.time()
    cached_at, cached_data = _trends_cache
    if now - cached_at < _CACHE_TTL and cached_data:
        return {"cached": True, "fetched_at": cached_at, "trends": cached_data}

    try:
        from tools.social_trends import fetch_all_trends
        raw = fetch_all_trends()
        data = _flatten(raw)

        # Fallback: if no social API keys are configured, pull from Tavily web search
        if not data:
            logger.info("No social API sources active — falling back to Tavily web search for live signals")
            from tools.web_search import web_search
            results = web_search(
                "viral trending India news today social media",
                max_results=15,
                search_depth="basic",
                days_back=3,
            )
            data = [
                {
                    "hashtag": r.get("title", f"Trend {i + 1}")[:80],
                    "title": r.get("title", ""),
                    "volume": "medium",
                    "platform": "google",   # shown in Google tab in the UI
                    "context": r.get("content", "")[:200],
                    "url": r.get("url", ""),
                }
                for i, r in enumerate(results)
                if r.get("title")
            ]

        _trends_cache = (time.time(), data)
        return {"cached": False, "fetched_at": _trends_cache[0], "trends": data}
    except Exception as exc:
        logger.error("fetch_all_trends failed: %s", exc)
        return {"cached": False, "fetched_at": 0, "trends": [], "error": str(exc)}


class SearchBody(BaseModel):
    query: Optional[str] = None       # at least one of query / domains must be provided
    domains: Optional[list[str]] = None
    max_results: int = 10


@router.post("/search")
def search_trends(body: SearchBody):
    if not body.query and not body.domains:
        return {"query": "", "results": [], "error": "Provide at least a query or a domain"}

    # When only domains are given, use a generic recency query so Tavily has something to search
    effective_query = body.query or "latest news"

    try:
        from tools.web_search import web_search
        results = web_search(
            effective_query,
            include_domains=body.domains or None,
            max_results=body.max_results,
        )
        display_query = body.query or f"latest from {', '.join(body.domains or [])}"
        return {"query": display_query, "results": results}
    except Exception as exc:
        logger.error("web_search failed: %s", exc)
        return {"query": effective_query, "results": [], "error": str(exc)}
