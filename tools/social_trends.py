"""
Trend data aggregator — four sources, all optional, all fail gracefully.

Sources (in order of signal quality for India trend-jacking):
  1. Google Trends (pytrends)   — top trending searches in India right now
  2. YouTube Trending India      — viral videos/Shorts driving reels/meme culture
  3. Reddit India communities    — community-surfaced viral moments, memes, discussions
  4. Apify / Twitter             — trending hashtags (needs APIFY_API_TOKEN)

Each source is independently gated: missing key / uninstalled package → skip + warn.
fetch_all_trends() always returns a valid dict regardless of which sources are live.
"""
from __future__ import annotations

import logging
import os
import time
from typing import Optional

from config import get_settings

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Google Trends (pytrends — no API key needed)
# ─────────────────────────────────────────────────────────────────────────────

def get_google_trending_searches(geo: str = "IN") -> list[dict]:
    """
    Top 20 trending Google searches in India right now.
    Tries pytrends first; falls back to SerpAPI if pytrends returns a 404 (Google blocks it).
    """
    try:
        from pytrends.request import TrendReq
        pt = TrendReq(hl="en-IN", tz=330, timeout=(10, 25))
        df = pt.trending_searches(pn="india" if geo == "IN" else geo.lower())
        results = []
        for i, row in df.iterrows():
            results.append({
                "hashtag": f"#{row[0].replace(' ', '')}",
                "raw_term": row[0],
                "volume": "high",
                "platform": "google",
                "context": f"Trending Google search in India: {row[0]}",
                "rank": int(i) + 1,
            })
        if results:
            logger.debug("Google Trends (pytrends): %d trending searches", len(results))
            return results[:20]
        raise ValueError("pytrends returned empty results")
    except Exception as exc:
        logger.warning("Google Trends (pytrends) failed: %s — trying SerpAPI fallback", exc)

    # Fallback: SerpAPI Google Trends (reliable, matches exact Google data)
    try:
        from config import get_settings
        import asyncio
        from tools.serpapi_utils import get_serpapi_google_trends_india
        api_key = get_settings().serp_api_key
        if not api_key:
            return []
        loop = asyncio.new_event_loop()
        try:
            results = loop.run_until_complete(get_serpapi_google_trends_india(api_key))
        finally:
            loop.close()
        return results[:20]
    except Exception as exc2:
        logger.warning("SerpAPI Google Trends fallback also failed: %s", exc2)
        return []


def get_google_interest(keywords: list[str], geo: str = "IN") -> dict:
    """Interest-over-time scores (0-100) for given keywords over the past 7 days."""
    try:
        from pytrends.request import TrendReq
        pt = TrendReq(hl="en-IN", tz=330, timeout=(10, 25))
        pt.build_payload(keywords[:5], geo=geo, timeframe="now 7-d")
        df = pt.interest_over_time()
        if df.empty:
            return {}
        return {kw: int(df[kw].mean()) for kw in keywords if kw in df.columns}
    except Exception as exc:
        logger.warning("Google interest lookup failed: %s", exc)
        return {}


# ─────────────────────────────────────────────────────────────────────────────
# 2. YouTube Trending India (YouTube Data API v3 — needs YOUTUBE_API_KEY)
# ─────────────────────────────────────────────────────────────────────────────

# Category IDs we care about for viral/trend-jacking content
_YT_CATEGORIES = {
    "all":           "",   # no filter — catches cross-category viral
    "sports":        "17",
    "entertainment": "24",
    "music":         "10",
    "news":          "25",
    "comedy":        "23",
}


