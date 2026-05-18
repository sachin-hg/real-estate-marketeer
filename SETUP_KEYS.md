# API Keys & Tokens Setup

All keys go into a `.env` file in the project root. Copy `.env.example` to `.env` and fill in the values below.

```bash
cp .env.example .env
```

---

## Required (pipeline won't start without these)

### 1. Anthropic (Claude)
- Go to: https://console.anthropic.com/settings/keys
- Click **Create Key**
- Copy the `sk-ant-...` value
```
ANTHROPIC_API_KEY=sk-ant-...
```

### 2. Tavily (web search — used by researcher + trend agents)
- Go to: https://app.tavily.com
- Sign up → Dashboard → copy your API key
```
TAVILY_API_KEY=tvly-...
```

---

## AI Cost Optimisation (optional — recommended)

### 2.5 Google Gemini Flash — fast-tier LLM (53% cheaper than Haiku)

The pipeline uses a tiered LLM router. The **fast tier** (entity extraction, safety gate) defaults to Claude Haiku 4.5 but automatically switches to **Gemini 2.5 Flash** when `GEMINI_API_KEY` is set — reducing those calls from $1.00/$5.00 per MTok to $0.30/$2.50 per MTok.

1. Go to: https://aistudio.google.com/apikey
2. Sign in with a Google account → click **Create API key**
3. Copy the key (starts with `AIza...`)
```
GEMINI_API_KEY=AIza...
```

**Savings:** ~$0.18/run at Scenario 2 volume (60 runs/month = ~$11/month saved).  
**Free tier:** 15 RPM / 1 million TPD — sufficient for dev and staging. Set `GEMINI_API_KEY` and it activates automatically; no other changes needed.

---

## Trend Research (add these to unlock richer trend signals)

### 3. YouTube Data API v3 — trending videos India
Unlocks: YouTube source in trend researcher (viral Shorts, music, sports clips)

1. Go to https://console.cloud.google.com/
2. Create a new project (or use an existing one)
3. Enable **YouTube Data API v3** under APIs & Services → Library
4. Go to APIs & Services → **Credentials** → Create Credentials → **API Key**
5. (Optional) Restrict it to YouTube Data API v3 only
```
YOUTUBE_API_KEY=AIza...
```
Free tier: 10,000 units/day. One trending request costs ~100 units. Safe for daily runs.

---

### 4. Reddit API — r/india, r/bollywood, r/Cricket viral posts
Unlocks: Reddit source (community-surfaced viral moments, memes, discussions)

1. Log in to Reddit → go to https://www.reddit.com/prefs/apps
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

### 5. Apify — Twitter/X trending hashtags
Unlocks: Twitter source in trend researcher

1. Go to: https://console.apify.com/account/integrations
2. Create account → copy your **API Token**
```
APIFY_API_TOKEN=apify_api_...
```
Note: Free Apify plan has limited actor compute units/month. Monitor usage at https://console.apify.com/billing.

---

## Social Publishing (add when ready to publish live)

### 6. Twitter / X API
1. Go to: https://developer.twitter.com/en/portal
2. Create a project → App → get **API Key**, **API Secret**, **Access Token**, **Access Token Secret**
3. Set app permissions to **Read and Write**
4. Also copy the **Bearer Token** for read-only calls
```
TWITTER_API_KEY=...
TWITTER_API_SECRET=...
TWITTER_ACCESS_TOKEN=...
TWITTER_ACCESS_TOKEN_SECRET=...
TWITTER_BEARER_TOKEN=...
```

### 7. Instagram Graph API
1. Go to: https://developers.facebook.com/apps/
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

### 8. LinkedIn (publishing — employer brand / work culture posts)
1. Go to: https://www.linkedin.com/developers/apps → **Create App**
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

### 9. YouTube Channel (publishing, separate from trend research key above)
- Requires OAuth 2.0 (not just an API key) for uploading videos
- `YOUTUBE_API_KEY` alone is enough for trend research
- For publishing: create OAuth 2.0 credentials and go through the auth flow
```
YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Notifications (optional)

### 10. Slack (notifications + marketing team bot)
1. Go to: https://api.slack.com/apps → **Create New App** → From Scratch
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

| Key | Required | What it unlocks |
|-----|----------|-----------------|
| `ANTHROPIC_API_KEY` | **Yes** | Everything |
| `TAVILY_API_KEY` | **Yes** | Web search (research + trend news) |
| `GEMINI_API_KEY` | Recommended | Gemini 2.5 Flash for fast tier — 53% cheaper than Haiku |
| `YOUTUBE_API_KEY` | Recommended | Trending YouTube videos India (trend research) |
| `REDDIT_CLIENT_ID` + `SECRET` | Recommended | Reddit India viral posts (trend research) |
| `APIFY_API_TOKEN` | Optional | Twitter trending hashtags |
| `TWITTER_*` | Optional | Live Twitter publishing |
| `INSTAGRAM_ACCESS_TOKEN` | Optional | Live Instagram publishing |
| `LINKEDIN_ACCESS_TOKEN` | Optional | Live LinkedIn publishing (employer brand / work culture) |
| `YOUTUBE_CHANNEL_ID` | Optional | Live YouTube publishing |
| `SLACK_BOT_TOKEN` | Optional | Slack notifications |
