# AI Content Automation Platform — Cost Estimation

### Housing.com | Presented to Senior Leadership

**Prepared:** May 2026 | **Version:** 1.0

---

## Executive Summary

The proposed AI multi-agent content platform automates end-to-end creation and
publishing of real estate marketing content across Twitter/X, Instagram, YouTube,
and Housing.com/News — from research to live post — with zero human bottleneck.

**The economic case in one paragraph:**
At the standard operating cadence of 2 content runs per day, the all-in operational
cost is **₹14,300/month (~$170/month)** after model routing optimisations (PIL image generation,
Gemini 2.5 Flash for fast-tier tasks, Sonnet for engagement prediction). This produces **300 pieces
of platform-ready content per month** across 5 channels (Twitter, Instagram, YouTube, Housing.com/News,
LinkedIn). Equivalent output from a content agency would cost **₹8–10 lakh/month**. After a
one-time development investment of **~₹45 lakh**, the system pays for itself in under **2 months**
of operation.

---

## 1. Pricing Reference

*All Claude API prices fetched May 2026 from platform.claude.com.*

### 1.1 Claude API (Anthropic)


| Model             | Input        | Output        | Cache Write (5-min) | Cache Read   |
| ----------------- | ------------ | ------------- | ------------------- | ------------ |
| claude-opus-4-7   | $5.00 / MTok | $25.00 / MTok | $6.25 / MTok        | $0.50 / MTok |
| claude-sonnet-4-6 | $3.00 / MTok | $15.00 / MTok | $3.75 / MTok        | $0.30 / MTok |
| claude-haiku-4-5  | $1.00 / MTok | $5.00 / MTok  | $1.25 / MTok        | $0.10 / MTok |


*Batch API (non-real-time, 24h window): 50% discount across all models.*

### 1.2 Google Gemini API

| Model              | Input        | Output        | Notes                               |
| ------------------ | ------------ | ------------- | ----------------------------------- |
| gemini-2.5-flash   | $0.30 / MTok | $2.50 / MTok  | Fast-tier; replaces Haiku for extraction + safety gate |

*Free tier: 15 RPM / 1M tokens/day — sufficient for dev and staging. Activate via `GEMINI_API_KEY` in `.env`.*

### 1.3 Other Services


| Service            | Unit                       | Rate             | Notes                              |
| ------------------ | -------------------------- | ---------------- | ---------------------------------- |
| PIL image gen      | Per image (1080×1080 PNG)  | $0.000           | Local Python generation, no API    |
| Tavily Search      | Per search                 | $0.008           | News research                      |
| X / Twitter API    | Per post with URL          | $0.200           | Credit-based, no monthly tier      |
| Apify              | Platform credits           | $29/mo (Starter) | Social trend scraping              |
| Twilio WhatsApp    | Per message                | ~$0.005          | Monitoring alerts only             |
| AWS RDS PostgreSQL | db.t3.small, ap-south-1    | ~₹2,500/mo       | Engagement store                   |
| AWS ElastiCache    | cache.t3.micro, ap-south-1 | ~₹1,200/mo       | Workflow state                     |
| EC2 / Compute      | t3.medium                  | ~₹3,500/mo       | Orchestrator + API server          |

*DALL-E 3 has been removed: social images are now generated locally via PIL (1080×1080 purple branded cards with white Rubik text + Housing logo). Zero per-image API cost.*


---

## 2. Per-Run Cost Breakdown

One "run" = one end-to-end execution: research → content creation → QA → publish
to all 4 platforms (Twitter, Instagram, YouTube, Housing.com/News).

### 2.1 LLM Token Usage

*Updated to reflect model routing optimisations: Gemini 2.5 Flash for fast tier, Sonnet for engagement prediction and news creative, reduced max_tokens across agents.*