def get_youtube_trending_india() -> list[dict]:
    """
    Top trending YouTube videos in India across key categories.
    Returns up to 30 unique videos sorted by view count.
    Each result: title, channel, video_id, url, views, category, published_at, tags.
    """
    from tools.run_logger import log_api_call
    settings = get_settings()
    if not settings.youtube_api_key:
        logger.info("YOUTUBE_API_KEY not set — skipping YouTube trending")
        return []

    t0 = time.perf_counter()
    try:
        from googleapiclient.discovery import build
        youtube = build("youtube", "v3", developerKey=settings.youtube_api_key,
                        cache_discovery=False)

        results: list[dict] = []
        seen_ids: set[str] = set()

        for cat_name, cat_id in _YT_CATEGORIES.items():
            try:
                kwargs: dict = {
                    "part": "snippet,statistics",
                    "chart": "mostPopular",
                    "regionCode": "IN",
                    "maxResults": 10,
                    "hl": "en_IN",
                }
                if cat_id:
                    kwargs["videoCategoryId"] = cat_id

                resp = youtube.videos().list(**kwargs).execute()
                for item in resp.get("items", []):
                    vid_id = item["id"]
                    if vid_id in seen_ids:
                        continue
                    seen_ids.add(vid_id)
                    sn = item["snippet"]
                    stats = item.get("statistics", {})
                    results.append({
                        "title": sn["title"],
                        "channel": sn["channelTitle"],
                        "video_id": vid_id,
                        "url": f"https://youtube.com/watch?v={vid_id}",
                        "views": int(stats.get("viewCount", 0)),
                        "likes": int(stats.get("likeCount", 0)),
                        "category": cat_name,
                        "published_at": sn.get("publishedAt", "")[:10],
                        "description": sn.get("description", "")[:200],
                        "tags": sn.get("tags", [])[:8],
                    })
            except Exception as cat_exc:
                logger.debug("YouTube category '%s' failed: %s", cat_name, cat_exc)

        results.sort(key=lambda x: x["views"], reverse=True)
        final = results[:30]
        elapsed = (time.perf_counter() - t0) * 1000
        logger.info("YouTube Trending: %d unique trending videos (India)", len(final))
        log_api_call(
            logger,
            agent="social_trends",
            api_name="youtube_data_v3",
            endpoint="https://www.googleapis.com/youtube/v3/videos",
            params={"chart": "mostPopular", "regionCode": "IN", "categories": list(_YT_CATEGORIES.keys())},
            response=final,
            result_count=len(final),
            status="ok",
            elapsed_ms=elapsed,
            use_case="YouTube Data API v3: most popular videos India (trend signals for content)",
        )
        return final

    except Exception as exc:
        elapsed = (time.perf_counter() - t0) * 1000
        logger.warning("YouTube Trending failed: %s", exc)
        log_api_call(
            logger, agent="social_trends", api_name="youtube_data_v3",
            endpoint="https://www.googleapis.com/youtube/v3/videos",
            params={"chart": "mostPopular", "regionCode": "IN"},
            response=None, result_count=0, status="error",
            error=str(exc), elapsed_ms=elapsed,
            use_case="YouTube Data API v3: most popular videos India",
        )
        return []


# ─────────────────────────────────────────────────────────────────────────────
# 3. Reddit India communities (PRAW — needs REDDIT_CLIENT_ID + SECRET)
# ─────────────────────────────────────────────────────────────────────────────

# Subreddits ordered by signal relevance for India viral/meme content
_REDDIT_SUBS = [
    "india",          # general India viral — high signal
    "bollywood",      # Bollywood, celeb, film trends
    "Cricket",        # cricket — massive in India
    "indiameme",      # memes spreading on Indian social media
    "indianews",      # breaking news India
    "mumbai",         # city-specific
    "delhi",
    "bangalore",
    "technology",     # AI, startup, layoff trends (India context)
    "personalfinance", # EMI, home loan, investment sentiment
]


