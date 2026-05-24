# Content Strategy

> Covers the Zomato Model, per-platform content pillars, LinkedIn employer brand strategy,
> QA decision logic in full, and the engagement feedback loop.  
> Last updated: May 2026

---

## Table of Contents

1. [The Zomato Model](#1-the-zomato-model)
2. [Platform Strategies](#2-platform-strategies)
3. [QA Decision Logic — Full Spec](#3-qa-decision-logic--full-spec)
4. [Engagement Feedback Loop](#4-engagement-feedback-loop)
5. [Content Type Reference](#5-content-type-reference)
6. [Anti-Patterns Catalogue](#6-anti-patterns-catalogue)

---

## 1. The Zomato Model

The entire content engine is built around one thesis:

> **Ride what India is already talking about. Drop the housing punchline into the conversation — don't interrupt it.**

Zomato India became a benchmark for brand social because their posts feel like they came from a witty friend who happens to know about food. The housing angle in this pipeline works the same way.

### The Formula

```
FIND:     What is India viral-about right now?
FIND:     What is the natural housing punchline to this moment?
WRITE:    Lead with the trend. Close with the punchline.
```

### Transformation Examples

| Viral moment | Housing punchline |
|---|---|
| RCB wins IPL after 18 years | "18 saal se ghar lene ki soch rahe ho bhai?" |
| Budget: ₹12L tax slab removed | "Bahana kya hai? Ghar le lo!" |
| Heatwave — 48°C in Delhi | "AC on, Housing.com kholo — wfh forever" |
| Zomato layoffs | "Zomato ne job li, ghar lo apna" |
| Champions Trophy win | "Yeh moment hai bhai — apna ghar lene ka" |
| AI replacing coders | "AI ne replace kiya, property ne nahi" → LinkedIn angle |

### What Makes It Work

1. **Emotional resonance first** — the post taps an emotion the reader already feels (FOMO, pride, fear, humour). Housing is the rational resolution.
2. **No forced angle** — if there's no genuine housing punchline, the post doesn't get made. The planner agent filters these out.
3. **Hinglish** — the voice of real India, not brand India. Code-switching signals authenticity.
4. **Short and punchy** — the platform agents enforce hard character limits. Compression is quality.

---

## 2. Platform Strategies

### 2.1 Twitter / X

**Goal:** Quote-tweet bait. Something a GenZ Indian would screenshot or RT even if they're not looking for a home.

| Dimension | Target |
|---|---|
| Format | 1-liner or 2-liner tweet + optional thread |
| Length | Main tweet ≤ 280 chars (hard constraint) |
| Voice | Hinglish, max 2 emojis, dry wit |
| Hashtags | ≤4 total; trend hashtag first |
| CTA | housing.com city SRP link (natural placement, not bolted on) |
| Image | Optional branded card; `text_only` usually outperforms |
| Quality bar | 6.5/10; `character_compliance` and `trend_dominance` are hard dimensions |

**Handle tagging rules:**
- MANDATORY for brands, sports teams, celebrities publicly active on platform
- FORBIDDEN for named politicians, ministers, billionaires (as individuals)
- Use `[LOOKUP: Name]` if unsure → `handle_resolver.py` resolves or drops

---

### 2.2 Instagram

**Goal:** A visual + caption so shareable it spreads without being asked to.

| Dimension | Target |
|---|---|
| Format | 1080×1080 branded card + Hinglish caption |
| Caption | ≤ 150 chars (hard constraint) |
| Voice | Same Hinglish wit as Twitter; card and caption must feel like one unit |
| Hashtags | 15–20 total; trend tag first → #BrandName → topic tags |
| Card formats | `branded_card` (PIL local), `meme_overlay` (source meme + text), `text_only` |
| Quality bar | 6.0/10; predicted ER ≥ 2.0% (Instagram's ER floor is higher than Twitter's) |

**Card design rule:** The caption should answer "what do I do with this?" while the card delivers the emotion. They should feel designed together, not separate.

---

### 2.3 YouTube

**Goal:** Either trend-jacking Shorts or genuine educational long-form.

| Dimension | Target |
|---|---|
| Shorts | Hook (0-3s grabs attention) → body (30-60s) → CTA |
| Long-form | Chapters, thumbnail concept, description ≤ 150 chars above fold |
| Script pacing | ~2 words/second (natural spoken rhythm) |
| Hook rule | First 3 seconds determines whether viewer swipes away |
| Title | ≤ 70 chars; primary keyword must appear |
| SEO | Category mapped (News & Politics / Education / Finance / Entertainment) |
| Quality bar | 6.0/10 · No ER floor (YouTube is long-tail discovery) |

---

### 2.4 Housing.com News (SEO Editorial)

**Goal:** Rank on Google for high-intent RE queries AND be worth reading when you land.

| Dimension | Target |
|---|---|
| Length | 700–1000 words |
| Headline | Curiosity-gap, ≤70 chars, primary keyword |
| Opener | Surprising / conversational — not "In the world of real estate..." |
| Structure | H1 → opener → H2 sections → data callout → expert take → pull quote → CTA |
| Internal links | ≥2 contextually embedded (NOT listed at the end) |
| Disclaimer | "*Prices mentioned are indicative and subject to change." — required for any article with price data |
| Pull quote | Must work as a standalone tweet |
| Quality bar | 7.0/10 · `factual_accuracy` is a hard dimension |

**Headline formula:**

```
NOT: "Pune Property Prices 2025 Update"
BUT: "The City Nobody Expected to Beat Mumbai — Pune's Quiet Property Surge in 2025"

NOT: "Mumbai Sees 10% Price Rise"
BUT: "Why Mumbaikars Are Buying in Thane Now — And Why That Changes Everything"
```

---

### 2.5 LinkedIn (Employer Brand)

**Goal:** Trend-jacking for professionals — make them want to work at this brand, not buy a home.

The LinkedIn pipeline is fundamentally different from the other platforms:

**Content is about WORKING here, not buying here.**

#### Content Pillars

| Pillar | Trigger | Angle |
|---|---|---|
| `tech_layoffs` | TCS/Infosys/IT co benches staff | "PropTech is stable because it's built on India's largest asset class" |
| `ai_replacing_jobs` | ChatGPT/Claude/AI displacing roles | "AI can't build relationships with a home-buyer who's spent 18 years saving" |
| `startup_collapse` | BYJU's/fintech/edtech news | "Real assets, real revenue — that's what this sector runs on" |
| `work_culture` | 70-hr week / WFH firing / equity debate | "Here's what working at [brand] is actually like" |
| `sales_career` | Fresher placement crisis / IIT placements | "India's most underrated high-income career: PropTech sales" |
| `proptech_growth` | Sector milestone, funding round, policy | "The sector employs 71 million — 2nd largest after agriculture" |
| `compensation` | Salary transparency trend | "Commission + ESOP — the model this market actually rewards" |
| `gen_z` | Gen Z expectations in workplace | "What we actually offer Gen Z joining ops/tech/sales" |
| `ops_non_tech` | Non-tech career visibility | "Field ops, city managers, data ops — the careers AI can't replace" |

#### Data Points (pre-verified, safe to use)

```
71 million employed (2nd largest sector after agriculture)
₹5.68 lakh crore housing sales in 2024, +16% YoY
4.6 lakh units sold in 2024 (top 7 cities)
Delhi-NCR property prices +30% in 2024
Sector target $1 trillion by 2030
GDP contribution 7.3%
Standard agent commission 1-2% per side
PropTech growing at 13-17% CAGR
```

Source attribution required: `(@ANAROCK)`, `(@NAREDCO)`, `(@IBEF)`, `(@JLL)`, `(@KnightFrank)`, `(@KPMG)`, `(@CREDAI)`

**DO NOT invent internal company figures.** Only public sector data is safe.

#### Format Rules

- Total post body: **150–400 chars** (hard constraint)
- First line: hook (reference trend directly, with trend hashtag naturally embedded)
- 2–3 follow-up lines: brand angle + public data point + source tag
- Last line: careers CTA + city link if city-specific
- English-forward (not Hinglish — LinkedIn audience is professional)
- Max 1–2 emojis
- No "thrilled", "humbled", "excited" — dry, confident, specific

---

## 3. QA Decision Logic — Full Spec

### Overview

Every post goes through 3 passes:
```
Pass 1 (fast tier): Safety gate — binary PASS/FAIL
Pass 2 (balanced): Quality scoring — per-platform dimensions
Pass 3 (fast tier): Engagement prediction — heuristic
         ↑
    Passes 2 and 3 run in parallel (asyncio.gather)
```

### Pass 1 — Safety Gate

**Hard block categories (any one → reject):**

| Category | Rule | Note |
|---|---|---|
| Religious/communal | Any content that attacks or incites hostility toward a religion, caste, or community | Government schemes (PMAY, Beti Bachao) are NOT communal |
| Political parties | BJP, Congress, AAP, etc. in promotional context | Government policies/schemes are OK |
| Defamation | Specific false claims about named builders, companies, or individuals | |
| Price guarantees | "Prices WILL rise 40% by 2027" — specific future guarantees | "Ghar ka value badhta hai" — general wisdom, not a violation |
| Housing discrimination | Content that denies/restricts access to housing based on religion/caste/gender | Content CELEBRATING women as homebuyers = inclusion, not discrimination |
| Insider information | Listed company insider claims | |
| Explicit/violent | Any graphic content | |

**Output:** `{"passed": bool, "violations": [], "violation_categories": []}`  
**Temperature:** 0.0 — deterministic.

---

### Pass 2 — Quality Thresholds

#### Per-Platform Minimum Scores

| Platform | Min Overall Score | Hard Dimensions (score < 5.0 = instant fail) |
|---|---|---|
| Twitter | 6.5 / 10 | `character_compliance` (tweet ≤ 280 chars), `trend_dominance` |
| Instagram | 6.0 / 10 | — |
| LinkedIn | 6.5 / 10 | `length_compliance` (body 150-400 chars), `employer_brand_angle` |
| Housing News | 7.0 / 10 | `factual_accuracy` |
| YouTube | 6.0 / 10 | — |

#### Decision Tree (`_decide()` in `agents/qa_agent.py`)

```python
def _decide(quality, engagement, platform):
    issues = []

    # Hard dimension check — instant fail if any critical dim < 5.0
    for dim in thresholds["hard_dims"]:
        if quality.get(dim, 10) < 5:
            issues.append(f"hard constraint: {dim}")

    # Overall quality gate
    if quality["overall_quality_score"] < thresholds["min_quality"]:
        issues.append("quality below threshold")

    # Engagement gate (only for platforms with min_er > 0)
    if thresholds["min_er"] > 0 and pred_er > 0 and pred_er < thresholds["min_er"]:
        issues.append("predicted ER below threshold")

    # Decision
    if not issues:
        return "publish"
    if quality["overall_quality_score"] >= 4.0:
        return "revise"    # fixable — send to revision agent
    return "reject"        # too far gone — drop the post
```

**Key insight:** A score of 4.0–6.5 (below threshold but not hopeless) gets a critique-driven revision attempt. A score below 4.0 is hard reject — the post failed at a fundamental level that revision won't fix.

---

### Revision Flow

When decision = `"revise"`:

1. Pass 2 quality response includes: `critique` (what's wrong, quoting the problem phrase) + `revision_instructions` (specific fixes)
2. Platform-specific revision system prompt is loaded (see `PROMPTS.md §4`)
3. Revision call: original post + critique + revision prompt → revised content
4. Revised post goes through the **full QA cycle again** (Pass 1 + 2 + 3)
5. Max `MAX_QA_RETRIES` attempts (default 2); if still failing → `reject`

**What the revision agent can fix per platform:**

| Platform | Fixable | Locked (never change) |
|---|---|---|
| Twitter | Trim to 280 chars; sharpen punchline; strengthen CTA | Cultural/trend hook; Hinglish voice; human emotion |
| Instagram | Trim caption to 150 chars; strengthen card concept; fix hashtag order | Cultural hook; card concept theme |
| LinkedIn | Employer brand CTA; length (150-400); dry wit; data attribution | Professional trend hook |
| Housing News | Headline, SEO, article structure, internal links | All factual claims — never change a stat |
| YouTube | Opening hook; script naturalness; CTA; title length | Trend/education angle |

**Hard revision rule:** If a post's trend hook was already swapped for RE data (a common failure), revision cannot salvage it. It gets `reject`. The pipeline creates a new post; it doesn't try to resurrect bad creative direction.

---

### Pass 3 — Engagement Prediction

Heuristic prediction using platform benchmarks as reference:

| Platform | Avg ER | Good ER | Viral ER | Min for publish |
|---|---|---|---|---|
| Twitter | 0.8% | 2–4% | 8%+ | 0.5% (gate active) |
| Instagram | 3% | 6–8% | 12%+ | 2.0% (gate active) |
| LinkedIn | 0.5% | 2–3% | 5%+ | 0.0% (no ER gate) |
| YouTube | 4% CTR | 8–12% | 15%+ | 0.0% (no ER gate) |
| Housing News | 1,000 sessions | 3,000+ | 5,000+/month | 0.0% (no ER gate) |

ER gate is only active for Twitter and Instagram — platforms where early engagement directly affects algorithmic distribution. YouTube, housing_news, and LinkedIn have different success metrics (long-tail discovery, SEO, professional reach) so no ER floor is applied at creation time.

**Engagement prediction is advisory for news/YouTube/LinkedIn** — the `top_element` and `weak_element` fields feed back into the revision instructions even when there's no ER gate.

---

## 4. Engagement Feedback Loop

### Overview

```
Publish time:     pred_engagement_rate stored alongside content
t+6 hours:        actual_impressions_6h, actual_likes_6h fetched
t+24 hours:       full actual metrics (impressions, likes, shares, comments, ctr, saves)
t+7 days:         actual_engagement_7d, actual_housing_traffic, prediction_accuracy
                                    ↓
              prediction_accuracy = actual_er / pred_er
                                    ↓
              top/bottom performers feed back into creative prompt (few-shot context)
```

### Scheduler Jobs (`scheduler/jobs.py`)

| Job | Trigger | What it does |
|---|---|---|
| `content_run_job` | 9:00 AM IST + 6:00 PM IST (APScheduler CronTrigger) | Full pipeline run |
| `fetch_engagement_metrics` | Scheduled at publish time for t+6h, t+24h, t+7d | Fetches actual platform metrics, stores to DB, computes prediction_accuracy |

### Engagement Tracking Status

| Platform | Tracking status | Notes |
|---|---|---|
| Twitter | ⚠️ Stub | `tweepy client.get_tweet(id, tweet_fields=["public_metrics"])` — not yet called |
| Instagram | ⚠️ Stub | Graph API insights endpoint — not yet implemented |
| Housing News | ⚠️ Stub | Requires GA4 / internal analytics API |
| LinkedIn | ⚠️ Stub | LinkedIn API insights — not yet implemented |
| YouTube | ⚠️ Stub | YouTube Analytics API — not yet implemented |

**Current state:** `_fetch_platform_metrics()` returns `None` for all platforms. The schema is in place; the API calls are stubs. Until real data populates, creative prompts use `pred_engagement_rate` as a proxy for performance history.

### Prediction Accuracy

`prediction_accuracy = actual_er / pred_engagement_rate`

Stored per post. Used to calibrate the engagement predictor over time:
- If Instagram predictions are consistently 2× actual → add calibration note to engagement system prompt
- If `prediction_accuracy < 0.3` for 7+ consecutive posts → alert (see `TECHNICAL_DESIGN.md §9.5`)

### Few-Shot Creative Improvement

`tools/creative_utils.get_performance_history()` pulls:
- Top 3 posts by actual ER (or pred ER if no actual data)
- Bottom 2 posts by actual ER

These are injected into the social creative agent's prompt as concrete examples of what this brand's audience responded to — not generic writing advice, but live calibration from real performance data.

After ~20-30 runs, this feedback loop provides meaningful signal even before the engagement trackers are implemented (using the predicted ER as a proxy).

---

## 5. Content Type Reference

### Social Draft (`draft_type: "social"`)

Target platforms: Twitter, Instagram, LinkedIn, YouTube (Shorts)

```
Fields produced by social_creative_agent:
  zomato_hook: str      — the one-liner punchline (the core creative unit)
  caption: str          — ≤150 chars for Instagram; full wit for Twitter
  hashtags: list        — trend tag first, then branded
  media_format: str     — branded_card | meme_overlay | text_only
  trend_hashtag: str    — the original viral hashtag (must stay dominant)
  meme_concept: str     — visual description if meme_overlay
```

### News Draft (`draft_type: "news"`)

Target platforms: Housing.com News, YouTube (Long-form)

```
Fields produced by news_creative_agent:
  headline: str         — curiosity-gap H1 ≤70 chars
  body: str             — 700-1000 word SEO article in markdown
  seo_keywords: list    — primary + secondary keywords
  internal_links: list  — ≥2 housing.com SRP links embedded contextually
  pull_quote: str       — excerpt that works as a standalone tweet
  meta_description: str — ≤160 chars, primary keyword present
```

---

## 6. Anti-Patterns Catalogue

These are patterns that appear in the negative examples bank and are explicitly referenced in the revision system prompts.

| Anti-pattern | Why it fails | Category |
|---|---|---|
| "Housing.com congratulates Team India! Great properties available." | No trend angle. RE is the main message, not the punchline. Reads like a banner ad. | Forced RE |
| "Property prices rising 15% — a great time to invest!" | Data-first with no emotional hook. No trend. No Hinglish. | Data-first |
| "In today's fast-paced real estate landscape, opportunity abounds..." | Generic opener, formal tone, brand-speak. | Corporate voice |
| Swapping IPL hook for "property appreciation data" to "fix RE relevance" | Kills the trend hook. QA `trend_dominance` scores 0. | Hook replacement |
| "Best properties in Mumbai at great prices! Contact us today." | Pure CTA with no editorial value. No trend. | Promotional |
| "70% of Indians dream of owning a home. Make your dream a reality." | Cliché opener, vague claim, no trend, no wit. | Generic aspirational |
| Tagging a politician's personal account in property content | Brand safety violation — politician tagging in property context is forbidden. | Safety |
| "Prices WILL rise 30% in Pune by 2027 — buy now!" | Forward-looking price guarantee — safety gate violation. | Safety |
| "Properties for Hindus/Muslims/etc." or any community-restricted listing | Discriminatory advertising — hard block. | Safety |

---

*See `PROMPTS.md` for the full system prompts that enforce these rules. See `docs/ARCHITECTURE.md §7` for the QA architecture.*
