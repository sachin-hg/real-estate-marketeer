# Technical Design Document
## Housing.com AI Content Automation Platform

**Version:** 1.0 | **Last Updated:** May 2026  
**Status:** Hackathon-ready · Pre-production  
**Audience:** Engineering, DevOps, Product, Security

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Component Architecture](#2-component-architecture)
3. [Design Decisions](#3-design-decisions)
4. [Safety Guardrails](#4-safety-guardrails)
5. [Known Pitfalls & Limitations](#5-known-pitfalls--limitations)
6. [Production Readiness Checklist](#6-production-readiness-checklist)
7. [Failure Recovery Mechanisms](#7-failure-recovery-mechanisms)
8. [Infrastructure Sizing](#8-infrastructure-sizing)
9. [Logging & Monitoring](#9-logging--monitoring)
10. [Deployment Guide](#10-deployment-guide)

---

## 1. System Overview

### 1.1 Purpose

An autonomous multi-agent pipeline that runs twice daily to:
1. Research the latest Indian real estate news and trending social topics
2. Generate platform-native content (Twitter, Instagram, YouTube, Housing.com/News)
3. Self-validate content for safety, quality, and predicted engagement
4. Publish approved content and learn from actual engagement over time

The system eliminates the human bottleneck in content production while preserving brand safety through AI-driven quality gates and a Slack kill-switch.

### 1.2 Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        TRIGGER LAYER                                     │
│   APScheduler (9 AM + 6 PM IST)  ·  FastAPI POST /run  ·  CLI           │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │ initial WorkflowState
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     LANGGRAPH ORCHESTRATOR                               │
│                                                                          │
│   ┌──────────────┐     ┌────────────────┐                               │
│   │  Researcher  │     │ Trend Research │  ← parallel super-step        │
│   │  Agent       │     │ Agent          │                               │
│   │  (Sonnet)    │     │ (Sonnet)       │                               │
│   └──────┬───────┘     └───────┬────────┘                               │
│          └──────────┬──────────┘  both complete → barrier               │
│                     ▼                                                    │
│          ┌──────────────────────┐                                        │
│          │  Creative Marketeer  │  ← Opus 4.7 + historical DB context   │
│          └──────────┬───────────┘                                        │
│                     ▼                                                    │
│          ┌──────────────────────┐                                        │
│          │  Internal Retriever  │  ← housing.com URL generation         │
│          └──────────┬───────────┘                                        │
│                     ▼                                                    │
│   ┌──────────────────────────────────────────────────────────────────┐   │
│   │           PLATFORM AGENTS  (asyncio.gather)                      │   │
│   │  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────────────┐ ┌─────┐ │   │
│   │  │ Twitter │ │Instagram │ │ YouTube │ │ Housing News │ │ LI  │ │   │
│   │  │ (Sonnet)│ │ (Sonnet) │ │ (Sonnet)│ │   (Sonnet)   │ │(Snt)│ │   │
│   │  └─────────┘ └────┬─────┘ └─────────┘ └──────────────┘ └─────┘ │   │
│   │                   │ PIL branded card (1080×1080, no API cost)    │   │
│   └──────────────────────────────────────────────────────────────────┘   │
│                     ▼                                                    │
│          ┌──────────────────────────────────────────────┐               │
│          │              QA AGENT                        │               │
│          │  Pass 1: Safety Gate    (Gemini Flash/Haiku) │               │
│          │  Pass 2: Quality Score  (Sonnet - balanced)  │               │
│          │  Pass 3: Engagement     (Gemini Flash/Haiku) │               │
│          │  [Pass 2 + 3 run in parallel]                │               │
│          └──────────────────┬────────────────────────────┘              │
│                    publish / revise / reject                             │
│                             ▼                                            │
│          ┌──────────────────────┐                                        │
│          │      Publisher       │  ← DRY_RUN → output/  OR live APIs   │
│          └──────────┬───────────┘                                        │
│                     ▼                                                    │
│          ┌──────────────────────┐                                        │
│          │   Slack Notifier     │  ← summary + kill-switch              │
│          └──────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      PERSISTENCE LAYER                                   │
│                                                                          │
│   SQLite (local) / PostgreSQL (prod)                                    │
│   published_posts table: content + QA scores + predicted engagement     │
│                                                                          │
│   Engagement Tracker (APScheduler jobs at 6h / 24h / 7d):              │
│   fetches actual metrics → updates DB → feeds back to creative agent    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Key Design Goals

| Goal | How Achieved |
|---|---|
| Zero human bottleneck | AI QA replaces approval gate; Slack kill-switch for anomalies |
| Brand safety | 3-pass QA with hard-block categories |
| Self-improving | Predicted vs actual engagement stored and fed back to creative agent |
| Cheap to run | Multi-provider LLM router (Gemini Flash / Sonnet / Opus); ~$0.85/run after optimisation |
| Safe to demo | `DRY_RUN=true` default; writes to `output/` only |
| Easy to extend | Platform agents are independent; add a new platform by adding one file |
| No image cost | PIL-generated branded cards replace DALL-E 3; zero per-image cost |

---

## 2. Component Architecture

### 2.1 Agent Inventory

| Agent | Model | Responsibility | Input | Output |
|---|---|---|---|---|
| **Researcher** | Sonnet 4.6 | Web search for RE news via Tavily; multi-turn tool use; max 5 rounds | `topic_hint` | `List[NewsItem]` |
| **Trend Researcher** | Sonnet 4.6 | Aggregates Google Trends + Apify Twitter; deduplicates vs last 48h published; adds creative hooks | Raw trend data | `List[TrendItem]` |
| **Social Creative** (`social_creative`) | Opus 4.7 | Zomato-style social drafts from ContentBriefs; reads top/bottom performers from DB; parallel with news_creative | Research + Trends + Briefs | `List[CreativeDraft]` |
| **News Creative** (`news_creative`) | Sonnet 4.6 | SEO articles (700–1000 words) from news ContentBriefs; parallel with social_creative | Research + Briefs | `List[CreativeDraft]` |
| **Internal Retriever** | Gemini 2.5 Flash (or Haiku 4.5) | Extracts city/builder/project mentions; generates housing.com URLs; routes `social_brand` intent separately | `CreativeDraft` body/zomato_hook | `List[InternalLink]` per draft |
| **Twitter Agent** | Sonnet 4.6 | Hinglish punchy tweet ≤280 chars; optional branded card; trend hashtag first | `CreativeDraft` (social) | `PlatformPost` |
| **Instagram Agent** | Sonnet 4.6 | Hinglish caption ≤150 chars; generates PIL branded card (1080×1080); meme_overlay placeholder | `CreativeDraft` (social) | `PlatformPost` + PNG |
| **YouTube Agent** | Sonnet 4.6 | Shorts script (15–60s) + long-form outline; adapts tone to social vs news draft type | `CreativeDraft` (social+news) | `PlatformPost` |
| **Housing News Agent** | Sonnet 4.6 | Full SEO article 700–1000 words; curiosity-gap headline; sparkly opener; internal links | `CreativeDraft` (news) | `PlatformPost` |
| **LinkedIn Agent** | Sonnet 4.6 | Employer brand post 150–400 chars; riffs on trending events (layoffs, AI, WFH) to showcase brand culture; careers CTA; social drafts only | `CreativeDraft` (social) | `PlatformPost` |
| **QA Agent** | Gemini Flash / Haiku (Pass 1+3), Sonnet 4.6 (Pass 2) | 3-pass: Pass 1 safety gate (fast tier, serial) → Pass 2 quality + Pass 3 engagement in parallel (asyncio.gather); platform-aware thresholds | `PlatformPost` + sources | `QAResult` + decision |
| **Publisher** | — | Routes to platform APIs or saves locally; writes to DB; schedules engagement tracker jobs | Approved posts | `List[PublishedPost]` |
| **Notifier** | — | Posts Slack summary with kill-switch; sends error alert when all posts rejected | Published posts | Slack message |

### 2.2 LangGraph Workflow DAG

```
START
  ├──→ researcher ──────────────────────────────────────────┐
  └──→ trend_researcher ────────────────────────────────────┤
                                                            │
                                        (barrier: both must complete)
                                                            │
                                                            ▼
                                                        planner
                                                            │
                                          ┌─────────────────┴─────────────────┐
                                          ▼                                   ▼
                                   social_creative                    news_creative
                                          │                                   │
                                          └─────────────────┬─────────────────┘
                                                            │
                                               (operator.add merges both lists)
                                                            │
                                                            ▼
                                              internal_retriever
                                                            │
                                                            ▼
                                              platform_agents
                                                            │
                                                            ▼
                                                       qa_agent
                                                        /       \
                              (approved_posts non-empty)         (all rejected)
                                        /                              \
                                   publisher                         notifier
                                        \                              /
                                       notifier ─────────────────────
                                            │
                                           END
```

**Parallel execution:** `researcher` and `trend_researcher` run in the same LangGraph super-step (concurrently). `planner` has incoming edges from both — it won't start until both complete (barrier synchronization, built into LangGraph's execution model).

**Creative parallelism:** `social_creative` and `news_creative` also run in parallel after `planner` completes. Both write to `creative_drafts` — LangGraph's `Annotated[list, operator.add]` reducer merges the results atomically at `internal_retriever`.

**Platform agent parallelism:** The `platform_agents` node is a single LangGraph node that internally uses `asyncio.gather` to run all 5 platform agents (Twitter, Instagram, YouTube, Housing News, LinkedIn) concurrently. This is simpler than fan-out/fan-in Send API while achieving the same effect.

### 2.3 Tool Layer

| Tool | API | Key Required | Fallback |
|---|---|---|---|
| `web_search` | Tavily | `TAVILY_API_KEY` | None — research agent fails gracefully |
| `get_google_trending_searches` | pytrends (unofficial Google Trends) | None | Returns empty list |
| `get_apify_twitter_trends` | Apify | `APIFY_API_TOKEN` | Skipped, pytrends only |
| `generate_branded_card` / `generate_branded_card_async` | PIL (local) | None | Logs warning; post published text-only |
| `llm_router.call_json_sync` / `call_json_async` | Gemini 2.5 Flash → Haiku 4.5 | `GEMINI_API_KEY` (optional) | Falls back to Haiku if Gemini key not set |
| `post_publish_summary` | Slack API | `SLACK_BOT_TOKEN` | Skipped silently |
| `_publish_twitter` | X API v2 | Twitter keys | Falls back to local file |
| `_publish_instagram` | Instagram Graph API | IG keys | Falls back to local file |
| `_publish_linkedin` | LinkedIn API v2 | LinkedIn keys | Falls back to local file |
| `_publish_housing_news` | Internal CMS API | `HOUSING_CMS_API_KEY` | Falls back to local file |
| `schedule_engagement_tracking` | APScheduler | None | Skipped if scheduler not running |

### 2.4 Data Flow

```
1. External world
   └─ Tavily (news) + pytrends/Apify (trends)
          │
          ▼
2. Research state
   research: List[NewsItem]    ← 8 stories with headline/url/summary/relevance
   trends:   List[TrendItem]   ← 15 topics with hashtag/context/creative_hook
          │
          ▼
3. Creative state
   creative_drafts: List[CreativeDraft]   ← N angles with body/hashtags/seo_keywords
   + internal_links enriched by retriever (housing.com SRP/city/builder URLs)
          │
          ▼
4. Platform state
   platform_posts: List[PlatformPost]   ← 4×N formatted posts + image URLs
          │
          ▼
5. QA state
   qa_results:     List[QAResult]       ← scores + decision per post
   approved_posts: List[PlatformPost]   ← filtered to passing posts only
          │
          ▼
6. Persistence
   published_posts DB table
   output/<run_id>/*.md files (dry-run)
          │
          ▼ (async, hours/days later)
7. Feedback
   actual_engagement_7d → feeds back into creative_marketeer as historical context
```

### 2.5 Database Schema

```sql
published_posts
├── post_id              UUID, PK
├── run_id               UUID, indexed
├── platform             twitter|instagram|youtube|housing_news
├── content              TEXT
├── hashtags             JSON string
├── internal_links       JSON string  ← housing.com URLs used
├── creative_angle       TEXT         ← what content idea drove this
│
├── qa_safety_passed     BOOLEAN
├── qa_re_relevance      FLOAT 0-10
├── qa_backlink_score    FLOAT 0-10
├── qa_brand_voice       FLOAT 0-10
├── qa_overall           FLOAT 0-10
│
├── pred_engagement_rate FLOAT        ← predicted ER at publish time
├── pred_impressions     INT
├── pred_confidence      FLOAT 0-1
│
├── actual_engagement_7d FLOAT        ← filled by tracker at t+7d  ◄─── KEY
├── actual_impressions_*               ← 6h, 24h, 7d windows
├── actual_housing_traffic INT         ← sessions to housing.com from this post
└── prediction_accuracy  FLOAT        ← actual_er / pred_er (calibration signal)
```

---

## 3. Design Decisions

### 3.1 Why LangGraph, not CrewAI or AutoGen

**Decision:** LangGraph as the orchestration framework.

**Rationale:**
- **Stateful checkpointing:** LangGraph persists state between nodes using a checkpointer (in-memory now, Postgres in prod). This means a run can resume from any failed node rather than restart from scratch.
- **Explicit graph model:** The DAG is defined in code as nodes and edges, not as natural-language role descriptions. This makes the execution model predictable and debuggable.
- **Native parallel execution:** `add_edge(START, "researcher")` + `add_edge(START, "trend_researcher")` automatically parallelises both in the same super-step. No custom threading.
- **Human-in-the-loop ready:** LangGraph's `interrupt_before` can pause any node for human approval without restructuring the entire graph (useful if we ever re-add an approval gate).

**Tradeoff accepted:** LangGraph has a steeper learning curve than CrewAI. CrewAI's role-based model is faster to prototype but gives less control over execution order and state management at scale.

---

### 3.2 Model Routing Strategy

**Decision:** Three-tier model routing with multi-provider support via `tools/llm_router.py`.

| Tier | Provider + Model | Cost (Input/Output per MTok) | Where Used |
|---|---|---|---|
| Fast | Gemini 2.5 Flash (preferred) | $0.30 / $2.50 | Safety gate, engagement prediction, internal link extraction |
| Fast (fallback) | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | $1.00 / $5.00 | Same tasks when `GEMINI_API_KEY` not set |
| Balanced | Claude Sonnet 4.6 | $3.00 / $15.00 | Research, planner, all 5 platform agents, QA quality scoring, news creative |
| Creative | Claude Opus 4.7 | $5.00 / $25.00 | Social creative content generation (Zomato-style hooks) only |

**Provider selection logic** (`llm_router.py`): For the `fast` tier, the router checks for `GEMINI_API_KEY` at call time. If set, routes to Gemini 2.5 Flash; otherwise falls back to Haiku. Balanced and Creative tiers always use Anthropic.

**Key routing decisions:**
- **Engagement predictor** was downgraded from Opus → Sonnet → fast tier: the task is schema-bound (inject platform benchmarks, output structured JSON) — fast tier handles it accurately at minimal cost; saves ~$0.15/run vs Opus
- **News creative** was downgraded from Opus → Sonnet: news drafts follow a defined schema (not free-form creativity); saves ~$0.070/run
- **Gemini 2.5 Flash** replaces Haiku for fast-tier calls: 53% cheaper ($0.30 vs $1.00 input), structured JSON output via `response_mime_type="application/json"`

**Cost impact:** Gemini Flash for safety/engagement/extraction saves ~65% on those steps vs Haiku. Sonnet for news/platform/quality instead of Opus saves ~60% on those calls. Combined: ~25% reduction in total per-run LLM cost vs original design.

---

### 3.3 Parallel Research Pattern

**Decision:** `researcher` and `trend_researcher` run in parallel as separate LangGraph nodes.

**Rationale:** Both agents are I/O-bound (they make external API calls to Tavily and pytrends). Sequential execution would mean waiting for one before starting the other. Running them in the same super-step cuts the research phase time roughly in half (~30s instead of ~60s per run).

**Implementation detail:** They write to different state keys (`research` vs `trends`), so there are no write conflicts. LangGraph merges the state updates atomically after both complete.

---

### 3.4 Async Platform Agent Execution

**Decision:** The `platform_agents` node uses `asyncio.gather` internally to run all 5 platform agents (Twitter, Instagram, YouTube, Housing News, LinkedIn) concurrently rather than using LangGraph's `Send` fan-out API.

**Rationale:** LangGraph's Send API requires each sub-agent to write to an `Annotated[list, operator.add]` field, and the join logic adds complexity when some agents fail. `asyncio.gather(return_exceptions=True)` achieves the same concurrency, handles individual failures without aborting all agents, and keeps the graph topology simpler (one node instead of 5).

**Tradeoff:** LangGraph cannot individually checkpoint each platform agent's output. If the node partially fails mid-gather, all 5 re-run on retry. Acceptable for a ~10-second operation.

---

### 3.5 SQLite → PostgreSQL Migration Path

**Decision:** SQLite as default, Postgres-ready with a single env var change.

**Rationale:** SQLite requires zero infrastructure for local development and the hackathon demo. SQLAlchemy's ORM layer is database-agnostic, so changing `DATABASE_URL` to a Postgres connection string is the only code change needed.

**When to migrate:** As soon as the scheduler runs multiple concurrent jobs (SQLite has write locks; concurrent writes will fail). In practice, migrate before deploying the scheduler in production.

---

### 3.6 DRY_RUN=true Default

**Decision:** All social media publishing is disabled by default.

**Rationale:** The cost of an accidental live post (brand damage, wrong content, offensive material) far exceeds the cost of remembering to flip a flag. Default-safe is the correct posture for any system that publishes on behalf of a brand.

**Implementation:** Every publisher path checks `settings.dry_run` first. Dry-run writes formatted markdown files to `output/<run_id>/` so the full content is reviewable without any API calls.

---

### 3.7 Three-Pass QA Architecture

**Decision:** Split QA into three sequential passes with different models rather than one combined pass.

```
Pass 1: Safety     (model_fast: Gemini Flash / Haiku)   → binary PASS/FAIL, fast, cheap
Pass 2: Quality    (model_balanced: Sonnet 4.6)          → multi-dimensional scoring, fixable issues
Pass 3: Engagement (model_fast: Gemini Flash / Haiku)    → heuristic prediction, platform benchmarks
                    ↑ Passes 2 + 3 run in parallel via asyncio.gather
```

**Rationale:**
- **Early exit saves money:** If Pass 1 fails (safety violation), Passes 2 and 3 never run. Safety violations are rare but cheap to catch early.
- **Right model for each task:** Safety is pattern-matching — Gemini Flash or Haiku is sufficient. Quality scoring requires nuanced per-platform evaluation — Sonnet. Engagement prediction is a schema-bound heuristic (not open-ended reasoning) — fast tier is sufficient.
- **Opus removed from QA entirely:** Opus was considered for engagement prediction but rejected — the task is schema-bound with platform benchmarks injected as context, not requiring creative depth. Engagement uses fast tier, saving ~$0.15/run vs Opus.
- **Platform-aware thresholds:** Pass 3 applies different minimum engagement rate thresholds per platform (Twitter 0.5%, Instagram 2.0%, YouTube/Housing News/LinkedIn 0.0% — these are not ER-driven).

**Platform engagement thresholds:**

| Platform | Min `pred_engagement_rate` | Rationale |
|---|---|---|
| `twitter` | 0.5% | Low-barrier metric; below 0.5% means algo suppression |
| `instagram` | 2.0% | Higher ER floor; IG algo heavily rewards early engagement |
| `youtube` | 0.0% | YouTube discovery is long-tail; no ER gate at creation time |
| `housing_news` | 0.0% | SEO-driven; ER not the primary success metric |
| `linkedin` | 0.0% | B2B engagement differs; no hard floor applied |

**Revision flow:** Posts that fail Pass 2 quality thresholds (not safety) get one revision attempt via the `REVISION_SYSTEM` prompt before being dropped. The revision agent returns structured JSON with both `content` and `hashtags` fields.

---

### 3.8 Internal Link Generation Approach

**Decision:** Claude (Haiku) extracts entity mentions from content, then deterministic Python functions generate the URLs.

**Why not hardcode city-to-URL mappings directly?**
The content body is free text. A post about "the new metro connecting Gurugram to Delhi NCR" needs to extract both cities, resolve "Gurugram" to the canonical slug `gurgaon`, and generate both city homepage and SRP links. A regex-based approach would miss paraphrased mentions. Claude handles this reliably in a single call.

**Why not use Claude to generate the URLs directly?**
URLs are deterministic and must be exactly correct. Hallucinated URLs (even slightly wrong) would create 404s and damage SEO. The URL generation logic in `tools/housing_urls.py` is pure Python — no model involved. Claude only does the fuzzy NLP extraction; Python does the URL construction.

---

### 3.9 Engagement Feedback Loop Design

**Decision:** Store predicted engagement at publish time; update with actual metrics at 6h/24h/7d; feed performance history back to the creative agent as few-shot context.

**Why not fine-tune the model?**
Fine-tuning is expensive, slow to iterate, and requires hundreds of examples. Providing historical performance data as in-context few-shot examples achieves similar effect after ~20-30 runs, with zero fine-tuning cost and immediate iteration.

**Key insight:** The `prediction_accuracy` column (`actual_er / pred_er`) over time tells us how well-calibrated the engagement predictor is per platform. If Instagram predictions are consistently 2x actual, we can add a calibration note to the system prompt.

---

## 4. Safety Guardrails

### 4.1 Content Safety Gate — Hard Blocks

Pass 1 of QA runs on every post before any quality or engagement evaluation. Any single violation causes an immediate **reject** with no retry.

| Category | Examples | Legal Basis |
|---|---|---|
| Religious / communal | Mentioning Hindus/Muslims/Sikhs in context of property availability or pricing | IT Act §66A; IPC §153A |
| Caste-based | SC/ST community references in housing context | Scheduled Castes Act; Housing Protection Act |
| Political | Party names, politicians, election content | Advertising Standards; reputational risk |
| Defamation | False claims about named builders, executives | IPC §499-500 |
| Price guarantees | "Guaranteed 20% returns", "best investment" without disclaimer | SEBI regulations; Consumer Protection Act 2019 |
| Discriminatory advertising | Implying property unavailable to certain religion/gender | Housing Protection Act |
| Misleading statistics | Fabricated data not matching source articles | Consumer Protection Act 2019 |
| Explicit / violent | Any graphic content | Platform policies; brand policy |

**Implementation:** `SAFETY_SYSTEM` prompt in `agents/qa_agent.py` lists all categories. The model returns structured JSON `{"passed": bool, "violations": [], "violation_categories": []}`. The decision is binary — no partial passes.

### 4.2 Quality Thresholds (Soft Gates)

Posts that pass safety but score below these thresholds are sent for one revision attempt before being dropped:

| Metric | Minimum Score | Why |
|---|---|---|
| `re_relevance_score` | 5.0 / 10 | Content must have a clear real estate angle — Housing.com audience expects it |
| `backlink_score` | 2.0 / 10 (Twitter) / 3.0 / 10 (others) | Internal links are the primary SEO and traffic mechanism; Twitter has lower expectation |
| `overall_quality_score` | 6.0 / 10 | Below this, the post would damage brand perception |
| `pred_engagement_rate` | Platform-specific (see §3.7) | Twitter: 0.5%, Instagram: 2.0%; YouTube/Housing News/LinkedIn: no ER floor |

### 4.3 Brand Voice Scoring

The quality scorer evaluates brand voice on a 0-10 scale. Housing.com's voice definition (baked into the QA system prompt):
- **Aspirational but accessible** — not elitist, not preachy
- **Expert but not jargon-heavy** — cite data, explain implications
- **Warm and helpful** — we're on the buyer's side
- **NOT:** fear-mongering ("prices dropping!" without context), pure salesy pitch, clickbait headlines that don't deliver

### 4.4 Legal Compliance Notes

These are embedded in agent system prompts, not just QA:

- **RERA compliance:** Creative agent is instructed to never quote specific project prices or promise possession dates (RERA prohibits unverified claims in marketing)
- **SEBI:** No investment return guarantees for listed builder stocks
- **Disclaimer injection:** The Housing News agent is instructed to add `*Prices mentioned are indicative and subject to change.` to all articles containing price data
- **Source attribution:** Researcher agent returns source URLs; creative agent is instructed to attribute data to named sources

### 4.5 Human Kill-Switch

Even with automated QA, the Slack notifier sends a 15-minute window notification after each publish. The message includes the content preview and a "🚫 Takedown" button.

**Implementation:** Slack interactive action → `POST /slack/action` → FastAPI handler → marks run as `taken_down` in the in-memory registry. **Note:** The actual platform API deletion (Twitter delete tweet, IG delete post) is not yet automated — it logs a warning and requires manual deletion. This is a production gap (see §6).

### 4.6 Rate Limiting Safeguards

- **Tavily:** Max 5 searches per researcher run; hardcoded in `web_search.py`
- **pytrends:** `time.sleep(1)` between calls; known to 429 aggressively without pacing
- **Anthropic API:** No explicit rate limiting in current code; rely on Anthropic's SDK auto-retry. Production: add `tenacity` retry with exponential backoff
- **Platform APIs:** Platform agents are called once per run per platform; no bulk posting loop that could exhaust quotas

---

## 5. Known Pitfalls & Limitations

### 5.1 pytrends Rate Limiting ⚠️

**Issue:** pytrends uses an unofficial Google Trends API. Google rate-limits aggressive scrapers with 429 errors. If you run the pipeline more than 3-4 times in quick succession, pytrends will fail for 30-60 minutes.

**Current mitigation:** `time.sleep(1)` between calls; trend agent logs a warning and returns empty list on failure (pipeline continues).

**Production fix:** Cache Google Trends results for 4 hours in Redis. Trends don't change minute-to-minute. Add a `@cache(ttl=4*3600)` decorator to `get_google_trending_searches`.

```python
# TODO for production
from functools import lru_cache  # or Redis-backed cache
@lru_cache(maxsize=1)  # crude: use time-based invalidation in prod
def get_google_trending_searches_cached():
    ...
```

---

### 5.2 LLM JSON Parsing Failures

**Issue:** All agents that return structured data rely on Claude producing valid JSON. Despite strong prompting, models occasionally wrap JSON in extra prose, use single quotes, or truncate at token limits.

**Current mitigation:** Every `_parse_*` function strips markdown fences, strips leading/trailing prose, and catches `json.JSONDecodeError` with a fallback return value. The pipeline continues rather than crashing.

**Production fix:** Use Claude's [structured output / tool-use trick](https://docs.anthropic.com/en/docs/tool-use) — define a tool with the exact JSON schema and force the model to call it. This eliminates JSON parsing errors entirely.

```python
# Pattern: force structured output via tool definition
tools = [{"name": "submit_content", "input_schema": CreativeDraftSchema}]
# Claude MUST call the tool → always valid JSON
```

---

### 5.3 Context Window Bloat

**Issue:** The creative agent receives research (8 items × ~200 tokens), trends (15 items × ~100 tokens), historical context (top/bottom 5 posts × ~150 tokens), and system prompt (~800 tokens). As the DB grows, the historical context grows. At 6 months of daily runs, this could be 10,000+ tokens.

**Current mitigation:** `get_performance_history()` fetches only the top 3 and bottom 2 performers (hard limit).

**Production fix:** Summarise historical context monthly — run a separate Haiku call to compress `"top 50 performers last 6 months"` into a 500-token insight paragraph, cache it, and use that instead of raw post data.

---

### 5.4 Platform API Fragility

**Issue:** Social media platform APIs change frequently and break without notice. Instagram Graph API has changed breaking behaviour 3 times in 2 years. X API pricing changed mid-2023 disrupting thousands of apps.

**Current mitigation:** Each platform agent is isolated in its own file. Failures are caught and fall back to local file save (`_save_locally`). The rest of the pipeline is not affected.

**Production fix:** Wrap all platform API calls in a circuit breaker. After 3 consecutive failures, open the circuit and skip that platform for 1 hour.

---

### 5.5 SQLite Concurrency Limits

**Issue:** SQLite uses file-level write locks. If two pipeline runs execute simultaneously (which happens in server mode with concurrent `/run` requests), write operations will block or fail with `database is locked`.

**Current mitigation:** `check_same_thread=False` in connection args allows reads across threads; writes are sequential enough for single-process use.

**Production fix:** Migrate to PostgreSQL before deploying server mode. The switch is one line in `.env`.

---

### 5.6 Token Cost Overruns

**Issue:** If `MAX_CREATIVE_DRAFTS=5` and `TARGET_PLATFORMS=twitter,instagram,youtube,housing_news`, the platform agents node runs 5×4=20 Claude calls in one go. At Sonnet rates, this is ~$1.65 just for platform agents.

**Current mitigation:** `MAX_CREATIVE_DRAFTS=3` default (3×4=12 calls), cost ~$0.99 for platform agents.

**Production fix:** Add a cost estimator before execution that calculates `drafts × platforms × avg_tokens × rate` and warns if above a threshold. Enforce a hard cap via config.

---

### 5.7 LangGraph Parallel State Merge

**Issue:** When `researcher` and `trend_researcher` both complete and write to state, LangGraph merges their outputs. If both wrote to the same key, the last writer wins. Currently they write to different keys (`research` vs `trends`) so this is safe — but future agents added to the parallel step must be careful.

**Rule:** Any agent running in the parallel research super-step must write to a unique state key. Document this explicitly when extending.

---

### 5.8 DALL-E Content Policy

**Issue:** DALL-E 3 may reject image generation prompts that contain words like "protest", "slum", "poverty", even in a real estate research context (e.g., "affordable housing in underserved areas").

**Current mitigation:** The `HOUSING_STYLE_SUFFIX` in `tools/image_generator.py` steers prompts toward aspirational/photorealistic content, reducing rejection likelihood. Failures return `None` and posts skip visuals.

**Production fix:** Implement a prompt sanitiser that strips potentially policy-violating terms before passing to DALL-E. Log all rejections to identify patterns.

---

### 5.9 Instagram Long-Lived Token Expiry

**Issue:** Instagram Graph API short-lived tokens expire in 1 hour. Long-lived tokens expire in 60 days. There is no automatic refresh — the token must be manually renewed.

**Current mitigation:** None (stub implementation).

**Production fix:** Implement the token refresh flow. Store token + expiry in DB. Run a daily scheduler job that refreshes tokens expiring within 7 days and alerts via Slack if refresh fails.

---

### 5.10 No Idempotency on Run ID Collision

**Issue:** Run IDs are `uuid4()[:8]` (8-character hex). Collision probability is low (~1 in 4 billion) but non-zero. A collision would cause DB `UNIQUE` constraint violations on `post_id` (which is a full UUID and won't collide) but could overwrite `output/<run_id>/` files.

**Production fix:** Use full UUID v4 for `run_id`. The 8-character truncation was for readability in the CLI demo.

---

## 6. Production Readiness Checklist

### 6.1 Infrastructure

| Item | Status | Action Required |
|---|---|---|
| Database | ⚠️ SQLite (local only) | Migrate to PostgreSQL (1 env var change + `pip install psycopg2-binary`) |
| State persistence | ⚠️ In-memory LangGraph | Add `PostgresSaver` checkpointer for resumable runs |
| Job queue | ⚠️ APScheduler in-process | Move to Celery + Redis or AWS SQS for reliability |
| Secret management | ⚠️ `.env` file | Use AWS Secrets Manager / GCP Secret Manager / Vault |
| File storage | ⚠️ Local `output/` directory | Move to S3 / GCS for generated images and output files |
| CDN for images | ❌ Not implemented | Generated images must be hosted on a CDN before posting to Instagram |

### 6.2 Security

| Item | Status | Action Required |
|---|---|---|
| API key rotation | ❌ Manual | Implement automatic rotation via secrets manager |
| Slack webhook validation | ❌ Not implemented | Validate Slack's `X-Slack-Signature` header on `/slack/action` |
| FastAPI authentication | ❌ None | Add API key auth or OAuth to `/run` endpoint |
| SQL injection | ✅ Safe | SQLAlchemy ORM used throughout — no raw queries |
| Prompt injection | ⚠️ Partial | News article content is passed to LLM. Add a sanitisation step stripping prompt-like patterns from scraped content |
| Rate limiting on API | ❌ None | Add `slowapi` rate limiter to prevent `/run` abuse |
| Secrets in logs | ⚠️ Risk | Ensure log level is never DEBUG in production (API keys can appear in HTTP logs) |

### 6.3 Scalability

| Item | Status | Notes |
|---|---|---|
| Horizontal scaling | ❌ Single process | Stateless agents can be extracted to workers; LangGraph supports distributed execution |
| Caching | ❌ None | Cache: Google Trends (4h TTL), historical DB context (24h TTL), Tavily results (1h TTL) |
| Batch API | ❌ Not used | Use Claude Batch API for non-urgent creative/QA calls → 50% cost reduction |
| Token caching | ❌ Not used | Enable Anthropic prompt caching on system prompts → ~25% cost reduction |
| DB connection pooling | ❌ None | Add `pool_size=5, max_overflow=10` to SQLAlchemy engine for Postgres |

### 6.4 Observability

| Item | Status | Notes |
|---|---|---|
| Structured logging | ✅ Implemented | `run_logger.py` writes per-run `run.log` with agent/model/tokens/cost/elapsed_ms |
| Distributed tracing | ❌ None | Add OpenTelemetry spans around each agent call |
| Cost tracking | ✅ Implemented | `llm_calls` + `api_calls` DB tables record every LLM/API call with token counts and `cost_usd`; `/api/analytics` exposes cost per run |
| Error tracking | ❌ None | Integrate Sentry for exception capture and alerting |
| Dashboards | ❌ None | See §9 for recommended dashboards |

### 6.5 CI/CD

| Item | Status | Action |
|---|---|---|
| Tests | ⚠️ Minimal | `tools/test_housing_urls.py` + course exercises exist; add full pytest suite for QA decision logic and JSON parsers |
| Integration tests | ❌ None | Mock Claude + Tavily; test full graph execution with fixed inputs |
| Linting | ❌ None | Add `ruff` + `mypy` to pre-commit hooks |
| Docker image | ✅ Exists | `Dockerfile` at project root; used by Railway (`railway.toml`). See §10 for docker-compose |
| Deployment pipeline | ⚠️ Railway | Auto-deploys on push to `main` via Railway GitHub integration; no explicit CI/CD pipeline for staging/prod |

### 6.6 Social API Management

| Item | Status | Action |
|---|---|---|
| Instagram token refresh | ❌ Not implemented | Daily refresh job; Slack alert if fails |
| Twitter rate limit tracking | ❌ None | Parse `x-rate-limit-remaining` headers; back off before hitting 0 |
| YouTube OAuth flow | ❌ Stub | Implement full OAuth 2.0 device flow for server-side YouTube upload |
| Post deletion (kill-switch) | ⚠️ Manual | Implement delete calls for each platform in `/slack/action` handler |

---

## 7. Failure Recovery Mechanisms

### 7.1 Node-Level Failure Isolation

Each LangGraph node catches its own exceptions and returns a partial/empty result rather than raising. This ensures the pipeline continues with degraded output rather than aborting entirely.

| Agent | On Failure | Pipeline Behaviour |
|---|---|---|
| Researcher | Returns `{"research": []}` | Creative agent runs with empty research; content will be generic |
| Trend Researcher | Returns `{"trends": []}` | Creative agent runs with news only; no trending-topic hooks |
| Creative Marketeer | Returns `{"creative_drafts": []}` | Platform/QA/publisher nodes are skipped (no drafts to process) |
| Internal Retriever | Returns drafts with empty `internal_links` | Posts generated without housing.com links; QA backlink score will be low → likely revision/reject |
| Individual Platform Agent | Exception caught by `asyncio.gather` | That platform's post is skipped; other platforms proceed |
| QA Agent (one post fails) | Post is dropped; others proceed | Run completes with fewer posts |
| Publisher (one platform fails) | Falls back to local save; others proceed | Post written to `output/` rather than live platform |
| Notifier | Logs warning | No user impact on the content itself |

### 7.2 LangGraph Checkpointing (Resumable Runs)

**Current state:** `AsyncSqliteSaver` (separate `checkpoints.db` file, enabled when `ENABLE_CHECKPOINTING=True`). State survives process restarts — runs can be resumed from the last completed node.

**Production upgrade (when moving to Postgres):**
```python
# workflow/graph.py
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

checkpointer = AsyncPostgresSaver.from_conn_string(settings.database_url)
graph = builder.compile(checkpointer=checkpointer)
```

With any persistent checkpointer, a crashed run can be resumed:
```python
# Resume a run that failed at platform_agents
graph.invoke(None, config={"configurable": {"thread_id": run_id}})
```

### 7.3 External API Retry Strategy

**Current state:** No explicit retry logic. SDK-level retries only (Anthropic SDK retries on 529/529).

**Production pattern** (add to all external tool calls):
```python
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import httpx

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.HTTPStatusError)),
)
def web_search(query, ...):
    ...
```

Recommended retry budgets per service:

| Service | Max Attempts | Wait Strategy | Timeout |
|---|---|---|---|
| Tavily search | 3 | Exponential 2-30s | 15s |
| pytrends | 2 | Fixed 5s | 30s |
| Anthropic API | SDK default (2) | SDK handles | 120s |
| DALL-E 3 | 2 | Fixed 5s | 60s |
| Platform APIs | 3 | Exponential 2-60s | 30s |

### 7.4 Graceful Degradation Map

```
Missing TAVILY_API_KEY
  → Research agent fails at import time
  → Pipeline aborts with clear error message
  → FIX: This is a hard dependency — must be set

pytrends rate limited
  → Trend researcher returns []
  → Creative agent runs with news only (no trending hooks)
  → QA: engagement score likely lower (no cultural-jacking)
  → Pipeline completes, output is publishable but less timely

Missing OPENAI_API_KEY
  → image_generator returns None
  → Instagram/housing_news posts have no images
  → Instagram QA engagement score penalised
  → Posts still published (text-only)

All platform agents fail QA
  → approved_posts = []
  → Publisher skipped
  → Notifier runs with error alert
  → run_id logged to DB for debugging

Slack not configured
  → Notification silently skipped
  → All other pipeline behaviour unchanged
```

### 7.5 Dead Letter for Failed Posts

**Current state:** Failed/rejected posts are logged but not stored for later retry.

**Production pattern:**
```python
# In qa_agent.py, store rejected posts
class RejectedPost(Base):
    __tablename__ = "rejected_posts"
    post_id = Column(String, primary_key=True)
    run_id = Column(String)
    reason = Column(String)   # safety_violation | quality_below_threshold | engagement_too_low
    content = Column(Text)
    violations = Column(Text) # JSON
    created_at = Column(DateTime)
```

This enables:
- Auditing what content the system chose not to publish (important for brand safety reviews)
- Analysing rejection patterns to improve creative agent prompts
- Manual review and re-queue if a good post was incorrectly rejected

---

## 8. Infrastructure Sizing

### 8.1 Local Development (Current)

| Component | Spec | Notes |
|---|---|---|
| Runtime | Any laptop | Python 3.10+ |
| Database | SQLite file | Zero setup |
| Storage | Local filesystem (`output/`) | |
| Scheduler | APScheduler in-process | Runs when `main.py serve` is active |

---

### 8.2 Staging (Pre-Production Validation)

Single VM, everything co-located:

| Component | Spec | Monthly Cost (ap-south-1) |
|---|---|---|
| Compute | AWS EC2 t3.medium (2 vCPU, 4 GB RAM) | ~₹3,500 |
| Database | AWS RDS PostgreSQL db.t3.micro | ~₹2,000 |
| Storage | 20 GB EBS gp3 | ~₹170 |
| **Total** | | **~₹5,670/month** |

---

### 8.3 Production — Scenario 2 (Standard: 2 runs/day)

| Component | Spec | Rationale | Monthly Cost |
|---|---|---|---|
| App Server | EC2 t3.medium or Cloud Run (1 vCPU, 2 GB) | FastAPI + APScheduler; not CPU-intensive | ~₹3,500 |
| Database | RDS PostgreSQL db.t3.small (1 vCPU, 2 GB) | Engagement tracking writes; ~1,000 rows/month | ~₹2,500 |
| Cache | ElastiCache Redis cache.t3.micro | pytrends results, historical context | ~₹1,200 |
| Storage | S3 (images) + 50 GB EBS | Generated images (~3/run × 60 runs/month = 180 images) | ~₹500 |
| CDN | CloudFront | Serve generated images to Instagram Graph API | ~₹300 |
| **Total Infra** | | | **~₹8,000/month** |

**Memory note:** Each pipeline run peaks at ~200 MB RAM (LangGraph state + concurrent async calls). t3.medium (4 GB) comfortably handles 2 concurrent runs.

---

### 8.4 Production — Scenario 3 (Scale: 3 runs/day + city-specific)

At 240 runs/month, the bottleneck shifts to DB write throughput and Redis cache size.

| Component | Spec | Monthly Cost |
|---|---|---|
| App Server | 2× EC2 t3.large (4 vCPU, 8 GB) behind ALB | ~₹14,000 |
| Database | RDS PostgreSQL db.t3.medium + read replica | ~₹8,000 |
| Cache | ElastiCache Redis cache.t3.small (2 GB) | ~₹2,500 |
| Storage | S3 + CloudFront | ~₹1,500 |
| **Total Infra** | | **~₹26,000/month** |

---

### 8.5 Memory & CPU Profile per Run

```
Run start:          ~50 MB (Python process + imports)
During research:    ~80 MB (Tavily HTTP + JSON parsing)
During creative:    ~120 MB (long prompt + response in memory)
Peak (platform agents, 4 concurrent):  ~180-200 MB
During QA:         ~120 MB (sequential passes)
After completion:  ~60 MB (state GC'd by LangGraph)

CPU: mostly idle (I/O-bound waiting on API calls)
Peak CPU: <15% on t3.medium during asyncio.gather
```

---

## 9. Logging & Monitoring

### 9.1 Current Logging Setup

Basic Python `logging` to stdout, level controlled by `LOG_LEVEL` env var.

```
2026-05-10 09:00:01 [INFO] agents.researcher: starting web search loop
2026-05-10 09:00:04 [INFO] agents.researcher: found 8 stories
2026-05-10 09:00:04 [INFO] agents.social_trend_researcher: identified 15 trends
2026-05-10 09:00:12 [INFO] agents.creative_marketeer: produced 3 drafts
2026-05-10 09:00:14 [INFO] agents.platform_orchestrator: running 12 tasks concurrently
2026-05-10 09:00:28 [INFO] agents.qa_agent: 10 approved, 2 rejected/dropped
2026-05-10 09:00:29 [INFO] agents.publisher: 10 posts handled, output in output/a3f7b2c1
```

### 9.2 Structured Logging Schema (Production Target)

Replace basic logging with JSON structured logs:

```json
{
  "timestamp": "2026-05-10T09:00:04.123Z",
  "level": "INFO",
  "run_id": "a3f7b2c1",
  "node": "researcher",
  "event": "research_complete",
  "stories_found": 8,
  "searches_made": 5,
  "duration_ms": 3120,
  "model": "claude-sonnet-4-6",
  "input_tokens": 3800,
  "output_tokens": 2000,
  "estimated_cost_usd": 0.041
}
```

Add a `cost_tracker` utility that accumulates per-run token usage and logs a summary at run end:

```json
{
  "event": "run_complete",
  "run_id": "a3f7b2c1",
  "total_cost_usd": 1.07,
  "total_input_tokens": 53700,
  "total_output_tokens": 24050,
  "posts_published": 10,
  "cost_per_post_usd": 0.107,
  "duration_seconds": 87
}
```

### 9.3 Key Metrics to Track

**Run-level metrics** (write to `content_runs` DB table or push to Datadog/CloudWatch):

| Metric | Type | Alert Threshold |
|---|---|---|
| `run_duration_seconds` | Gauge | Alert if > 180s (something hung) |
| `run_cost_usd` | Gauge | Alert if > $3.00 (cost overrun) |
| `posts_approved_count` | Counter | Alert if = 0 (all rejected; unusual) |
| `qa_safety_violations` | Counter | Alert if > 0 (investigate content source) |
| `research_stories_found` | Gauge | Alert if < 3 (Tavily may be down) |
| `trends_found_count` | Gauge | Warn if = 0 (pytrends rate limited) |

**Post-level metrics** (from engagement tracker):

| Metric | Type | Use |
|---|---|---|
| `actual_engagement_rate_7d` | Per post, per platform | Primary quality signal |
| `prediction_accuracy` | Per post | Model calibration; alert if consistently < 0.3 |
| `actual_housing_traffic` | Per post | Business value signal |
| `platform_publish_success_rate` | Counter | Platform API health |

**Cost metrics** (critical for budget management):

| Metric | Alert |
|---|---|
| Daily LLM spend | Alert if > $5/day (Scenario 2 budget) |
| Monthly LLM spend | Alert at 80% of monthly budget |
| Image generation count | Alert if unusually high (loop bug) |

### 9.4 Recommended Dashboards

**Dashboard 1: Content Performance (daily)**
- Posts published per platform per day (bar chart)
- Average predicted vs actual engagement rate (line chart, rolling 30d)
- Top 5 content angles by actual ER
- Bottom 5 content angles (to avoid)

**Dashboard 2: Pipeline Health (operational)**
- Run success/failure rate (last 7 days)
- Average run duration (line chart)
- QA rejection reasons breakdown (pie chart)
- Cost per run trend (line chart)

**Dashboard 3: SEO Impact**
- Incremental organic sessions from housing_news posts (from GA4)
- Leads generated from content traffic
- Top articles by sessions (table)
- Internal link click-through rate

### 9.5 Alerting Rules

```yaml
# PagerDuty / OpsGenie rules (priority order)

P1 - Wake someone up:
  - Run failure rate > 50% in 1 hour
  - QA safety violation detected (any content)
  - Database unreachable

P2 - Notify on-call:
  - All posts in a run rejected (posts_approved = 0)
  - Run duration > 5 minutes (timeout risk)
  - Daily cost > 2× budget
  - Instagram token expiry < 7 days

P3 - Slack #alerts:
  - pytrends rate limited (trends_found = 0)
  - DALL-E image generation failure rate > 50%
  - Prediction accuracy < 0.3 for 7+ consecutive posts
```

### 9.6 Engagement Feedback Monitoring

The feedback loop is only useful if the engagement tracker jobs actually run and populate `actual_engagement_7d`. Add a daily data quality check:

```python
# scheduler/jobs.py — add this job
async def data_quality_check():
    with get_db_session() as s:
        seven_days_ago = datetime.now() - timedelta(days=7)
        # Posts published 7+ days ago should have actual_engagement_7d populated
        missing = s.query(PublishedPostRecord).filter(
            PublishedPostRecord.published_at < seven_days_ago,
            PublishedPostRecord.actual_engagement_7d.is_(None),
            PublishedPostRecord.published_url != "dry_run",
        ).count()
        if missing > 0:
            post_error_alert("system", f"{missing} posts missing 7d engagement data — tracker jobs may have failed")
```

---

## 10. Deployment Guide

### 10.1 Local (Current)

```bash
cd real-estate-marketeer
pip install -r requirements.txt
cp .env.example .env   # add ANTHROPIC_API_KEY + TAVILY_API_KEY
python main.py run --dry-run
```

### 10.2 Docker Compose (Staging)

Create `docker-compose.yml`:

```yaml
version: "3.9"
services:
  app:
    build: .
    env_file: .env
    environment:
      - DATABASE_URL=postgresql://housing:housing@db:5432/housing_content
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "8000:8000"
    command: python main.py serve

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: housing_content
      POSTGRES_USER: housing
      POSTGRES_PASSWORD: housing
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U housing"]
      interval: 5s
      retries: 5

volumes:
  pgdata:
```

`Dockerfile`:
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "main.py", "serve"]
```

```bash
docker-compose up -d
docker-compose logs -f app
```

### 10.3 Production (AWS / GCP)

**Option A: Cloud Run (GCP) — recommended for low-ops**

```bash
# Build and push
gcloud builds submit --tag gcr.io/PROJECT/housing-content-agent

# Deploy
gcloud run deploy housing-content-agent \
  --image gcr.io/PROJECT/housing-content-agent \
  --region asia-south1 \
  --memory 2Gi \
  --cpu 2 \
  --min-instances 1 \
  --set-secrets "ANTHROPIC_API_KEY=anthropic-key:latest,TAVILY_API_KEY=tavily-key:latest"
```

**Option B: AWS ECS Fargate**

```bash
# Push to ECR, create task definition with 2 vCPU / 4 GB,
# use AWS Secrets Manager for all API keys,
# schedule via EventBridge cron instead of APScheduler
```

**Required production env changes:**
```bash
DATABASE_URL=postgresql://user:pass@rds-endpoint:5432/housing_content
DRY_RUN=false
LOG_LEVEL=INFO
```

### 10.4 Database Migration (SQLite → PostgreSQL)

```bash
# 1. Install Postgres driver
pip install psycopg2-binary

# 2. Update .env
DATABASE_URL=postgresql://user:pass@localhost:5432/housing_content

# 3. Tables auto-create on first connection (same SQLAlchemy create_all call)
python -c "from db.connection import _get_engine; _get_engine(); print('Tables created')"

# 4. Optional: migrate existing SQLite data
pip install pgloader
pgloader sqlite:///./housing_content.db postgresql://user:pass@localhost/housing_content
```

---

## Appendix A: Environment Variable Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | **Yes** | — | Claude API key (Haiku/Sonnet/Opus) |
| `TAVILY_API_KEY` | **Yes** | — | Web search for researcher agent |
| `GEMINI_API_KEY` | Recommended | — | Google Gemini 2.5 Flash for fast-tier calls; 53% cheaper than Haiku |
| `OPENAI_API_KEY` | No | — | DALL-E 3 image generation (Twitter/YouTube thumbnails) |
| `SLACK_BOT_TOKEN` | No | — | Slack notifications + bot posting |
| `SLACK_APP_TOKEN` | No | — | Socket Mode — required for `python main.py slack-bot` |
| `SLACK_SIGNING_SECRET` | No | — | Verify Slack webhook requests |
| `SLACK_CHANNEL_ID` | No | — | Target Slack channel for run summaries |
| `SERPER_API_KEY` | No | — | Serper.dev Google News (fast; falls back to Tavily if absent) |
| `SERP_API_KEY` | No | — | SerpAPI Google News + Trends India (supplement) |
| `RAPIDAPI_KEY` | No | — | Twitter Trends via RapidAPI (3rd fallback in trend chain) |
| `REDDIT_CLIENT_ID` | No | — | Reddit PRAW app client ID |
| `REDDIT_CLIENT_SECRET` | No | — | Reddit PRAW app client secret |
| `APIFY_API_TOKEN` | No | — | Twitter/X trend scraping via Apify (2nd fallback) |
| `TWITTER_API_KEY` | No | — | Twitter v2 OAuth consumer key |
| `TWITTER_API_SECRET` | No | — | Twitter v2 OAuth consumer secret |
| `TWITTER_ACCESS_TOKEN` | No | — | Twitter v2 access token |
| `TWITTER_ACCESS_TOKEN_SECRET` | No | — | Twitter v2 access token secret |
| `TWITTER_BEARER_TOKEN` | No | — | Twitter bearer token (also used for trend fetching, 1st fallback) |
| `INSTAGRAM_ACCESS_TOKEN` | No | — | Instagram Graph API long-lived token |
| `INSTAGRAM_ACCOUNT_ID` | No | — | IG Business Account ID |
| `LINKEDIN_ACCESS_TOKEN` | No | — | Live LinkedIn posting |
| `YOUTUBE_API_KEY` | No | — | YouTube Data API v3 (trending + publishing) |
| `YOUTUBE_CHANNEL_ID` | No | — | Target YouTube channel |
| `HOUSING_CMS_API_KEY` | No | — | Housing.com News CMS API |
| `HOUSING_CMS_BASE_URL` | No | `https://cms.housing.com/api/v1` | CMS endpoint override |
| `APP_NAME` | No | `NAVA` | Brand/product name (white-label override) |
| `DATABASE_URL` | No | `sqlite+aiosqlite:///./housing_content.db` | Database connection string |
| `CHECKPOINT_DB_PATH` | No | `checkpoints.db` | LangGraph AsyncSqliteSaver checkpoint file |
| `ASSETS_DIR` | No | `assets` | Path for fonts and logo (PIL image generation) |
| `ASSET_STORAGE_BACKEND` | No | `local` | `local` / `s3` / `gcs` — where generated images are stored |
| `AWS_S3_BUCKET` | No | — | S3 bucket (required when `ASSET_STORAGE_BACKEND=s3`) |
| `GCS_BUCKET` | No | — | GCS bucket (required when `ASSET_STORAGE_BACKEND=gcs`) |
| `DRY_RUN` | No | `true` | Skip live social posting |
| `HUMAN_IN_THE_LOOP` | No | `false` | Save posts as drafts awaiting human publish approval |
| `MAX_CREATIVE_DRAFTS` | No | `3` | Content ideas per run |
| `TARGET_PLATFORMS` | No | all 5 | Comma-separated platform list |
| `MAX_QA_RETRIES` | No | `2` | QA revision attempts per post |
| `ENABLE_CHECKPOINTING` | No | `true` | LangGraph run resumability via AsyncSqliteSaver |
| `ENABLE_PLANNER` | No | `true` | Planner quality-gate node |
| `ENABLE_IMAGE_GENERATION` | No | `true` | PIL branded cards + DALL-E if `OPENAI_API_KEY` set |
| `ENABLE_FILE_OUTPUTS` | No | `true` | Write `output/<run_id>/` files |
| `PLATFORM_AGENT_TIMEOUT` | No | `180` | Seconds for asyncio.gather timeout on platform agents |
| `LLM_TIMEOUT` | No | `60.0` | Seconds per individual LLM call |
| `LLM_RETRIES` | No | `2` | LLM-level retry attempts |
| `TAVILY_SEARCH_DEPTH` | No | `basic` | `basic` (1 credit) or `advanced` (5 credits) |
| `LOG_LEVEL` | No | `INFO` | Python logging level |

## Appendix B: Housing.com URL Patterns

| Page Type | Pattern | Example |
|---|---|---|
| City Homepage | `housing.com/in/buy/real-estate-<city_underscored>` | `real-estate-new_delhi` |
| City SRP | `housing.com/in/buy/<city-hyphenated>` | `new-delhi` |
| Builder Page | `housing.com/in/buy/<builder-slug>-bid` | `dlf-bid` |
| Project Microsite | `housing.com/in/buy/<project-slug>-pid` | `dlf-camellias-pid` |

39 primary market cities defined in `tools/housing_urls.py`. Common aliases handled:
`Gurugram→gurgaon`, `Bangalore→bengaluru`, `Bombay→mumbai`, `Trivandrum→thiruvananthapuram`, `Delhi NCR→new-delhi`.

## Appendix C: Model Cost Reference

| Model | Input | Output | Used For |
|---|---|---|---|
| gemini-2.5-flash | $0.30/MTok | $2.50/MTok | Safety gate, engagement prediction, internal link extraction (fast tier, preferred) |
| claude-haiku-4-5-20251001 | $1.00/MTok | $5.00/MTok | Fast-tier fallback when `GEMINI_API_KEY` not set |
| claude-sonnet-4-6 | $3.00/MTok | $15.00/MTok | Research, planner, all 5 platform agents, QA quality scoring, news creative |
| claude-opus-4-7 | $5.00/MTok | $25.00/MTok | Social creative content generation (Zomato-style hooks) only |

Estimated cost per run: **~$0.85** (base with Gemini Flash) / **~$0.98** (with 15% buffer).  
Original design was ~$1.07 before model routing optimisations.  
See `COST_ESTIMATION.md` for full monthly/annual projections.