| Agent                               | Model             | Input (tokens) | Output (tokens) | Cost       |
| ----------------------------------- | ----------------- | -------------- | --------------- | ---------- |
| Researcher (max 5 rounds)           | Sonnet 4.6        | 3,200          | 1,600           | $0.034     |
| Trend Researcher                    | Sonnet 4.6        | 3,000          | 1,500           | $0.032     |
| Creative Marketeer — Social         | Opus 4.7          | 5,500          | 3,800           | $0.123     |
| Creative Marketeer — News           | Sonnet 4.6        | 2,800          | 2,000           | $0.038     |
| Internal Retriever (×5 drafts)      | Gemini 2.5 Flash  | 12,500         | 3,000           | $0.011     |
| QA — Safety Gate (×5 posts)         | Gemini 2.5 Flash  | 3,000          | 1,000           | $0.004     |
| QA — Quality Scorer (×5 posts)      | Sonnet 4.6        | 6,000          | 3,000           | $0.063     |
| QA — Engagement Predictor (×5 posts)| Sonnet 4.6        | 7,500          | 3,000           | $0.068     |
| Platform Agents (×5 platforms)      | Sonnet 4.6        | 9,500          | 4,500           | $0.096     |
| Revision Agent (30% of runs)        | Sonnet 4.6        | 900            | 450             | $0.009     |
| **LLM Subtotal**                    |                   | **53,900**     | **23,850**      | **$0.478** |

*LinkedIn is the 5th platform (news drafts only, Sonnet 4.6). Gemini Flash pricing applied to retriever + safety gate. Engagement predictor downgraded from Opus ($0.150) to Sonnet ($0.068) — 55% saving on that step alone.*


### 2.2 Non-LLM Per-Run Costs


| Service                           | Usage per Run | Cost       |
| --------------------------------- | ------------- | ---------- |
| PIL image generation (branded card) | 1–3 images  | $0.000     |
| X API post (with housing.com URL) | 1 tweet       | $0.200     |
| Tavily web search                 | 5 searches    | $0.040     |
| **Non-LLM Subtotal**              |               | **$0.240** |

*DALL-E 3 removed ($0.240 savings per run). Images generated locally via PIL — Rubik Bold font + Housing logo, 1080×1080 PNG.*

### 2.3 Total Per-Run


|                                            | Cost                |
| ------------------------------------------ | ------------------- |
| Base cost per run                          | **$0.718**          |
| + 15% buffer (retries, failures, overruns) | $0.108              |
| **Fully-loaded cost per run**              | **~$0.83 (~₹70)**   |

*Previous baseline: $1.25 fully-loaded. Optimisations saved ~$0.42/run (34%): PIL cards (–$0.240), Gemini Flash (–$0.024), engagement Sonnet vs Opus (–$0.082), news creative Sonnet vs Opus (–$0.070), reduced max_tokens (–$0.021).*

> **City-specific run** (no research step, just creative + QA + publish for one city):
> ~$0.50/run (~₹42). Used when generating city-targeted content in Scenario 3.

---

## 3. Monthly & Annual Operating Cost Scenarios

### Scenario 1 — Conservative (Pilot / Month 1–2)

*1 run/day · 5 platforms · No city-specific content*


| Cost Line               | Monthly               | Annual                   |
| ----------------------- | --------------------- | ------------------------ |
| LLM API (Claude+Gemini) | $14.34                | $172.08                  |
| PIL image generation    | $0.00                 | $0.00                    |
| X API posting           | $6.00                 | $72.00                   |
| Tavily search           | $1.20                 | $14.40                   |
| Apify (Starter)         | $29.00                | $348.00                  |
| Twilio WhatsApp         | $2.00                 | $24.00                   |
| AWS infrastructure      | $95.00                | $1,140.00                |
| **Total**               | **$148 (~₹12,400)**   | **$1,770 (~₹1.49 lakh)** |
| Output                  | 150 content pieces/mo | 1,800/year               |

*(150 pieces = 5 platforms × 30 runs. Previous estimate was 120 across 4 platforms.)*


---

### Scenario 2 — Standard (Steady State) ⭐ Recommended

*2 runs/day · 5 platforms · No city-specific content*


