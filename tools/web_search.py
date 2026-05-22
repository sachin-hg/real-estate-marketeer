from __future__ import annotations

import asyncio
import logging
from typing import Optional

import aiohttp
from tavily import TavilyClient

from config import get_settings

logger = logging.getLogger(__name__)

_client: Optional[TavilyClient] = None


def _get_client() -> TavilyClient:
    global _client
    if _client is None:
        _client = TavilyClient(api_key=get_settings().tavily_api_key)
    return _client


def web_search(
    query: str,
    include_domains: list[str] | None = None,
    days_back: int = 7,
    max_results: int = 5,
    search_depth: str | None = None,
    _use_case: str = "",
) -> list[dict]:
    """
    Search the web via Tavily and return a list of result dicts.
    Each result has: title, url, content (snippet), score, published_date.
    search_depth: "basic" (cheap, ~1 credit) or "advanced" (thorough, ~5 credits).
    Defaults to config.tavily_search_depth.
    """
    from tools.run_logger import log_api_call, Timer
    import time as _time

    try:
        client = _get_client()
        depth = search_depth or get_settings().tavily_search_depth
        params: dict = {
            "query": query,
            "max_results": max_results,
            "search_depth": depth,
            "days": days_back,
        }
        if include_domains:
            params["include_domains"] = include_domains

        t0 = _time.perf_counter()
        response = client.search(**params)
        elapsed = (_time.perf_counter() - t0) * 1000
        results = response.get("results", [])
        logger.debug("web_search '%s' depth=%s → %d results", query, depth, len(results))

        log_api_call(
            logger,
            agent="web_search",
            api_name="tavily",
            endpoint="https://api.tavily.com/search",
            params=params,
            response=results,
            result_count=len(results),
            status="ok",
            elapsed_ms=elapsed,
            use_case=_use_case or f"Tavily search: {query[:120]}",
        )
        return results

    except Exception as exc:
        logger.error("web_search failed for '%s': %s", query, exc)
        log_api_call(
            logger,
            agent="web_search",
            api_name="tavily",
            endpoint="https://api.tavily.com/search",
            params={"query": query, "max_results": max_results},
            response=None,
            result_count=0,
            status="error",
            error=str(exc),
            elapsed_ms=0,
            use_case=_use_case or f"Tavily search: {query[:120]}",
        )
        return []


async def serper_news_search(query: str, api_key: str, num: int = 5) -> list[dict]:
    """Fetch fresh India news from Serper /news — faster than Tavily for trending signals."""
    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://google.serper.dev/news",
            headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
            json={"q": query, "num": num, "gl": "in", "hl": "en"},
        ) as resp:
            resp.raise_for_status()
            data = await resp.json()
    return data.get("news", [])


async def web_search_async(query: str, _use_case: str = "", **kwargs) -> list[dict]:
    """Async wrapper for sync web_search — runs in thread executor to avoid blocking."""
    import contextvars
    loop = asyncio.get_running_loop()
    ctx = contextvars.copy_context()
    return await loop.run_in_executor(None, ctx.run, lambda: web_search(query, _use_case=_use_case, **kwargs))


# Curated credible real estate sources for the researcher agent
RE_CREDIBLE_DOMAINS = [
    "economictimes.indiatimes.com",
    "hindustantimes.com",
    "housing.com",
    "anarock.com",
    "jll.co.in",
    "credai.org",
    "99acres.com",
    "magicbricks.com",
    "pib.gov.in",
    "mhupa.gov.in",
    "rera.maharashtra.gov.in",
    "hrera.org.in",
    "proptigernews.com",
    "livemint.com",
    "businesstoday.in",
]

RE_SEARCH_QUERIES = [
    "India real estate news this week latest developments",
    "RERA orders penalties builder India 2025",
    "stamp duty circle rate changes India cities 2025",
    "new housing project launch DLF Godrej Prestige Lodha Sobha",
    "affordable housing PMAY scheme update 2025",
    "luxury housing demand Mumbai Bangalore Delhi NCR",
    "real estate price trends India top cities",
    "NRI property investment India 2025",
]