def get_reddit_india_viral() -> list[dict]:
    """
    Hot posts from India-focused subreddits (last 24-48h surface).
    Returns up to 30 posts sorted by score (upvotes).
    Each result: subreddit, title, score, num_comments, url, flair.
    """
    settings = get_settings()
    if not settings.reddit_client_id or not settings.reddit_client_secret:
        logger.info("Reddit credentials not set — skipping Reddit viral fetch")
        return []

    t0 = time.perf_counter()
    try:
        import praw
        reddit = praw.Reddit(
            client_id=settings.reddit_client_id,
            client_secret=settings.reddit_client_secret,
            user_agent=settings.reddit_user_agent,
            ratelimit_seconds=2,
        )
        reddit.read_only = True

        results: list[dict] = []
        for sub_name in _REDDIT_SUBS:
            try:
                sub = reddit.subreddit(sub_name)
                for post in sub.hot(limit=8):
                    if post.stickied or post.score < 50:
                        continue
                    results.append({
                        "subreddit": f"r/{sub_name}",
                        "title": post.title,
                        "score": post.score,
                        "num_comments": post.num_comments,
                        "url": f"https://reddit.com{post.permalink}",
                        "flair": post.link_flair_text or "",
                        "is_video": post.is_video,
                        "created_utc": int(post.created_utc),
                    })
            except Exception as sub_exc:
                logger.debug("Reddit r/%s failed: %s", sub_name, sub_exc)

        results.sort(key=lambda x: x["score"], reverse=True)
        final = results[:30]
        elapsed = (time.perf_counter() - t0) * 1000
        logger.info("Reddit: %d hot posts from India subreddits", len(final))
        from tools.run_logger import log_api_call
        log_api_call(
            logger, agent="social_trends", api_name="reddit_praw",
            endpoint="https://oauth.reddit.com/r/{sub}/hot",
            params={"subreddits": _REDDIT_SUBS, "limit": 8},
            response=final, result_count=len(final), status="ok",
            elapsed_ms=elapsed,
            use_case="Reddit PRAW: hot posts from India subreddits (viral meme/trend signals)",
        )
        return final

    except Exception as exc:
        elapsed = (time.perf_counter() - t0) * 1000
        logger.warning("Reddit viral fetch failed: %s", exc)
        from tools.run_logger import log_api_call
        log_api_call(
            logger, agent="social_trends", api_name="reddit_praw",
            endpoint="https://oauth.reddit.com/r/*/hot",
            params={"subreddits": _REDDIT_SUBS},
            response=None, result_count=0, status="error",
            error=str(exc), elapsed_ms=elapsed,
            use_case="Reddit PRAW: hot posts from India subreddits",
        )
        return []


# ─────────────────────────────────────────────────────────────────────────────
# 4. Twitter/X trending hashtags — three-source fallback chain
#    Source A: X API v1.1 WOEID (India = 23424848) — needs TWITTER_BEARER_TOKEN
#    Source B: Apify eunit/x-twitter-trends-scraper   — needs APIFY_API_TOKEN
#    Source C: RapidAPI twitter-trends-api              — needs RAPIDAPI_KEY
# ─────────────────────────────────────────────────────────────────────────────

_INDIA_WOEID = 23424848


def _twitter_trend_item(name: str, tweet_volume, rank: int) -> dict:
    tag = name.lstrip("#")
    vol = "high" if (tweet_volume or 0) > 50_000 else "medium"
    ctx = f"Trending in India on X/Twitter — {tweet_volume:,} tweets" if tweet_volume else "Trending in India on X/Twitter"
    return {"hashtag": f"#{tag}", "volume": vol, "platform": "twitter", "context": ctx, "rank": rank}


