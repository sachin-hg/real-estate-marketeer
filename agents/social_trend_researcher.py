from __future__ import annotations

import json
import logging

import anthropic

from config import get_settings
from models.state import TrendItem, WorkflowState
from tools.social_trends import RE_HASHTAG_SEEDS, fetch_all_trends
from tools.web_search import web_search

logger = logging.getLogger(__name__)

SYSTEM = """You are a viral content strategist for Housing.com India.

Your job: take trending topics and news events, and craft Housing.com social posts \
in the style of Zomato India — punchy, witty, Hinglish, engagement-first.

ZOMATO'S STYLE (study this):
Zomato takes any news and finds the food delivery angle inside it.
- Pakistan cricket loss → "order placed for home delivery of pak team"
- Independence Day → "not accepting orders anymore" — India, 15th Aug 1947
- Victory parade causing delays → "sorry Mumbai, aaj thoda late hoga"

Housing.com's equivalent: find the REAL ESTATE angle INSIDE the trend.
Key rule — do NOT just bolt on "find homes at housing.com" at the end.
Find a metaphor, a wordplay, or a situation that naturally leads to home/property.

APPROVED Housing.com hook examples (study these — this is our brand voice):
- RCB IPL win (18-year wait) → "Ee Sala Cup Namdu! RCB ne 18 saal baad apna ghar jeet liya. Tum apna ghar kab jeeto ge?"
- Budget ₹12L tax-free → "Modiji ne tax-free kiya, Housing.com ne ghar dhundna free kiya. Ab bahana kya hai?"
- AI layoffs → "Job gayi toh gayi. Ghar toh rehna chahiye. Ek stable step lo — Housing.com pe easy EMI"
- Summer 48°C → "48 degree. Broker ke saath property dekhne nahi jaana. Housing.com pe ghar baithe, AC on, best homes dekho"
- SRK Met Gala "I am SRK" → "Reporter ko pata nahi tha SRK kaun hai. Naye ghar ke saath tumhara naya address sab ko pata hoga"
- Vaibhav Suryavanshi 14yr century → "14 saal mein IPL century maari. Tum 34 saal mein ghar lene ka wait kyun kar rahe ho?"
- Godi media debates → "Breaking news: Housing.com pe ghar ke real prices. Koi debate nahi, koi shouting match nahi"
- Saiyaara song (wanderer) → "Saiyaara matlab bhatakne wala. Bhatakna chodo, apna ghar dhundho"
- Delhi AQI 400 → "Delhi walo, AQI 400 pe hai. Bangalore mein saans lene layak ghar lo"
- UAE/Iran war, Modi gold appeal → "Modiji ne gold khareedne se mana kiya. Ghar lene se nahi"

TONE RULES:
- Hinglish by default (mix Hindi + English naturally, not forced)
- Regional language if the trend is regional (e.g., Tamil Nadu elections → Tamil phrase ok)
- Max 2-3 lines for the hook — punchy, not a paragraph
- City-specific link hint: if trend is city-specific, note the city name
- Rhymes, movie dialogues, meme formats are all welcome

Given raw trend data (Google Trends + optional Twitter data + viral news), produce \
a curated list of the 15 most useful trends for Housing.com social content.

For EACH trend, add a `creative_hook` — a punchy Hinglish Housing.com post idea.

Return a JSON array of 15 items:
[
  {
    "hashtag": "#ExampleTag",
    "volume": "high|medium|rising",
    "platform": "google|twitter|instagram",
    "context": "what the trend is about in 1 sentence",
    "creative_hook": "punchy Hinglish Housing.com post — card text + caption idea",
    "city_hint": "city name if content is city-specific, else null",
    "tags": ["tag1", "tag2"]
  }
]

TAGS VOCABULARY (use only these — 1-4 tags per item, pick the most relevant):
cricket, sports, bollywood, music, comedy, celebrity, influencer, lifestyle, viral,
viral-trend, humor, drama, reels, politics, elections, india, national-pride,
finance, ipo, startup, investment, homeloan, banking, emi, fintech, rbi, tax,
budget, savings, middle-class, gold, petrol, lpg, commodities, tech, ai, jobs,
layoffs, instability, weather, rain, monsoon, flooding, heatwave, summer, cyclone,
storm, aqi, pollution, green-living, infrastructure, civic, commute, traffic,
transport, safety, construction, luxury, travel, hills, festival, celebration,
wedding, food, consumer, news, media, education, youth, protests, diwali, holi, eid,
delhi, mumbai, bengaluru, noida, gurgaon, pune, hyderabad, chennai, kolkata,
bareilly, up, shift, comeback, social-media, dhurandhar,
linkedin, career, hiring, workculture, genz, salary, wfh, hustle, proptech

Return ONLY the JSON array."""