| Cost Line               | Monthly               | Annual                   |
| ----------------------- | --------------------- | ------------------------ |
| LLM API (Claude+Gemini) | $28.68                | $344.16                  |
| PIL image generation    | $0.00                 | $0.00                    |
| X API posting           | $12.00                | $144.00                  |
| Tavily search           | $2.40                 | $28.80                   |
| Apify (Starter)         | $29.00                | $348.00                  |
| Twilio WhatsApp         | $3.00                 | $36.00                   |
| AWS infrastructure      | $95.00                | $1,140.00                |
| **Total**               | **$170 (~₹14,300)**   | **$2,041 (~₹1.71 lakh)** |
| Output                  | 300 content pieces/mo | 3,600/year               |

*(300 pieces = 5 platforms × 60 runs. Savings vs original design: ~$21/month from image gen removal + model optimisations.)*


---

### Scenario 3 — Aggressive (Scale)

*3 runs/day · 4 platforms · + City-specific content for top 5 cities (1 run/city/day)*


| Cost Line                         | Monthly               | Annual                   |
| --------------------------------- | --------------------- | ------------------------ |
| Claude API — generic runs (90/mo) | $53.19                | $638.28                  |
| Claude API — city runs (150/mo)   | $67.50                | $810.00                  |
| Image generation (240 runs × 3)   | $57.60                | $691.20                  |
| X API posting (240 posts)         | $48.00                | $576.00                  |
| Tavily search (90 runs × 5)       | $3.60                 | $43.20                   |
| Apify (Scale — higher volume)     | $199.00               | $2,388.00                |
| Twilio WhatsApp                   | $5.00                 | $60.00                   |
| AWS infrastructure (upgraded)     | $150.00               | $1,800.00                |
| **Total**                         | **$584 (~₹49,000)**   | **$7,006 (~₹5.88 lakh)** |
| Output                            | 720 content pieces/mo | 8,640/year               |


---

## 4. One-Time Development Investment

*Based on Housing.com senior SDE market rates (Bengaluru/Mumbai), 4-month build.*


| Resource                             | Allocation     | Cost                      |
| ------------------------------------ | -------------- | ------------------------- |
| 2 × Senior SDE (Python, LLM systems) | 100%, 4 months | ₹26.7 lakh                |
| 1 × DevOps / Cloud Engineer          | 50%, 4 months  | ₹5.0 lakh                 |
| 1 × Product Manager (existing team)  | 20%, 4 months  | ₹2.7 lakh                 |
| QA, testing, integration cycles      | Fixed          | ₹3.0 lakh                 |
| Third-party API setup and testing    | Fixed          | ₹1.5 lakh                 |
| Contingency buffer (20%)             | —              | ₹7.8 lakh                 |
| **Total Development**                |                | **₹46.7 lakh (~$55,600)** |


> Excludes: ongoing maintenance (~₹5–8 lakh/year, covered by existing team capacity).

---

## 5. Three-Year Total Cost of Ownership

*Using Scenario 2 (Standard) as the baseline.*


|                                 | Year 1         | Year 2        | Year 3        | 3-Year Total   |
| ------------------------------- | -------------- | ------------- | ------------- | -------------- |
| Development (one-time)          | ₹46.7 lakh     | —             | —             | ₹46.7 lakh     |
| Operational (API + infra)       | ₹1.92 lakh     | ₹2.10 lakh*   | ₹2.30 lakh*   | ₹6.32 lakh     |
| Maintenance (est. 10% eng time) | ₹6.0 lakh      | ₹6.0 lakh     | ₹6.0 lakh     | ₹18.0 lakh     |
| **Total**                       | **₹54.6 lakh** | **₹8.1 lakh** | **₹8.3 lakh** | **₹71.0 lakh** |


*~10% YoY growth in volume/API usage assumed.*

---

## 6. ROI Analysis

### 6.1 Cost Displacement: Content Production

The system's output replaces a combination of in-house team + agency spend.


| Content Type                            | Volume / Month | Agency Rate    | Monthly Value       |
| --------------------------------------- | -------------- | -------------- | ------------------- |
| Social media posts (Twitter, IG)        | 120 posts      | ₹3,000/post    | ₹3.6 lakh            |
| LinkedIn employer brand posts           | 60 posts       | ₹2,500/post    | ₹1.5 lakh            |
| YouTube scripts / Shorts                | 60 scripts     | ₹4,000/script  | ₹2.4 lakh            |
| Housing.com/News SEO articles           | 60 articles    | ₹5,000/article | ₹3.0 lakh            |
| **Total content value (agency equiv.)** | **300 pieces** |                | **₹10.5 lakh/month** |


