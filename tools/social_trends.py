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
    """Top 20 trending Google searches in India right now."""
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
        logger.debug("Google Trends: %d trending searches", len(results))
        return results[:20]
    except Exception as exc:
        logger.warning("Google Trends failed: %s", exc)
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
    settings = get_settings()
    if not settings.youtube_api_key:
        logger.info("YOUTUBE_API_KEY not set — skipping YouTube trending")
        return []

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
        logger.info("YouTube Trending: %d unique trending videos (India)", len(results[:30]))
        return results[:30]

    except Exception as exc:
        logger.warning("YouTube Trending failed: %s", exc)
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
        logger.info("Reddit: %d hot posts from India subreddits", len(results[:30]))
        return results[:30]

    except Exception as exc:
        logger.warning("Reddit viral fetch failed: %s", exc)
        return []


# ─────────────────────────────────────────────────────────────────────────────
# 4. Apify — Twitter/X trending hashtags (needs APIFY_API_TOKEN)
# ─────────────────────────────────────────────────────────────────────────────

def get_apify_twitter_trends() -> list[dict]:
    """Trending Twitter/X hashtags for India via Apify scraper."""
    settings = get_settings()
    if not settings.apify_api_token:
        logger.info("APIFY_API_TOKEN not set — skipping Twitter trend scrape")
        return []

    try:
        import sys
        from apify_client import ApifyClient
        client = ApifyClient(settings.apify_api_token)

        _devnull = open(os.devnull, "w")
        _old_stdout, _old_stderr = sys.stdout, sys.stderr
        sys.stdout, sys.stderr = _devnull, _devnull
        try:
            run = client.actor("apify/twitter-scraper-lite").call(
                run_input={
                    "searchTerms": ["#RealEstate India trending", "trending India today"],
                    "maxItems": 50,
                    "queryType": "Latest",
                },
                wait_secs=120,
            )
        finally:
            sys.stdout, sys.stderr = _old_stdout, _old_stderr
            _devnull.close()

        if not run or run.get("status") == "FAILED":
            logger.warning("Apify actor failed — skipping Twitter trends")
            return []

        items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
        hashtags: dict[str, int] = {}
        for item in items:
            for tag in item.get("hashtags", []):
                hashtags[tag.lower()] = hashtags.get(tag.lower(), 0) + 1

        return [
            {
                "hashtag": f"#{tag}",
                "volume": "high" if count > 5 else "medium",
                "platform": "twitter",
                "context": f"Seen in {count} recent India tweets",
                "rank": rank + 1,
            }
            for rank, (tag, count) in enumerate(
                sorted(hashtags.items(), key=lambda x: -x[1])[:20]
            )
        ]
    except Exception as exc:
        logger.warning("Apify Twitter trends failed: %s", exc)
        return []


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
    twitter  = get_apify_twitter_trends()
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