def _get_twitter_trends_woeid() -> list[dict]:
    """
    X API v1.1 trends/place for India (WOEID 23424848).
    Requires TWITTER_BEARER_TOKEN with Elevated or Enterprise access.
    Free Basic plan returns 403 — this source is skipped in that case.
    """
    from tools.run_logger import log_api_call
    settings = get_settings()
    if not settings.twitter_bearer_token:
        logger.info("TWITTER_BEARER_TOKEN not set — skipping X API WOEID trends")
        return []
    url = f"https://api.twitter.com/1.1/trends/place.json?id={_INDIA_WOEID}"
    t0 = time.perf_counter()
    try:
        import urllib.request, json as _json
        req = urllib.request.Request(url, headers={"Authorization": "Bearer ***"})
        req_real = urllib.request.Request(url, headers={"Authorization": f"Bearer {settings.twitter_bearer_token}"})
        with urllib.request.urlopen(req_real, timeout=15) as resp:
            data = _json.loads(resp.read())
        elapsed = (time.perf_counter() - t0) * 1000
        trends = data[0].get("trends", []) if data else []
        results = [
            _twitter_trend_item(t["name"], t.get("tweet_volume"), i + 1)
            for i, t in enumerate(trends[:20])
            if t.get("name")
        ]
        logger.info("X API WOEID: %d trending topics for India", len(results))
        log_api_call(
            logger, agent="social_trends", api_name="twitter_v1_woeid",
            endpoint=url, params={"woeid": _INDIA_WOEID},
            response=trends, result_count=len(results), status="ok",
            elapsed_ms=elapsed,
            use_case=f"X API v1.1 trends/place WOEID={_INDIA_WOEID} (India trending topics)",
        )
        return results
    except Exception as exc:
        elapsed = (time.perf_counter() - t0) * 1000
        # 403 = free Basic plan (no Trends API access); skip silently
        level = logger.debug if "403" in str(exc) else logger.warning
        level("X API WOEID trends failed: %s", exc)
        log_api_call(
            logger, agent="social_trends", api_name="twitter_v1_woeid",
            endpoint=url, params={"woeid": _INDIA_WOEID},
            response=None, result_count=0, status="error",
            error=str(exc), elapsed_ms=elapsed,
            use_case=f"X API v1.1 trends/place WOEID={_INDIA_WOEID}",
        )
        return []


def _get_apify_twitter_trends() -> list[dict]:
    """Apify eunit/x-twitter-trends-scraper — dedicated trending-topics actor."""
    settings = get_settings()
    if not settings.apify_api_token:
        logger.info("APIFY_API_TOKEN not set — skipping Apify Twitter trends")
        return []
    try:
        import sys
        from apify_client import ApifyClient
        client = ApifyClient(settings.apify_api_token)
        _devnull = open(os.devnull, "w")
        _old_stdout, _old_stderr = sys.stdout, sys.stderr
        sys.stdout, sys.stderr = _devnull, _devnull
        try:
            from datetime import timedelta
            run = client.actor("eunit/x-twitter-trends-scraper").call(
                run_input={"country": "india"},   # must be lowercase per actor's allowed values
                wait_duration=timedelta(seconds=90),
            )
        finally:
            sys.stdout, sys.stderr = _old_stdout, _old_stderr
            _devnull.close()
        if not run or run.get("status") == "FAILED":
            logger.warning("Apify x-twitter-trends-scraper failed")
            return []
        items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
        results = []
        for i, item in enumerate(items[:20], 1):
            name = item.get("trend") or item.get("name") or item.get("hashtag") or ""
            if not name:
                continue
            volume = item.get("tweetVolume") or item.get("tweet_volume") or 0
            results.append(_twitter_trend_item(name, volume, i))
        logger.info("Apify x-twitter-trends: %d trending topics for India", len(results))
        return results
    except Exception as exc:
        logger.warning("Apify Twitter trends (eunit) failed: %s", exc)
        return []