*System operational cost (Scenario 2): ₹14,300/month*
*Net monthly saving vs agency: **₹10.07 lakh/month***

---

### 6.2 Traffic & Lead Generation Value

Each Housing.com/News article, once indexed, drives long-tail organic traffic.


| Metric                                  | Conservative   | Base          | Optimistic   |
| --------------------------------------- | -------------- | ------------- | ------------ |
| Articles published/month                | 60             | 60            | 60           |
| Organic sessions per article (30-day)   | 500            | 1,200         | 3,000        |
| Total incremental organic sessions/mo   | 30,000         | 72,000        | 180,000      |
| Conversion to leads (session → lead)    | 1.5%           | 2.5%          | 4.0%         |
| Incremental leads/month                 | 450            | 1,800         | 7,200        |
| Revenue per lead (builder monetization) | ₹300           | ₹400          | ₹500         |
| **Monthly revenue impact**              | **₹1.35 lakh** | **₹7.2 lakh** | **₹36 lakh** |


> Social media backlinks also improve domain authority, compounding organic rankings
> for existing Housing.com pages — not captured above.

---

### 6.3 Payback Period


| Scenario                     | Monthly Net Benefit | Development Cost | Payback         |
| ---------------------------- | ------------------- | ---------------- | --------------- |
| Cost savings only            | ₹8.84 lakh          | ₹46.7 lakh       | **~5.3 months** |
| Savings + Base traffic value | ₹16.04 lakh         | ₹46.7 lakh       | **~2.9 months** |
| Savings + Optimistic traffic | ₹44.84 lakh         | ₹46.7 lakh       | **~1.0 month**  |


**3-Year NPV (10% discount rate, Base scenario): ~₹4.9 crore**

---

## 7. Cost Optimisation Levers

### Already Implemented (active in current codebase)

#### 7.0 PIL Branded Cards — replaces DALL-E 3 ✅ DONE

Local PIL generation of 1080×1080 PNG cards (purple bg, white Rubik text, Housing logo).
**Savings: $0.240/run → $14.40/month at Scenario 2 volume (~₹1,210/month).**
Zero quality tradeoff for social posts — branded consistency is actually improved.

#### 7.0b Gemini 2.5 Flash for Fast Tier ✅ DONE

`tools/llm_router.py` routes safety gate and entity extraction to Gemini 2.5 Flash
($0.30/$2.50/MTok) when `GEMINI_API_KEY` is set; falls back to Haiku.
**Savings: ~$0.024/run → ~$1.44/month at Scenario 2 volume (~₹121/month).**

#### 7.0c Engagement Predictor Sonnet vs Opus ✅ DONE

QA Pass 3 downgraded from Opus 4.7 → Sonnet 4.6 (structured schema prediction,
not open-ended creative reasoning). **Savings: ~$0.082/run → ~$4.92/month (~₹413/month).**

#### 7.0d News Creative Sonnet vs Opus ✅ DONE

Creative Marketeer news track uses Sonnet 4.6 instead of Opus 4.7.
**Savings: ~$0.070/run → ~$4.20/month (~₹353/month).**

#### 7.0e Reduced max_tokens across agents ✅ DONE

Housing News (4096→2200), YouTube (2000→1500), Social creative (6000→4000), News creative (4000→2500), Researcher (multi-round, max 5 rounds).
**Combined savings: ~$0.021/run → ~$1.26/month (~₹106/month).**

---

### Available Post-Launch

#### 7.1 Claude Batch API (–50% on LLM)

