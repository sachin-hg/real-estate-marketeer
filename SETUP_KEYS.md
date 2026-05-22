# API Keys & Tokens Setup

All keys go into a `.env` file in the project root. Copy `.env.example` to `.env` and fill in the values below.

```bash
cp .env.example .env
```

---

## Required (pipeline won't start without these)

### 1. Anthropic (Claude)

- Go to: [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
- Click **Create Key**
- Copy the `sk-ant-...` value

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 2. Tavily (web search — used by researcher + trend agents)

- Go to: [https://app.tavily.com](https://app.tavily.com)
- Sign up → Dashboard → copy your API key

```
TAVILY_API_KEY=tvly-...
```

---

## AI Cost Optimisation (optional — recommended)

### 2.5 Google Gemini Flash — fast-tier LLM (53% cheaper than Haiku)

The pipeline uses a tiered LLM router. The **fast tier** (entity extraction, safety gate) defaults to Claude Haiku 4.5 but automatically switches to **Gemini 2.5 Flash** when `GEMINI_API_KEY` is set — reducing those calls from $1.00/$5.00 per MTok to $0.30/$2.50 per MTok.

1. Go to: [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Sign in with a Google account → click **Create API key**
3. Copy the key (starts with `AIza...`)

```
GEMINI_API_KEY=AIza...
```

**Savings:** ~$0.18/run at Scenario 2 volume (60 runs/month = ~$11/month saved).  
**Free tier:** 15 RPM / 1 million TPD — sufficient for dev and staging. Set `GEMINI_API_KEY` and it activates automatically; no other changes needed.

---

## Trend Research (add these to unlock richer trend signals)

### 3. SerpAPI — Google News India + Google Trends India

Unlocks two things in a single key:

- **Google News India** (RERA, builder, broker, policy articles) — pre-seeded directly into the researcher agent before Claude starts searching. More articles, zero extra LLM cost.
- **Google Trends India (last 24h, sorted by relevance)** — reliable fallback when pytrends gets a Google 404. Same data as `trends.google.com`, returned via API.

1. Go to [https://serpapi.com/users/sign_up](https://serpapi.com/users/sign_up)
2. Sign up → Dashboard → copy **Your Private API Key**
3. Free tier: **100 searches/month**. Each pipeline run uses ~6–8 searches (5 news queries + 1 trends query).

> On the free tier that's ~12–16 runs/month for research + trends.
> Upgrade to Basic ($50/month, 5,000 searches) for production.

```
SERP_API_KEY=...
```

**Endpoints used:**

- Google News: `engine=google_news&q=RERA+penalty+builder+India&gl=in` (5 queries/run)
- Google Trends Trending Now: `engine=google_trends&data_type=TRENDING_SEARCHES&geo=IN` (1 query/run)

---

### 4. YouTube Data API v3 — trending videos India

Unlocks: YouTube source in trend researcher (viral Shorts, music, sports clips)

1. Go to [https://console.cloud.google.com/](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Enable **YouTube Data API v3** under APIs & Services → Library
4. Go to APIs & Services → **Credentials** → Create Credentials → **API Key**
5. (Optional) Restrict it to YouTube Data API v3 only

```
YOUTUBE_API_KEY=AIza...
```

Free tier: 10,000 units/day. One trending request costs ~100 units. Safe for daily runs.

---

### 5. Reddit API — r/india, r/bollywood, r/Cricket viral posts

Unlocks: Reddit source (community-surfaced viral moments, memes, discussions)

1. Log in to Reddit → go to [https://www.reddit.com/prefs/apps](https://www.reddit.com/prefs/apps)
2. Scroll to bottom → click **Create another app**
3. Select **script** (not web app or installed app)
4. Name it anything (e.g. `housing-marketeer`)
5. Redirect URI: `http://localhost:8080` (not used but required)
6. Click **Create app**
7. Copy the **client ID** (short string under the app name) and **client secret**

```
REDDIT_CLIENT_ID=abc123xyz
REDDIT_CLIENT_SECRET=xyz_secret_here
```

Free, no approval needed for read-only public subreddit access.

---

### 6. Twitter / X Trends — 3-source fallback chain

The pipeline tries these three sources **in order** and uses the first one that returns data. You only need one — start with Source 1.

#### Source 1 — X API WOEID `TWITTER_BEARER_TOKEN`

Official `trends/place` endpoint for India (WOEID `23424848`).

> **Access tier required:** The v1.1 Trends API (`trends/place`) is restricted to **Elevated or Enterprise** access. The free Basic plan returns `403 Forbidden`. If you only have Basic access, skip this and use Source 2 or 3 instead.

1. Go to [https://developer.twitter.com/en/portal/dashboard](https://developer.twitter.com/en/portal/dashboard)
2. Create a project + app → **Keys and Tokens** tab → copy **Bearer Token**
3. Apply for Elevated access at https://developer.twitter.com/en/portal/petition/elevated/intro

```
TWITTER_BEARER_TOKEN=AAAA...
```

If you have Basic access only, still set this — it's used for reading tweets and publishing. The trends call will 403 silently and fall back to Source 2/3.

---

#### Source 2 — Apify `eunit/x-twitter-trends-scraper` `APIFY_API_TOKEN`

Dedicated trending-topics actor. No Twitter credentials needed — Apify handles it.

> **Paid actor:** requires a paid Apify plan after the free trial (Starter ~$49/month or pay-per-result). If you don't want to pay, use Source 1 (`TWITTER_BEARER_TOKEN`) instead — it's free.

1. Go to [https://console.apify.com/account/integrations](https://console.apify.com/account/integrations) → copy **Personal API Token**
2. Actor page: [https://apify.com/eunit/x-twitter-trends-scraper](https://apify.com/eunit/x-twitter-trends-scraper)

```
APIFY_API_TOKEN=apify_api_...
```

The same `APIFY_API_TOKEN` is used elsewhere in the pipeline (other Apify actors). If it's already set, this source is attempted automatically.

---

#### Source 3 — RapidAPI `RAPIDAPI_KEY`

Uses the `[twitter-trends-api](https://rapidapi.com/codestardust27/api/twitter-trends-api)` — WOEID-based, same India trend data.

1. Go to [https://rapidapi.com/codestardust27/api/twitter-trends-api/pricing](https://rapidapi.com/codestardust27/api/twitter-trends-api/pricing) → subscribe (free tier available)
2. [https://rapidapi.com/developer/dashboard](https://rapidapi.com/developer/dashboard) → copy **X-RapidAPI-Key**

```
RAPIDAPI_KEY=...
```

---

## Social Publishing (add when ready to publish live)

### 7. Twitter / X Publishing

Same developer app as `TWITTER_BEARER_TOKEN` above, but needs **Read and Write** permissions for posting.

1. [https://developer.twitter.com/en/portal](https://developer.twitter.com/en/portal) → your app → **App permissions** → set to **Read and Write**
2. **Keys and Tokens** → regenerate **Access Token** and **Access Token Secret** (they must be regenerated after the permission change)

```
TWITTER_API_KEY=...
TWITTER_API_SECRET=...
TWITTER_ACCESS_TOKEN=...
TWITTER_ACCESS_TOKEN_SECRET=...
```

> `TWITTER_BEARER_TOKEN` is already set in the Trend Research section above. The same bearer token works here too.

### 8. Instagram Graph API

1. Go to: [https://developers.facebook.com/apps/](https://developers.facebook.com/apps/)
2. Create app → add **Instagram Graph API** product
3. Connect an Instagram Business or Creator account
4. Generate a long-lived **Page Access Token** with scopes:
  - `instagram_basic`
  - `instagram_content_publish`
  - `pages_read_engagement`
5. Copy the numeric **Instagram Business Account ID** from Instagram settings

```
INSTAGRAM_ACCESS_TOKEN=EAAB...
INSTAGRAM_ACCOUNT_ID=17841400000000000
```

### 9. LinkedIn (publishing — employer brand / work culture posts)

1. Go to: [https://www.linkedin.com/developers/apps](https://www.linkedin.com/developers/apps) → **Create App**
2. Add the **Share on LinkedIn** and **Sign In with LinkedIn** products
3. Under Auth → OAuth 2.0 Settings, add a redirect URL
4. Go through the OAuth flow to get an access token (use the OAuth 2.0 token generator in the developer portal for testing)
5. Get your LinkedIn **Person URN** or **Organization URN** (numeric ID in your profile URL)

```
LINKEDIN_ACCESS_TOKEN=AQX...
LINKEDIN_PERSON_URN=urn:li:person:abc123
# Or for a company page:
LINKEDIN_ORGANIZATION_URN=urn:li:organization:12345678
```

Note: LinkedIn tokens expire in 60 days. Refresh them via the LinkedIn OAuth 2.0 refresh token flow.

---

### 10. YouTube Channel (publishing, separate from trend research key above)

- Requires OAuth 2.0 (not just an API key) for uploading videos
- `YOUTUBE_API_KEY` alone is enough for trend research
- For publishing: create OAuth 2.0 credentials and go through the auth flow

```
YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Notifications (optional)

### 11. Slack (notifications + marketing team bot)

1. Go to: [https://api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → From Scratch
2. Under **OAuth & Permissions** → **Bot Token Scopes**, add:
  - `chat:write` — post messages
  - `files:write` — upload image cards
  - `app_mentions:read` — respond to @mentions
  - `im:read` + `im:write` — respond to DMs
  - `channels:history` — read channel messages (if listening in channels)
3. Under **Event Subscriptions** → enable and subscribe to:
  - `app_mention`
  - `message.im` (direct messages)
4. Install to workspace → copy **Bot User OAuth Token**
5. Invite the bot to your channel (`/invite @housing-marketeer`)
6. Get the channel ID from the channel URL or right-click → Copy link

For **Socket Mode** (local dev / no public URL needed):
7. Go to **Basic Information** → **App-Level Tokens** → **Generate Token**

- Name it anything (e.g. `socket-mode`)
- Add scope: `connections:write`
- Copy the token (starts with `xapp-`)

For **HTTP webhook mode** (production / behind a public URL):
7. Go to **Basic Information** → **Signing Secret** → copy it

```
SLACK_BOT_TOKEN=xoxb-...
SLACK_CHANNEL_ID=C0XXXXXXXXX

# For Socket Mode bot (python main.py slack-bot):
SLACK_APP_TOKEN=xapp-...

# For HTTP webhook mode (POST /slack/events on your server):
SLACK_SIGNING_SECRET=...
```

**Using the bot:**

- DM the bot: `Mumbai property prices are rising — create a post`
- @mention in a channel: `@housing-marketeer IPL final tonight`
- Drop a URL: `@housing-marketeer https://economictimes.com/some-re-article`
The bot replies in the same thread with generated posts for all configured platforms.

---

## Verifying your setup

After filling in `.env`, run:

```bash
python main.py run --dry-run
```

Check the log output for lines like:

```
Trend researcher: raw data collected | google=20 youtube=28 reddit=22 twitter=15 | active=google_trends,youtube_trending,reddit_viral,twitter_trends
```

Each active source confirms that key/package is working. Sources not configured will show `0` and be skipped silently.

---

## Summary table


| Key(s)                                            | Priority     | What it unlocks                                                             |
| ------------------------------------------------- | ------------ | --------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                               | **Required** | Everything — Claude for research, creative, QA                              |
| `TAVILY_API_KEY`                                  | **Required** | Web search used by the researcher agent                                     |
| `GEMINI_API_KEY`                                  | Recommended  | Gemini 2.5 Flash for fast-tier tasks — 53% cheaper than Haiku               |
| `SERP_API_KEY`                                    | Recommended  | Google News India (pre-seeds researcher) + reliable Google Trends India     |
| `YOUTUBE_API_KEY`                                 | Recommended  | Trending YouTube videos India — meme/reel signals for social posts          |
| `TWITTER_BEARER_TOKEN`                            | Recommended  | Official X trends for India (WOEID) — free, most accurate                   |
| `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET`       | Optional     | Reddit India viral posts (r/india, r/bollywood, r/Cricket)                  |
| `SERPER_API_KEY`                                  | Optional     | Fast supplementary Google News search (serper.dev — different from SerpAPI) |
| `APIFY_API_TOKEN`                                 | Optional     | Apify Twitter trends scraper (paid actor; fallback if bearer token not set) |
| `RAPIDAPI_KEY`                                    | Optional     | RapidAPI Twitter trends (third fallback for X/Twitter trends)               |
| `TWITTER_API_KEY` + secrets                       | Optional     | Live posting to Twitter/X                                                   |
| `INSTAGRAM_ACCESS_TOKEN` + `INSTAGRAM_ACCOUNT_ID` | Optional     | Live posting to Instagram                                                   |
| `YOUTUBE_CHANNEL_ID`                              | Optional     | Live YouTube uploads                                                        |
| `HOUSING_CMS_API_KEY`                             | Optional     | Publish articles to Housing.com CMS                                         |
| `SLACK_BOT_TOKEN` + `SLACK_CHANNEL_ID`            | Optional     | Slack notifications + marketing team bot                                    |
| `SLACK_APP_TOKEN`                                 | Optional     | Slack Socket Mode (for local dev without a public URL)                      |
| `SLACK_SIGNING_SECRET`                            | Optional     | Slack HTTP webhook mode (for production)                                    |


### Minimum viable setup (dev/testing)

```
ANTHROPIC_API_KEY=...
TAVILY_API_KEY=...
```

### Recommended setup (full trend research, cheaper LLM)

```
ANTHROPIC_API_KEY=...
TAVILY_API_KEY=...
GEMINI_API_KEY=...
SERP_API_KEY=...
YOUTUBE_API_KEY=...
TWITTER_BEARER_TOKEN=...
SLACK_BOT_TOKEN=...
SLACK_CHANNEL_ID=...
```