def trend_researcher_node(state: WorkflowState) -> dict:
    """LangGraph node: fetches trends and uses Claude to add creative hooks."""
    from tools.run_logger import Timer, log_llm_call, log_tool_call, log_agent_io
    settings = get_settings()
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    logger.info("Trend researcher: fetching raw trends | model=%s", settings.model_balanced)

    with Timer() as t_trends:
        raw_data = fetch_all_trends()
    logger.info(
        "Trend researcher: raw data collected | google=%d youtube=%d reddit=%d twitter=%d | active=%s | elapsed_ms=%.0f",
        len(raw_data["google_trends"]),
        len(raw_data["youtube_trending"]),
        len(raw_data["reddit_viral"]),
        len(raw_data["twitter_trends"]),
        ",".join(raw_data.get("sources_active", [])) or "none",
        t_trends.elapsed_ms,
    )
    logger.debug("Trend researcher: google_trends=%s", json.dumps(raw_data["google_trends"][:5]))
    logger.debug("Trend researcher: youtube_trending=%s", json.dumps(raw_data["youtube_trending"][:5]))
    logger.debug("Trend researcher: reddit_viral=%s", json.dumps(raw_data["reddit_viral"][:5]))
    logger.debug("Trend researcher: twitter_trends=%s", json.dumps(raw_data["twitter_trends"][:5]))

    # Use research from state if already available (direct_graph flow — topic_enricher ran first).
    # Otherwise do a fresh viral news search (main graph — runs in parallel with researcher).
    existing_research = state.get("research", [])
    if existing_research:
        viral_news = [
            {"title": r.get("headline", ""), "content": r.get("summary", "")}
            for r in existing_research[:8]
        ]
        logger.info("Trend researcher: using %d stories from state (skipping viral news search)",
                    len(viral_news))
    else:
        logger.info("Trend researcher: searching viral India news events")
        with Timer() as t_viral:
            viral_news = web_search(
                "viral trending India news today social media Twitter Instagram meme 2025",
                max_results=8,
            )
        log_tool_call(
            logger,
            tool_name="web_search/viral_news",
            inputs={"query": "viral trending India news today", "max_results": 8},
            outputs=viral_news,
            elapsed_ms=t_viral.elapsed_ms,
        )

    logger.info("Trend researcher: running supplementary web_search for RE hashtags")
    with Timer() as t_ws:
        re_trend_results = web_search(
            "trending hashtags real estate India property Instagram Twitter",
            max_results=5,
        )
    log_tool_call(
        logger,
        tool_name="web_search/re_hashtags",
        inputs={"query": "trending hashtags real estate India property Instagram Twitter", "max_results": 5},
        outputs=re_trend_results,
        elapsed_ms=t_ws.elapsed_ms,
    )

    # LinkedIn-specific: work culture, career, and hiring debates going viral
    logger.info("Trend researcher: searching LinkedIn India trending professional discussions")
    with Timer() as t_li:
        linkedin_trends = web_search(
            "viral LinkedIn India post 2025 work culture jobs layoffs salary startup tech career",
            max_results=6,
            days_back=14,
        )
    log_tool_call(
        logger,
        tool_name="web_search/linkedin_trends",
        inputs={"query": "viral LinkedIn India work culture jobs layoffs career", "max_results": 6},
        outputs=linkedin_trends,
        elapsed_ms=t_li.elapsed_ms,
    )

    # ── Format each data source compactly ────────────────────────────────────
    def _fmt_youtube(items: list[dict]) -> str:
        if not items:
            return "Not available (YOUTUBE_API_KEY not configured)"
        lines = []
        for v in items[:15]:
            lines.append(f"  [{v['category']}] {v['title']} — {v['channel']} ({v['views']:,} views)")
        return "\n".join(lines)

    def _fmt_reddit(items: list[dict]) -> str:
        if not items:
            return "Not available (Reddit credentials not configured)"
        lines = []
        for p in items[:20]:
            flair = f" [{p['flair']}]" if p['flair'] else ""
            lines.append(f"  {p['subreddit']}{flair} | {p['score']} upvotes | {p['title']}")
        return "\n".join(lines)

    user_msg = f"""Here is the raw trend data I've collected from {len(raw_data.get('sources_active', []))} active sources:

━━━ GOOGLE TRENDING SEARCHES (India, right now) ━━━
{json.dumps([{'rank': t['rank'], 'term': t['raw_term']} for t in raw_data['google_trends'][:20]], indent=2) if raw_data['google_trends'] else 'Not available (pytrends not installed)'}

━━━ YOUTUBE TRENDING INDIA (what's driving reels / meme culture) ━━━
{_fmt_youtube(raw_data['youtube_trending'])}

━━━ REDDIT INDIA HOT POSTS (community-surfaced viral moments, sorted by upvotes) ━━━
{_fmt_reddit(raw_data['reddit_viral'])}

━━━ TWITTER/X TRENDING HASHTAGS (India) ━━━
{json.dumps(raw_data['twitter_trends'][:10], indent=2) if raw_data['twitter_trends'] else 'Not available (APIFY_API_TOKEN not configured)'}

━━━ VIRAL NEWS & EVENTS (web search, India today) ━━━
{json.dumps([{{'title': r.get('title', ''), 'snippet': r.get('content', '')[:200]}} for r in viral_news], indent=2)}

━━━ REAL ESTATE HASHTAG INTEREST SCORES (Google, 7-day average, 0-100) ━━━
{json.dumps(raw_data['re_hashtag_interest'], indent=2)}

━━━ SUPPLEMENTARY RE WEB CONTEXT ━━━
{json.dumps([r.get('title', '') + ': ' + r.get('content', '')[:120] for r in re_trend_results], indent=2)}

━━━ LINKEDIN INDIA — VIRAL WORK CULTURE / CAREER DISCUSSIONS (use for linkedin/career tags) ━━━
{json.dumps([{{'title': r.get('title', ''), 'snippet': r.get('content', '')[:200]}} for r in linkedin_trends], indent=2)}
(Tag these trends with: linkedin, career, workculture, hiring, salary, wfh, layoffs, hustle, or genz as appropriate)

RE HASHTAG SEEDS TO INCLUDE (if they have activity): {', '.join(RE_HASHTAG_SEEDS)}

SIGNAL HIERARCHY — use this priority order when picking the 15 items:
1. YOUTUBE trending clips + REDDIT hot posts → these surface the meme/reel layer BEFORE news picks it up
2. GOOGLE trending searches → confirms the moment has gone mainstream
3. VIRAL NEWS & EVENTS (web search) → adds context and the real-estate angle
4. TWITTER hashtags → volume signals, use to confirm #trend_hashtag spelling
5. LINKEDIN DISCUSSIONS → professional/career debates (layoffs, salary, work culture, Gen Z, AI jobs);
   include 2-3 of these with tags [linkedin, career, workculture, etc.] — these feed the LinkedIn employer brand posts
6. RE hashtags → secondary, include 2-3 if they have real Google interest scores

For each item, make sure trend_hashtag matches the exact hashtag people are using \
(e.g. '#FA9LA' not '#Dhurandhar' if the dance step is the actual viral moment).

Now produce the curated 15-item trend list."""

    with Timer() as t_llm:
        response = client.messages.create(
            model=settings.model_balanced,
            max_tokens=3000,
            system=SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )
    raw_response = response.content[0].text
    log_llm_call(
        logger,
        agent="trend_researcher",
        model=settings.model_balanced,
        system_prompt=SYSTEM,
        user_message=user_msg,
        response_text=raw_response,
        stop_reason=response.stop_reason,
        elapsed_ms=t_llm.elapsed_ms,
    )

    trends = _parse_trends(raw_response)
    trends = _deduplicate_trends(trends)
    logger.info("Trend researcher: identified %d trends (after dedup)", len(trends))
    log_agent_io(
        logger,
        agent="trend_researcher",
        inputs={
            "google_trends_count": len(raw_data["google_trends"]),
            "youtube_trending_count": len(raw_data["youtube_trending"]),
            "reddit_viral_count": len(raw_data["reddit_viral"]),
            "twitter_trends_count": len(raw_data["twitter_trends"]),
            "linkedin_trends_count": len(linkedin_trends),
            "sources_active": raw_data.get("sources_active", []),
        },
        outputs={"trends": [t.get("hashtag", "") + " — " + t.get("creative_hook", "")[:60] for t in trends]},
    )
    return {"trends": trends}


