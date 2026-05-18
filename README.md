# Housing.com AI Content Agent

Multi-agent pipeline: real estate research → trending topics → creative content → QA → publish.

## Quickstart (5 minutes)

```bash
cd real-estate-marketeer

# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure API keys
cp .env.example .env
# Edit .env — add ANTHROPIC_API_KEY and TAVILY_API_KEY at minimum

# 3. Run (dry-run mode — no live posting, output saved to output/<run_id>/)
python main.py run

# 4. Run with a topic focus
python main.py run --topic "Mumbai stamp duty reduction"

# 5. Target specific platforms
python main.py run --platforms twitter,housing_news
```

## Required API Keys

| Key | Where to get | Required? |
|---|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com | **Yes** |
| `TAVILY_API_KEY` | app.tavily.com | **Yes** |
| `GEMINI_API_KEY` | aistudio.google.com | Recommended (53% savings on fast-tier calls) |
| `SLACK_BOT_TOKEN` | api.slack.com/apps | No (skips Slack notify) |
| `APIFY_API_TOKEN` | console.apify.com | No (falls back to Google Trends) |
| `TWITTER_*` keys | developer.twitter.com | No (saves locally) |
| `INSTAGRAM_*` keys | developers.facebook.com | No (saves locally) |
| `LINKEDIN_*` keys | linkedin.com/developers | No (saves locally) |

## What it does per run

```
START
 ├─ Researcher Agent      → searches RERA, ET, PIB, builder news
 └─ Trend Researcher      → Google Trends + optional Twitter/Apify
          ↓ (both in parallel, creative waits for both)
 Creative Marketeer       → social drafts (Opus 4.7) + news drafts (Sonnet 4.6)
          ↓
 Internal Retriever       → adds housing.com SRP/locality/builder links
          ↓
 Platform Agents          → Twitter, Instagram, YouTube, Housing News, LinkedIn (async parallel)
          ↓
 QA Agent                 → Safety gate (Gemini Flash) → Quality score (Sonnet) → Engagement prediction (Sonnet)
          ↓
 Publisher                → saves to output/<run_id>/ (dry-run) or posts live
          ↓
 Slack Notifier           → posts summary to #content-published
```

## Output structure

```
output/<run_id>/
├── twitter_post.md              # tweet + thread
├── instagram_post.md            # Hinglish caption + hashtags
├── instagram_<id>.png           # PIL-generated branded card (1080×1080, purple bg)
├── youtube_post.md              # Shorts script + long-form outline
├── housing_news_post.md         # full SEO article in markdown
├── linkedin_post.md             # Hinglish employer brand post (150–350 chars, careers CTA)
└── summary.json                 # run stats, QA scores, engagement predictions, token costs
```

## Server mode (API + cron scheduler)

```bash
# Starts FastAPI on :8000 + cron (9 AM + 6 PM IST)
python main.py serve

# Manual trigger via API
curl -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true, "topic_hint": "Bengaluru metro Phase 3"}'

# Check run status
curl http://localhost:8000/runs/<run_id>
```

## View engagement history

```bash
python main.py history
```

## How the feedback loop works

1. Every published post is stored in `housing_content.db` with QA scores + predicted engagement
2. Engagement tracker jobs run at 6h, 24h, 7d after each post to fetch actual metrics
3. On the next run, the creative agent reads top/bottom performers and adjusts content strategy
4. The engagement predictor's accuracy improves over ~30 days of real data

## Cost

~$0.85 per full run after model routing optimisations (Gemini Flash for fast tier, Sonnet instead of Opus for engagement prediction and news creative). 2 runs/day = ~$51/month LLM-only; ~$178/month all-in including infra and Apify.  
See `COST_ESTIMATION.md` for the full breakdown.

## Architecture decisions

- **LangGraph**: parallel research (researcher + trend researcher run simultaneously), stateful pipeline, clean node/edge model
- **Two content tracks + employer brand**: social drafts (Zomato-style Hinglish, trend-jacked) → Twitter/Instagram/YouTube/LinkedIn (employer brand angle); news drafts (SEO-first) → Housing News only
- **Multi-provider LLM router** (`tools/llm_router.py`): Gemini 2.5 Flash for fast-tier tasks (53% cheaper than Haiku), Opus 4.7 for creative social, Sonnet 4.6 for everything else. Provider selected automatically based on which API keys are set.
- **PIL branded cards**: 1080×1080 purple cards with white Rubik text + Housing logo — no DALL-E dependency, zero image cost, faster generation
- **DRY_RUN=true default**: safe to run locally, inspect outputs before enabling live posting
- **SQLite default**: zero-config for local; change `DATABASE_URL` to Postgres for production
- **pytrends**: Google Trends with no API key; Apify is optional for richer Twitter data
- **Token cost logging**: every LLM call logs `input_tokens`, `output_tokens`, and `cost_usd` — run totals visible in logs and `summary.json`