For scheduled content (tomorrow's posts prepared today), use the Batch API.
Applies to: Creative Marketeer, Platform Agents (not QA safety — must be real-time).
Estimated LLM savings: **~₹2,400/month** at Scenario 2 volume.
*Tradeoff: up to 24-hour processing window. Unsuitable for breaking news runs.*

#### 7.2 Prompt Caching on Historical Context (–15% on Opus calls)

The historical performance context fed to the Creative agent is static within a
24-hour window. Writing it to a cache and reading it on subsequent calls drops
per-read cost by 90%. Most system prompts are under the 1024-token minimum for
Anthropic caching, so this applies mainly to the creative_marketeer social prompt
with injected examples (~1,500 tokens).
Estimated savings: **~₹800/month** at Scenario 2 volume.
*Implementation effort: 2–4 hours.*

#### 7.3 QA Quality Scorer Downgrade (–33% on that step)

Route QA Quality Scorer from Sonnet 4.6 to Haiku 4.5 once the evaluation rubric
is stable and validated. Haiku is adequate for structured scoring tasks.
Estimated savings: **~₹530/month** at Scenario 2 volume.

### 7.4 Combined Cost Summary (Scenario 2)


|                     | Original (pre-optimisation) | Current (implemented) | Further optimised |
| ------------------- | --------------------------- | --------------------- | ----------------- |
| Monthly operational | ₹16,000                     | **~₹14,300**          | **~₹11,000**      |
| Annual operational  | ₹1.92 lakh                  | **~₹1.71 lakh**       | **~₹1.32 lakh**   |
| 3-Year operational  | ₹6.32 lakh                  | **~₹5.15 lakh**       | **~₹3.96 lakh**   |


---

## 8. Risks & Mitigations


| Risk                                            | Probability | Impact | Mitigation                                                                                                 |
| ----------------------------------------------- | ----------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| X/Twitter API pricing change                    | Medium      | Low    | X API is now credit-based; $0.20/post is low. Buffer 30% in budget.                                        |
| Claude API price increase                       | Low         | Medium | Contractual enterprise pricing available at scale; Batch API hedges.                                       |
| Content volume scale-up (city-specific)         | High        | Medium | Marginal cost is near-linear and predictable. Scenario 3 already modelled.                                 |
| QA agent misses a safety violation              | Low         | High   | Add human spot-check of 5% of posts (sampled). Keep Slack kill-switch.                                     |
| Image generation cost (if volume increases)     | Medium      | Low    | Switch to self-hosted Stable Diffusion on a single GPU instance (~₹5,000/mo fixed) at >1,000 images/month. |
| Social platform API access (Instagram, YouTube) | Low         | High   | These APIs are free; risk is rate limits, not cost.                                                        |


---

## 9. Assumptions

1. **Token counts** are estimates based on prompt design; actual usage may vary ±25%.
  Recommended: instrument the first 2 weeks of production to calibrate actuals.
2. **DALL-E 3 pricing** is based on OpenAI's published HD rate of $0.080/image
  (1024×1024). Verify at platform.openai.com before go-live.
3. **AWS infrastructure** costs are estimates for ap-south-1 (Mumbai) on-demand
  pricing. Reserved Instances (1-year commit) reduce compute/DB costs by ~30%.
4. **Content agency rates** (₹3,000–5,000/piece) are based on mid-market Indian
  digital agencies for real estate clients. Actual Housing.com agency rates may differ.
5. **Lead revenue** (₹300–500/lead) is illustrative. Actual monetization depends on
  Housing.com's builder pricing agreements and attribution model.
6. **Development timeline**: 4 months assumes engineers with prior LLM/agent
  system experience. Add 4–6 weeks if onboarding is required.
7. **Exchange rate**: ₹84 / USD used throughout.

---

## 10. Recommendation


| Decision                   | Recommended                                                                      |
| -------------------------- | -------------------------------------------------------------------------------- |
| Proceed with development?  | **Yes**                                                                          |
| Initial operating scenario | **Scenario 1 (Conservative)** for months 1–2, then Scenario 2                    |
| Primary cost optimisation  | **Batch API** for scheduled runs (implement at launch)                           |
| Human oversight model      | Automated QA with Slack kill-switch (no blocking approval)                       |
| Review checkpoint          | 90-day post-launch: compare predicted vs actual engagement; adjust model routing |


> The financial case is clear. The more important long-term asset is the
> **performance feedback loop**: every published post teaches the system what
> Housing.com's audience responds to. This compound improvement in content quality
> is not captured in the ROI figures above, but represents the primary strategic
> value of the platform at 12–24 months.