def _deduplicate_trends(trends: list[TrendItem]) -> list[TrendItem]:
    """Remove trends whose hashtag was already published in the last 48h."""
    try:
        from datetime import datetime, timezone, timedelta
        from db.connection import get_db_session
        from db.models import PublishedPostRecord

        cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
        hashtags = [t.get("hashtag", "").lstrip("#").lower() for t in trends if t.get("hashtag")]

        with get_db_session() as session:
            recent = {
                row.trend_hashtag.lstrip("#").lower()
                for row in session.query(PublishedPostRecord.trend_hashtag)
                .filter(
                    PublishedPostRecord.trend_hashtag.isnot(None),
                    PublishedPostRecord.published_at >= cutoff,
                )
                .all()
                if row.trend_hashtag
            }

        if not recent:
            return trends

        filtered = [t for t in trends if t.get("hashtag", "").lstrip("#").lower() not in recent]
        dropped = len(trends) - len(filtered)
        if dropped:
            logger.info("Trend researcher: dropped %d already-published hashtags: %s",
                        dropped, [t["hashtag"] for t in trends if t.get("hashtag", "").lstrip("#").lower() in recent])
        return filtered
    except Exception as exc:
        logger.debug("Trend deduplication skipped: %s", exc)
        return trends


def _parse_trends(raw: str) -> list[TrendItem]:
    from tools.json_utils import extract_json
    data = extract_json(raw)
    if isinstance(data, list):
        for item in data:
            item.setdefault("city_hint", None)
            item.setdefault("tags", [])
        return data[:15]
    logger.error("Failed to parse trend JSON. Raw: %s", raw[:200])
    return []
