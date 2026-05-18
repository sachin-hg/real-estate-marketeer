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


@router.get("/live")
def get_live_trends():
    global _trends_cache
    now = time.time()
    cached_at, cached_data = _trends_cache
    if now - cached_at < _CACHE_TTL and cached_data:
        return {"cached": True, "fetched_at": cached_at, "trends": cached_data}

    try:
        from tools.social_trends import fetch_all_trends
        data = fetch_all_trends()
        _trends_cache = (time.time(), data)
        return {"cached": False, "fetched_at": _trends_cache[0], "trends": data}
    except Exception as exc:
        logger.error("fetch_all_trends failed: %s", exc)
        return {"cached": False, "fetched_at": 0, "trends": [], "error": str(exc)}


class SearchBody(BaseModel):
    query: str
    domains: Optional[list[str]] = None
    max_results: int = 10


@router.post("/search")
def search_trends(body: SearchBody):
    try:
        from tools.web_search import web_search
        results = web_search(body.query, max_results=body.max_results)
        return {"query": body.query, "results": results}
    except Exception as exc:
        logger.error("web_search failed: %s", exc)
        return {"query": body.query, "results": [], "error": str(exc)}