def _get_rapidapi_twitter_trends() -> list[dict]:
    """RapidAPI twitter-trends-api by codestardust27 — WOEID-based India trends."""
    from tools.run_logger import log_api_call
    settings = get_settings()
    if not settings.rapidapi_key:
        logger.info("RAPIDAPI_KEY not set — skipping RapidAPI Twitter trends")
        return []
    url = f"https://twitter-trends-api.p.rapidapi.com/trends?woeid={_INDIA_WOEID}"
    t0 = time.perf_counter()
    try:
        import urllib.request, json as _json
        req = urllib.request.Request(url, headers={
            "X-RapidAPI-Key":  settings.rapidapi_key,
            "X-RapidAPI-Host": "twitter-trends-api.p.rapidapi.com",
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = _json.loads(resp.read())
        elapsed = (time.perf_counter() - t0) * 1000
        trends = data if isinstance(data, list) else data.get("trends", [])
        results = [
            _twitter_trend_item(
                t.get("name") or t.get("trend", ""),
                t.get("tweet_volume") or t.get("tweetVolume"),
                i + 1,
            )
            for i, t in enumerate(trends[:20])
            if t.get("name") or t.get("trend")
        ]
        logger.info("RapidAPI Twitter trends: %d trending topics for India", len(results))
        log_api_call(
            logger, agent="social_trends", api_name="rapidapi_twitter_trends",
            endpoint=url, params={"woeid": _INDIA_WOEID},
            response=trends, result_count=len(results), status="ok",
            elapsed_ms=elapsed,
            use_case=f"RapidAPI twitter-trends-api WOEID={_INDIA_WOEID} (India)",
        )
        return results
    except Exception as exc:
        elapsed = (time.perf_counter() - t0) * 1000
        logger.warning("RapidAPI Twitter trends failed: %s", exc)
        log_api_call(
            logger, agent="social_trends", api_name="rapidapi_twitter_trends",
            endpoint=url, params={"woeid": _INDIA_WOEID},
            response=None, result_count=0, status="error",
            error=str(exc), elapsed_ms=elapsed,
            use_case=f"RapidAPI twitter-trends-api WOEID={_INDIA_WOEID}",
        )
        return []


def get_twitter_trends_india() -> list[dict]:
    """
    Fetch trending Twitter/X topics for India using a 3-source fallback chain:
      1. X API v1.1 WOEID (official, most accurate — needs TWITTER_BEARER_TOKEN)
      2. Apify eunit/x-twitter-trends-scraper (no Twitter account needed — needs APIFY_API_TOKEN)
      3. RapidAPI twitter-trends-api (cheapest option — needs RAPIDAPI_KEY)
    Returns the first non-empty result.
    """
    for fn in (_get_twitter_trends_woeid, _get_apify_twitter_trends, _get_rapidapi_twitter_trends):
        try:
            result = fn()
            if result:
                return result
        except Exception as exc:
            logger.warning("Twitter trends source %s failed: %s", fn.__name__, exc)
    logger.info("All Twitter trend sources returned empty — no Twitter trends this run")
    return []


# Keep old name as alias so any callers still work
get_apify_twitter_trends = get_twitter_trends_india


# ─────────────────────────────────────────────────────────────────────────────
# Combined entrypoint
# ─────────────────────────────────────────────────────────────────────────────

RE_HASHTAG_SEEDS = [
    "RealEstateIndia",
    "PropertyIndia",
    "HousingForAll",
    "PropTech",
    "BuyProperty",
    "RealEstate",
    "HomeLoan",
    "RERA",
    "NewLaunch",
    "LuxuryHomes",
]


def fetch_all_trends() -> dict:
    """
    Aggregate trends from all available sources. Every source is optional —
    if credentials are missing or the package isn't installed, that source
    returns [] / {} and the rest continue.

    Returns:
        {
          "google_trends":     list[dict],  # trending Google searches India
          "youtube_trending":  list[dict],  # trending YouTube videos India
          "reddit_viral":      list[dict],  # hot Reddit posts from India subs
          "twitter_trends":    list[dict],  # Twitter hashtags (Apify)
          "re_hashtag_interest": dict,      # Google interest scores for RE seeds
          "sources_active":    list[str],   # which sources returned data
        }
    """
    google   = get_google_trending_searches()
    time.sleep(0.5)  # pytrends rate-limit courtesy
    youtube  = get_youtube_trending_india()
    reddit   = get_reddit_india_viral()
    twitter  = get_twitter_trends_india()
    interest = get_google_interest(RE_HASHTAG_SEEDS[:5])

    sources_active = []
    if google:   sources_active.append("google_trends")
    if youtube:  sources_active.append("youtube_trending")
    if reddit:   sources_active.append("reddit_viral")
    if twitter:  sources_active.append("twitter_trends")

    logger.info(
        "fetch_all_trends: google=%d youtube=%d reddit=%d twitter=%d | active=%s",
        len(google), len(youtube), len(reddit), len(twitter),
        ",".join(sources_active) or "none",
    )

    return {
        "google_trends":      google,
        "youtube_trending":   youtube,
        "reddit_viral":       reddit,
        "twitter_trends":     twitter,
        "re_hashtag_interest": interest,
        "sources_active":     sources_active,
    }
