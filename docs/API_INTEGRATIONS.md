# API Integrations Reference

> Complete reference for every external API used in the pipeline.  
> Last updated: May 2026

---

## Table of Contents

1. [LLM Providers](#1-llm-providers)
2. [Content Research APIs](#2-content-research-apis)
3. [Trend Sources](#3-trend-sources)
4. [Social Publishing APIs](#4-social-publishing-apis)
5. [Notifications — Slack](#5-notifications--slack)
6. [Image Generation](#6-image-generation)
7. [Asset Storage (Cloud)](#7-asset-storage-cloud)
8. [Internal (Housing.com)](#8-internal-housingcom)
9. [API Cost Summary](#9-api-cost-summary)
10. [Fallback Map](#10-fallback-map)

---

## 1. LLM Providers

### Anthropic Claude

| Property | Value |
|---|---|
| **Auth** | `ANTHROPIC_API_KEY` in `Authorization: Bearer` header |
| **SDK** | `anthropic` Python SDK |
| **Models used** | `claude-opus-4-7` (creative), `claude-sonnet-4-6` (balanced), `claude-haiku-4-5-20251001` (fast fallback) |
| **Routing** | `tools/llm_router.py` — `call_json_async()` / `acall_message()` |
| **Timeout** | `LLM_TIMEOUT` (default 60s) per call |
| **Retries** | `LLM_RETRIES` (default 2) with exponential backoff (1s → 2s) |
| **Rate limits** | SDK handles 529 auto-retry; no explicit client-side rate limiter |
| **Cost (per MTok)** | Opus: $5/$25 · Sonnet: $3/$15 · Haiku: $1/$5 (input/output) |

**Call tracking:** Every call logged to `llm_calls` DB table via `tools/run_logger.py`.

---

### Google Gemini

| Property | Value |
|---|---|
| **Auth** | `GEMINI_API_KEY` |
| **SDK** | `google-genai` Python SDK |
| **Model used** | `gemini-2.5-flash` |
| **When activated** | Only when `GEMINI_API_KEY` is set; otherwise falls back to Claude Haiku |
| **Routing** | `tools/llm_router.py` — fast tier only (planner, safety gate, engagement prediction, link extraction) |
| **JSON output** | `response_mime_type="application/json"` — eliminates parsing errors |
| **Cost (per MTok)** | $0.30/$2.50 (input/output) — 53% cheaper than Haiku for input |
| **Timeout** | Same as Claude (`LLM_TIMEOUT`) |

---

## 2. Content Research APIs

### Tavily Search API

| Property | Value |
|---|---|
| **Auth** | `TAVILY_API_KEY` |
| **Endpoint** | `https://api.tavily.com/search` |
| **Used by** | `researcher` agent (primary), `topic_researcher` (fallback), `topic_trend_researcher` (fallback) |
| **Call params** | `query`, `max_results`, `search_depth` (`"basic"`=1 credit, `"advanced"`=5 credits), `days` (lookback) |
| **Domain filter** | `include_domains` — whitelisted to `RE_CREDIBLE_DOMAINS` for research |
| **Max calls/run** | 5 search rounds (hardcoded in researcher agent) |
| **Fallback** | None — hard dependency; missing key aborts research agent |
| **Error handling** | Exception caught → returns `[]`; agent logs error and continues |
| **Rate limit** | Managed by Tavily; no explicit client-side guard |

**`RE_CREDIBLE_DOMAINS` (hardcoded in `tools/web_search.py`):**
```
economictimes.indiatimes.com, hindustantimes.com, housing.com, anarock.com,
jll.co.in, credai.org, 99acres.com, magicbricks.com, pib.gov.in, mhupa.gov.in,
proptigernews.com, livemint.com, businesstoday.in
```

---

### Serper.dev (Google News)

| Property | Value |
|---|---|
| **Auth** | `SERPER_API_KEY` |
| **Endpoint** | `https://google.serper.dev/news` |
| **Used by** | `tools/web_search.py` → `serper_news_search()` for RERA circulars, `topic_trend_researcher` |
| **Call params** | `q` (query), `num` (results count), `gl="in"` (India), `hl="en"` |
| **Fallback** | Falls back to Tavily if absent |

---

### SerpAPI (Google News + Trends India)

| Property | Value |
|---|---|
| **Auth** | `SERP_API_KEY` (different from Serper — this is serpapi.com) |
| **Endpoint** | `https://serpapi.com/search.json` |
| **Used by** | `tools/serpapi_utils.py` — both news and trends |
| **News engine** | `engine="google_news"`, `gl="in"`, `tbs="qdr:2d"` (last 48h) |
| **Trends engine** | `engine="google_trends_trending_now"`, `geo="IN"` |
| **RE query set** | 5 queries: RERA penalties, RE prices, housing schemes, builder news, PropTech/NRI |
| **Deduplication** | By URL; max 20 results across all queries |
| **Error handling** | Exception caught per query; partial results returned |

---

## 3. Trend Sources

### Google Trends (pytrends)

| Property | Value |
|---|---|
| **Auth** | None (unofficial API) |
| **Library** | `pytrends` |
| **What it returns** | Top 20 trending searches in India (`geo="IN"`) |
| **Rate limit risk** | Aggressive — 429 errors after 3-4 rapid calls in succession |
| **Mitigation** | `time.sleep(1)` between calls |
| **Fallback** | SerpAPI Google Trends (`SERP_API_KEY`) if pytrends returns 404/429 |
| **On failure** | Returns `[]`; pipeline continues with other trend sources |

**Production note:** Cache results for 4h in Redis — trends don't change minute-to-minute. See `TECHNICAL_DESIGN.md §5.1`.

---

### YouTube Data API v3

| Property | Value |
|---|---|
| **Auth** | `YOUTUBE_API_KEY` (simple API key, no OAuth) |
| **Endpoint** | `https://www.googleapis.com/youtube/v3/videos` |
| **Call** | `videos().list(part="snippet,statistics", chart="mostPopular", regionCode="IN", videoCategoryId=N)` |
| **Categories polled** | All + Sports + Entertainment + Music + News + Comedy |
| **Output** | ~30 unique videos sorted by view count (title, channel, video_id, url, views, likes, tags) |
| **Error handling** | Per-category try-catch; failures skip that category, others continue |
| **On failure** | Returns `[]`; trend researcher continues with other sources |

---

### Reddit India (PRAW)

| Property | Value |
|---|---|
| **Auth** | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` |
| **Library** | `praw` (Python Reddit API Wrapper) |
| **Subreddits** | india, bollywood, Cricket, indiameme, indianews, mumbai, delhi, bangalore, technology, personalfinance |
| **Fetch strategy** | `subreddit.hot(limit=8)` per subreddit; minimum score 50; excludes stickied |
| **Output** | ~30 posts sorted by score (subreddit, title, score, num_comments, url, flair) |
| **Error handling** | Per-subreddit try-catch; partial results returned |

---

### Twitter / X Trends — 3-Way Fallback Chain

The trend researcher tries three sources in order:

#### Source A: X API v1.1 WOEID (bearer token)

| Property | Value |
|---|---|
| **Auth** | `TWITTER_BEARER_TOKEN` |
| **Endpoint** | `https://api.twitter.com/1.1/trends/place.json?id=23424848` (India WOEID) |
| **Output** | Top 20 trends with tweet volume |
| **Known issue** | Free Basic tier returns HTTP 403; only Elevated/Enterprise access works |
| **On 403** | Silent fallback to Source B |

#### Source B: Apify x-twitter-trends-scraper

| Property | Value |
|---|---|
| **Auth** | `APIFY_API_TOKEN` |
| **Actor** | `eunit/x-twitter-trends-scraper` |
| **Input** | `{"country": "india"}` |
| **Wait** | 90 seconds max for actor run |
| **Output** | Dataset items: `trend, name, hashtag, tweetVolume` |
| **On failure** | Checks run status; returns `[]` if `status == "FAILED"` |

#### Source C: RapidAPI Twitter Trends

| Property | Value |
|---|---|
| **Auth** | `RAPIDAPI_KEY` |
| **Endpoint** | `https://twitter-trends-api.p.rapidapi.com/trends?woeid=23424848` |
| **Headers** | `X-RapidAPI-Key`, `X-RapidAPI-Host` |
| **Output** | Array of trends: `name, tweet_volume` |
| **On failure** | Exception caught; logs warning; returns `[]` |

---

## 4. Social Publishing APIs

### Twitter / X (tweepy)

| Property | Value |
|---|---|
| **Auth** | OAuth 1.0a: `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_TOKEN_SECRET` |
| **Library** | `tweepy` |
| **Publish call** | `client.create_tweet(text=content[:280])` |
| **Returns** | `tweet_id` |
| **Post URL** | `https://x.com/HousingDotCom/status/{tweet_id}` |
| **Dry-run** | Saves to `output/{run_id}/twitter_{post_id}.md` |
| **On failure** | Exception caught → falls back to local file save |

---

### Instagram Graph API

| Property | Value |
|---|---|
| **Auth** | `INSTAGRAM_ACCESS_TOKEN` (long-lived token, expires 60 days), `INSTAGRAM_ACCOUNT_ID` |
| **Endpoint** | `https://graph.instagram.com/{ig_id}/media` (create container) + `{ig_id}/media_publish` (publish) |
| **2-step flow** | Step 1: POST create container with `image_url` + `caption`; Step 2: POST publish with `creation_id` |
| **Image requirement** | Must be publicly accessible URL — local PIL cards must be uploaded to CDN first |
| **On failure** | Falls back to local file save |
| **Known issue** | Long-lived token expires in 60 days — no auto-refresh implemented yet (see `TECHNICAL_DESIGN.md §5.9`) |

---

### Housing.com News CMS

| Property | Value |
|---|---|
| **Auth** | Bearer token `HOUSING_CMS_API_KEY` |
| **Endpoint** | `{HOUSING_CMS_BASE_URL}/articles` (default: `https://cms.housing.com/api/v1`) |
| **Payload** | `{title, body (markdown), meta_description, tags, internal_links, status="published"}` |
| **Returns** | `article_id` |
| **Post URL** | `https://housing.com/news/article/{article_id}` |
| **On failure** | Falls back to local file save |

---

### LinkedIn

| Property | Value |
|---|---|
| **Status** | ⚠️ Not yet implemented — posts saved locally only |
| **Auth** | `LINKEDIN_ACCESS_TOKEN` |
| **Planned endpoint** | LinkedIn v2 Posts API |

---

### YouTube Shorts

| Property | Value |
|---|---|
| **Status** | ⚠️ Stub only — upload not implemented |
| **Auth needed** | OAuth 2.0 device flow for server-side upload |
| **Planned** | YouTube Data API v3 `videos.insert()` with `snippet.categoryId` |

---

## 5. Notifications — Slack

### Socket Mode Bot (`tools/slack_bot.py`)

| Property | Value |
|---|---|
| **Auth** | `SLACK_BOT_TOKEN` + `SLACK_APP_TOKEN` |
| **Library** | `slack_bolt` async app |
| **Mode** | Socket Mode (no public webhook URL needed) |
| **Trigger** | DM or @mention to bot → extracts topic → triggers `direct_graph` run |
| **Invoked by** | `python main.py slack-bot` |

---

### Run Notifications (`tools/slack_notifier.py`)

| Property | Value |
|---|---|
| **Auth** | `SLACK_BOT_TOKEN` |
| **Channel** | `SLACK_CHANNEL_ID` |
| **`post_run_summary(state)`** | After publisher: posts thread with per-platform preview, QA score, pred ER, post URL |
| **`post_error_alert(run_id, error)`** | When all posts rejected or pipeline errors: posts error summary |
| **On failure** | Logs warning and continues — Slack is non-blocking |

---

### Slack Interactive Actions (`POST /slack/action`)

| Property | Value |
|---|---|
| **Auth** | `SLACK_SIGNING_SECRET` — verifies `X-Slack-Signature` header |
| **Actions handled** | `approve_post`, `reject_post` (HITL buttons), `takedown_run` (kill-switch) |
| **Takedown gap** | Kill-switch marks run as `taken_down` in-memory but does NOT call platform delete APIs yet |

---

## 6. Image Generation

### PIL Branded Cards (local — zero API cost)

| Property | Value |
|---|---|
| **Library** | `Pillow` |
| **File** | `tools/branded_image_generator.py` |
| **Output** | 1080×1080 PNG — purple background (`#3D1FD5`), white Rubik font, brand logo bottom-right |
| **Used by** | Instagram agent (always), Twitter agent (optional, `media_format="branded_card"`) |
| **Assets** | Fonts + logo from `ASSETS_DIR` (default: `assets/`) |
| **On failure** | Logs warning; post continues text-only |

---

### DALL-E 3 (OpenAI)

| Property | Value |
|---|---|
| **Auth** | `OPENAI_API_KEY` |
| **Library** | `openai` Python SDK |
| **File** | `tools/image_generator.py` |
| **Used by** | Twitter agent (optional thumbnails), YouTube agent (thumbnails) |
| **Enabled when** | `ENABLE_IMAGE_GENERATION=True` AND `OPENAI_API_KEY` set |
| **Style suffix** | Aspirational/photorealistic Housing.com-style suffix appended to all prompts |
| **On failure** | Returns `None`; post published text-only without aborting |
| **Cost** | ~$0.04/image (1024×1024 standard); not used in every run |
| **Known issue** | DALL-E may reject prompts containing "protest", "slum", "poverty" — see `TECHNICAL_DESIGN.md §5.8` |

---

## 7. Asset Storage (Cloud)

Controlled by `ASSET_STORAGE_BACKEND` env var.

| Backend | Env var | Use case |
|---|---|---|
| `local` (default) | — | Development; files saved to `output/{run_id}/` |
| `s3` | `AWS_S3_BUCKET`, `AWS_S3_REGION`, `AWS_S3_PREFIX` | Production; public URLs for Instagram posting |
| `gcs` | `GCS_BUCKET`, `GCS_PREFIX` | GCP deployments |

**`tools/asset_storage.py`** — `upload_asset(local_path, run_id, filename)` returns a public URL or local path.

---

## 8. Internal (Housing.com)

### Housing.com URL Generation (deterministic — no API)

| Function | Output | Example |
|---|---|---|
| `city_srp_url(slug)` | `https://housing.com/in/buy/{slug}` | `housing.com/in/buy/bengaluru` |
| `city_homepage_url(slug)` | `https://housing.com/in/buy/real-estate-{slug_underscored}` | |
| `builder_url(name)` | `https://housing.com/in/buy/{builder-slug}-bid` | |
| `project_url(name)` | `https://housing.com/in/buy/{project-slug}-pid` | |

**39 primary markets defined in `tools/housing_urls.py`.** Common aliases handled: `Gurugram→gurgaon`, `Bangalore→bengaluru`, `Bombay→mumbai`, `Trivandrum→thiruvananthapuram`, `Delhi NCR→new-delhi`.

URL construction is pure Python — Claude only does the fuzzy NLP extraction; Python builds the URLs. This prevents hallucinated URLs creating 404s.

---

### Housing Retriever (`tools/housing_retriever.py`)

Takes structured RE signals dict (from internal link agent) → orchestrates URL construction across city, builder, and project types → returns list of `internal_links` objects.

---

## 9. API Cost Summary

### Per-Run Cost Estimate

| Component | Provider | Calls | Cost |
|---|---|---|---|
| researcher | Sonnet 4.6 | 1 multi-turn | ~$0.05 |
| trend_researcher | Sonnet 4.6 | 1 call | ~$0.03 |
| planner | Gemini Flash | 1 call | ~$0.003 |
| social_creative | Opus 4.7 | 1 call (long) | ~$0.20 |
| news_creative | Sonnet 4.6 | 1 call (long) | ~$0.08 |
| internal_retriever | Gemini Flash | 1-3 calls | ~$0.005 |
| platform_agents (×5) | Sonnet 4.6 | 5 calls | ~$0.15 |
| qa/safety (×posts) | Gemini Flash | 5 calls | ~$0.01 |
| qa/quality (×posts) | Sonnet 4.6 | 5 calls | ~$0.10 |
| qa/engagement (×posts) | Gemini Flash | 5 calls | ~$0.005 |
| **Total (no revision)** | | | **~$0.63** |
| **Total (1 revision loop)** | | | **~$0.90** |

**External API costs (non-LLM):**
| Service | Cost |
|---|---|
| Tavily basic search | $0.001/search (~$0.005/run) |
| Serper News | ~$0.003/run |
| SerpAPI | ~$0.003/run |
| PIL image generation | $0 (local) |
| DALL-E 3 (optional) | ~$0.04/image |
| YouTube Data API | Free (within daily quota) |
| pytrends | Free (unofficial) |
| Reddit PRAW | Free |

**Daily cost at 2 runs/day:** ~$1.30–1.80/day (LLM only) · ~$30–55/month.

---

## 10. Fallback Map

```
Research (news)
  Tavily (primary)
  → Serper News (partial supplement if SERPER_API_KEY set)
  → SerpAPI Google News (partial supplement if SERP_API_KEY set)
  → [] if all fail (pipeline continues, creative agent gets empty research)

Google Trends
  pytrends (primary)
  → SerpAPI Google Trends Trending Now (if SERP_API_KEY set)
  → [] (pipeline continues without trending data)

Twitter Trends
  X API v1.1 WOEID bearer token (primary — requires Elevated access)
  → Apify x-twitter-trends-scraper (if APIFY_API_TOKEN set)
  → RapidAPI Twitter Trends (if RAPIDAPI_KEY set)
  → [] (pipeline continues; other trend sources still available)

Fast-Tier LLM
  Gemini 2.5 Flash (if GEMINI_API_KEY set)
  → Claude Haiku 4.5 (always available — hard dependency on ANTHROPIC_API_KEY)

Image Generation
  PIL branded card (local — zero cost, always available if assets/ present)
  → DALL-E 3 (if OPENAI_API_KEY set, for non-branded-card formats)
  → None (post published text-only)

Platform Publishing (per platform)
  Live API call (if credentials set and DRY_RUN=false)
  → Local file save in output/{run_id}/ (always)

Slack Notifications
  Slack API (if SLACK_BOT_TOKEN + SLACK_CHANNEL_ID set)
  → Silent skip (non-blocking)
```
