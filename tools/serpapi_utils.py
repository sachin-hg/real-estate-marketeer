"""
SerpAPI utilities — Google News and Google Trends for India.

Requires SERP_API_KEY in .env (serpapi.com, not serper.dev).
Both functions are optional: if the key is missing they return [].

Usage:
    from tools.serpapi_utils import get_serpapi_re_news, get_serpapi_google_trends_india
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

import aiohttp

logger = logging.getLogger(__name__)

_BASE = "https://serpapi.com/search.json"

# RE-specific query set for Google News
_RE_NEWS_QUERIES = [
    "RERA penalty builder India 2025",
    "real estate property price India 2025",
    "housing scheme government India 2025",
    "builder broker news India property",
    "PropTech NRI investment real estate India",
]


async def _serpapi_get(params: dict[str, Any], use_case: str = "") -> dict:
    """Single async GET to SerpAPI. Returns parsed JSON or {}."""
    import time as _time
    from tools.run_logger import log_api_call

    # Mask API key in logged params
    logged_params = {k: ("***" if k == "api_key" else v) for k, v in params.items()}
    t0 = _time.perf_counter()

    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(_BASE, params=params, timeout=aiohttp.ClientTimeout(total=20)) as resp:
                elapsed = (_time.perf_counter() - t0) * 1000
                resp.raise_for_status()
                data = await resp.json()
                # Count results
                count = (
                    len(data.get("news_results", []))
                    or len(data.get("trending_searches", []))
                    or len(data.get("organic_results", []))
                )
                log_api_call(
                    logger,
                    agent="serpapi",
                    api_name="serpapi",
                    endpoint=_BASE,
                    params=logged_params,
                    response=data,
                    result_count=count,
                    status="ok",
                    http_status=resp.status,
                    elapsed_ms=elapsed,
                    use_case=use_case or f"SerpAPI engine={params.get('engine','?')}",
                )
                return data
        except Exception as exc:
            elapsed = (_time.perf_counter() - t0) * 1000
            logger.warning("SerpAPI request failed: %s", exc)
            log_api_call(
                logger,
                agent="serpapi",
                api_name="serpapi",
                endpoint=_BASE,
                params=logged_params,
                response=None,
                result_count=0,
                status="error",
                error=str(exc),
                elapsed_ms=elapsed,
                use_case=use_case or f"SerpAPI engine={params.get('engine','?')}",
            )
            return {}


async def get_serpapi_re_news(api_key: str) -> list[dict]:
    """
    Fetch real estate / RERA / builder / broker news from India via SerpAPI Google News.
    Runs multiple targeted queries in parallel and deduplicates by URL.
    Returns a list of dicts: {title, url, snippet, source, date}
    """
    if not api_key:
        return []

    tasks = [
        _serpapi_get(
            {"engine": "google_news", "q": q, "gl": "in", "hl": "en", "api_key": api_key},
            use_case=f"SerpAPI Google News (India RE): {q}",
        )
        for q in _RE_NEWS_QUERIES
    ]
    responses = await asyncio.gather(*tasks, return_exceptions=True)

    seen_urls: set[str] = set()
    results: list[dict] = []
    for resp in responses:
        if isinstance(resp, Exception):
            continue
        for item in resp.get("news_results", [])[:6]:   # max 6 per query
            url = item.get("link", "")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            source_info = item.get("source", {})
            results.append({
                "title":   item.get("title", ""),
                "url":     url,
                "snippet": item.get("snippet", item.get("description", ""))[:300],
                "source":  source_info.get("name", "") if isinstance(source_info, dict) else str(source_info),
                "date":    item.get("date", ""),
            })
            if len(results) >= 20:   # hard cap across all queries
                break
        if len(results) >= 20:
            break

    logger.info("SerpAPI Google News: %d unique India RE articles", len(results))
    return results


async def get_serpapi_google_trends_india(api_key: str) -> list[dict]:
    """
    Fetch trending Google searches in India right now via SerpAPI.
    Falls back cleanly if key is missing or API fails.

    Returns a list of dicts matching the same schema as pytrends output:
      {hashtag, raw_term, volume, platform, context, rank}
    """
    if not api_key:
        return []

    data = await _serpapi_get(
        {"engine": "google_trends_trending_now", "geo": "IN", "api_key": api_key},
        use_case="SerpAPI Google Trends Trending Now (India, last 24h)",
    )

    trends: list[dict] = []
    for i, item in enumerate(data.get("trending_searches", [])[:20], 1):
        query = item.get("query", "")
        if not query:
            continue
        vol = item.get("search_volume", 0) or 0
        pct = item.get("increase_percentage", 0) or 0
        categories = ", ".join(c["name"] for c in item.get("categories", [])[:2])
        context = (
            f"Trending in India: {query}"
            + (f" — {vol:,} searches" if vol else "")
            + (f", +{pct}% increase" if pct else "")
            + (f" [{categories}]" if categories else "")
        )
        trends.append({
            "hashtag":  f"#{query.replace(' ', '')}",
            "raw_term": query,
            "volume":   "high" if vol >= 100_000 else "medium",
            "platform": "google",
            "context":  context[:200],
            "rank":     i,
        })

    logger.info("SerpAPI Google Trends: %d trending India searches", len(trends))
    return trends
