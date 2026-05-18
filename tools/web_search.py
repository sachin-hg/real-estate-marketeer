from __future__ import annotations

import logging
from typing import Optional

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
) -> list[dict]:
    """
    Search the web via Tavily and return a list of result dicts.
    Each result has: title, url, content (snippet), score, published_date.
    """
    try:
        client = _get_client()
        kwargs: dict = {
            "query": query,
            "max_results": max_results,
            "search_depth": "advanced",
        }
        if include_domains:
            kwargs["include_domains"] = include_domains

        response = client.search(**kwargs)
        results = response.get("results", [])
        logger.debug("web_search '%s' → %d results", query, len(results))
        return results

    except Exception as exc:
        logger.error("web_search failed for '%s': %s", query, exc)
        return []


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
