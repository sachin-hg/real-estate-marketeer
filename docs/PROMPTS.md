# Prompts Reference

> Source of truth for all system prompts, few-shot strategy, and the hooks bank used in content generation.  
> Last updated: May 2026

---

## Table of Contents

1. [Creative Philosophy — The Zomato Model](#1-creative-philosophy--the-zomato-model)
2. [Agent System Prompts](#2-agent-system-prompts)
3. [QA System Prompts](#3-qa-system-prompts)
4. [Revision System Prompts](#4-revision-system-prompts)
5. [Hooks Bank (`prompts/hooks_bank.json`)](#5-hooks-bank-promptshooks_bankjson)
6. [Few-Shot Strategy — Performance History Injection](#6-few-shot-strategy--performance-history-injection)
7. [Prompting Invariants (Rules Across All Agents)](#7-prompting-invariants-rules-across-all-agents)

---

## 1. Creative Philosophy — The Zomato Model

Every social post in this pipeline follows what internally is called the **Zomato Model** — named after how Zomato India became legendary for brand content that people share even when they're not hungry.

### The Core Formula

```
TREND (viral moment)  →  HOUSING ANGLE (punchline)
     HERO                      PUNCHLINE
```

**The trend is the hero. The RE connection is the punchline — it emerges naturally, never bolted on.**

A post about the 2025 Champions Trophy win is NOT:
> "Congratulations to Team India! Housing.com has great properties in Mumbai."

It IS:
> "Yeh moment hai bhai — apna ghar lene ka 🏏 [Mumbai SRP link]"

### What This Means in Practice

| Anti-pattern | Correct pattern |
|---|---|
| Start with the RE angle, add trend as context | Start with the trend, make RE the punchline |
| "Housing.com congratulates..." | Let the trend speak first |
| Swap trend for RE data when quality fails | Fix the wit, never kill the hook |
| "Property prices rise 15%" (data-first) | "Yeh jama hua hai bhai — property game on" (emotion-first) |
| Formal English SEO copy | Hinglish wit, 2 emojis max |

### Brand Voice

- **Aspirational but accessible** — not elitist, not preachy
- **Expert but not jargon-heavy** — cite data, but explain implications simply
- **Warm and helpful** — on the buyer's side, not the builder's
- **Witty friend, not brand account** — no "thrilled", "humbled", "excited"

---

## 2. Agent System Prompts

### 2.1 Researcher Agent (`agents/researcher.py`)

**Purpose:** Multi-turn web search agent; finds 8 newsworthy RE stories from the last 48 hours.

**Key instructions baked in:**
- Searches credible RE/news domains only (see `RE_CREDIBLE_DOMAINS` in `tools/web_search.py`)
- Multi-turn tool-use loop: up to 5 search rounds, stops when ≥6 quality stories found
- Deduplicates by URL and content similarity
- Returns structured `NewsItem` objects: `headline, source, url, summary, relevance` (0–10 score)
- Skips: paywalled content with no snippet, blog spam, broker SEO listicles

---

### 2.2 Trend Researcher Agent (`agents/social_trend_researcher.py`)

**Purpose:** Aggregates viral trends from 5+ sources, enriches with Zomato-style creative hooks.

**Key instructions:**
- For each trend item: generate a `creative_hook` in Hinglish that frames the trend as a housing punchline
- Deduplicates against DB: skips hashtags published in last 48h
- Output: 15 `TrendItem` objects with `hashtag, volume, platform, context, creative_hook, city_hint, tags`
- **Critical rule baked into prompt:** "Trend hook = hero. RE = punchline. Never the reverse."

---

### 2.3 Planner Agent (`agents/planner.py`)

**Purpose:** Quality gate — filters topics and emits `ContentBrief` objects with platform routing.

**Full SYSTEM prompt key sections:**
```
You are the content planning director for [brand] India.
[Brand] is a TREND-JACKING brand — we ride viral moments with a genuine real estate angle.
High-volume and rising trends are top priority.

OMIT topics that have NO genuine RE angle. Do not force a connection.

For each ContentBrief, specify:
- draft_type: "social" | "news"
- target_platforms: one or more of twitter|instagram|youtube|housing_news|linkedin
- tone: "hinglish_viral" | "formal_seo" | "educational"
- urgency: "breaking" | "trending" | "evergreen"

Platform routing rules:
  Viral/entertainment + wordplay      → social → twitter, instagram
  IT/layoffs/career trend             → social → twitter, linkedin
  RE policy/RERA/builder news         → news  → housing_news
  Rich explainer topic                → news  → housing_news, youtube
  No plausible RE angle               → OMIT entirely
```

**Max output:** 5 social + 3 news = 8 `ContentBrief` objects per run.

---

### 2.4 Social Creative Agent (`agents/social_creative_agent.py`)

**Model:** `model_creative` (Opus 4.7) — best creative writing tier.

**Full SOCIAL_SYSTEM_BASE key sections:**
```
You are [brand] India's viral content creator.
Mission: take trending news/events and craft Zomato-style social posts that drive brand recall.
Engagement first. Real estate second.

CRITICAL RULES:
1. The TREND is the hero. Housing is the PUNCHLINE.
2. First hashtag MUST be the original trending hashtag.
3. City SRP URL embedded when any city is mentioned.
4. Media format decision: branded_card | meme_overlay | text_only
5. Avoid: religious angles, communal content, named politician tagging.
6. Max 2 social drafts per run.

TONE: Hinglish wit. GenZ resonance. Max 2 emojis.
```

**Performance history injection (few-shot):**
At runtime, the prompt is extended with top 3 and bottom 2 performers from the DB:
```python
history_ctx = get_performance_history()
# Injected as:
"""
=== POSTS THAT PERFORMED WELL (learn from these) ===
{top performers with content + actual_er}

=== POSTS THAT UNDERPERFORMED (avoid these patterns) ===
{bottom performers with content + actual_er}
"""
```

**Example injection (from `tools/example_retriever.py`):**
Tag-based retrieval from `prompts/hooks_bank.json` — top 8 positive + 2 negative examples injected into the creative prompt based on current trend tags.

---

### 2.5 News Creative Agent (`agents/news_creative_agent.py`)

**Model:** `model_balanced` (Sonnet 4.6).

**Full NEWS_SYSTEM key sections:**
```
You are [brand]'s senior content strategist and SEO editor.
Turn raw real estate news into authoritative, engaging articles that rank on Google AND are worth reading.

ARTICLE STRUCTURE:
  H1: curiosity-gap headline (≤70 chars, primary keyword)
  Opener: surprising/conversational (not "In the world of real estate...")
  H2 sections: keyword-rich anchors, each delivering a concrete insight
  Data callout: pull out the most surprising number, make it visual
  Expert take: cite a named analyst or RERA statement
  Pull quote: must work as a standalone tweet
  CTA: internal link to housing.com SRP or calculator

HEADLINE RULE:
  NOT: "Pune Property Prices 2025 Update"
  BUT: "The City Nobody Expected to Beat Mumbai — Pune's Quiet Property Surge in 2025"

DISCLAIMER: Add "*Prices mentioned are indicative and subject to change." to all articles with price data.
Max 1 news draft per run, 700–1000 words.
```

---

### 2.6 Internal Link Agent (`agents/internal_link_agent.py`)

**Model:** `model_fast` (Gemini Flash / Haiku).

**Extraction task (single prompt):**
```
From the creative draft below, extract real estate signals:
- cities: list of Housing.com markets mentioned or implied
- localities: specific areas mentioned (Bandra, Whitefield, etc.)
- filters: bedroom_count, budget_min/max, property_type
- re_intent: "buy" | "rent" | "invest" | "none"
- theme: "price_trend" | "infra" | "policy" | "lifestyle" | "viral"

Return JSON only.
```

Signal extraction feeds `tools/housing_urls.py` and `tools/housing_retriever.py` for URL construction.

---

### 2.7 Topic Researcher / Topic Trend Researcher (Direct Graph)

**Files:** `agents/topic_researcher.py`, `agents/topic_trend_researcher.py`

Same structure as the scheduled-run equivalents but constrained to a specific topic from `slack_topic` or `topic_hint`. Use Serper News (preferred) → Tavily (fallback) rather than pytrends for trend signals.

---

## 3. QA System Prompts

### 3.1 Pass 1 — Safety Gate (`SAFETY_SYSTEM`)

**Model:** `model_fast` | **Temperature:** 0.0

**Hard block categories (any one → `{"passed": false}`):**
```
- Religious/caste/communal — attacks or incites hostility
  NOTE: Government schemes (PMAY, Smart City, Beti Bachao) are NOT communal — they are national programs
- Political party names (BJP, Congress, AAP...) or election content
  NOTE: Government policies and official schemes are OK
- Defamation — specific false claims about named builders, companies, or individuals
- Forward-looking price GUARANTEES with numbers: "WILL rise 40% by 2027"
  NOT violations: "ghar ka value badhta hai", "property appreciates over time" — widely understood RE wisdom
- Housing discrimination: denying access based on religion/caste/gender
  CRITICAL: content CELEBRATING women as homebuyers is NOT discrimination — it is inclusion
- Insider information about listed companies
- Explicit, violent, or sexually suggestive content
```

**Output:**
```json
{"passed": true|false, "violations": [], "violation_categories": []}
```

---

### 3.2 Pass 2 — Quality Scoring (`_PLATFORM_QUALITY[platform]`)

**Model:** `model_balanced` | **Temperature:** 0.0

Per-platform system prompts. Each defines:
- The PURPOSE of that platform for the brand
- Dimensions to score (0.0–10.0) with weights
- Critical compliance check (character limits, factual accuracy)
- What a 9-10 vs 3-5 vs 0-2 looks like for each dimension

**Twitter dimensions:**
```
TREND_DOMINANCE (35%): Is the trend the dominant element — not housing?
  9-10: trend IS the post, housing emerges as punchline
  3-5: trend is a thin wrapper around a housing message
  0-2: no real trend hook — just a housing promo
  CRITICAL: swapping original trend for RE data = score 0

SHAREABILITY (30%): Would a GenZ Indian RT, quote-tweet, or screenshot this?

HINGLISH_WIT (25%): Natural Hinglish voice? Max 2 emojis? Wordplay present?

CHARACTER_COMPLIANCE (10%): Is main tweet ≤280 chars? (10=yes, 0=no — hard constraint)
```

**Instagram dimensions:** `card_hook_strength (30%)`, `trend_and_shareability (30%)`, `caption_punch (25%)`, `hashtag_strategy (15%)`

**LinkedIn dimensions:** `employer_brand_angle (30%)`, `trend_jacking_professional (25%)`, `tone_and_wit (25%)`, `data_credibility (10%)`, `length_compliance (10%)`

**Housing News dimensions:** `factual_accuracy (30%)`, `headline_quality (20%)`, `seo_quality (20%)`, `article_structure (15%)`, `internal_links (15%)`

**YouTube dimensions:** `hook_three_seconds (30%)`, `trend_or_education_strength (25%)`, `script_naturalness (25%)`, `data_accuracy (10%)`, `cta_and_seo (10%)`

**All Pass 2 prompts return:**
```json
{
  "overall_quality_score": 7.5,
  "failing_dimensions": [],
  "critique": "One paragraph: what specifically is weak — quote the problem phrase",
  "revision_instructions": ["Specific instruction 1", "..."],
  "<dim_1>": 8.0,
  "<dim_2>": 6.0,
  ...
}
```

**Calibration block:** Before scoring, each Pass 2 call includes a calibration block showing the last 5 approved posts for that platform with their human rating. This anchors the model's scoring to the actual bar being held:
```
The posts below PASSED QA review and were published by [brand].
Use them to calibrate your scoring — a post of similar quality should score ~7.
A post clearly sharper/wittier/more accurate than these should score 8-10.
A post worse than these should score below 7.
```

---

### 3.3 Pass 3 — Engagement Prediction (`_ENGAGEMENT_SYSTEM_TEMPLATE`)

**Model:** `model_fast` | **Temperature:** 0.0

Platform benchmarks injected at runtime:
```
Twitter:      avg_er=0.8%, good_er=2-4%, viral_er=8%+
Instagram:    avg_er=3%,   good_er=6-8%, viral_er=12%+
LinkedIn:     avg_er=0.5%, good_er=2-3%, viral_er=5%+
YouTube:      avg_ctr=4%,  good_ctr=8-12%, viral_ctr=15%+
Housing News: avg=1,000 sessions, good=3,000, viral=5,000+/month
```

Prompt asks the model to predict, given the post content and platform benchmarks:
```json
{
  "pred_impressions": 15000,
  "pred_likes": 120,
  "pred_shares": 45,
  "pred_comments": 18,
  "pred_ctr": 0.03,
  "pred_engagement_rate": 0.012,
  "pred_confidence": 0.6,
  "engagement_reasoning": "Strong IPL hook with Hinglish punchline — high shareability...",
  "top_element": "The '18 saal' callback to RCB's drought is quotable",
  "weak_element": "The housing.com CTA could be more natural"
}
```

---

## 4. Revision System Prompts

When Pass 2 returns `"revise"` (quality ≥ 4.0 but below threshold), the revision agent is called with:
1. The original post content
2. The critique from Pass 2
3. The platform-specific revision system prompt

**Revision prompts enforce: LOCK vs. FIX**

| Platform | LOCKED (never change) | FIXABLE |
|---|---|---|
| Twitter | Cultural/trend hook, Hinglish voice, human emotion tapped | Character count, shareability, CTA |
| Instagram | Cultural hook, Hinglish tone, card concept | Caption length, hashtag order, card strength |
| LinkedIn | Professional trend hook | Employer brand CTA, length, dry wit, data attribution |
| Housing News | All factual claims | Headline, SEO, article structure, internal links |
| YouTube | Trend or education angle | Opening hook, script naturalness, CTA |

**Critical rule across all platforms:**  
> If a post's trend hook was already swapped for RE data, it cannot be salvaged by revision — it gets `reject`, not `revise`.

**Revision output:**
```json
{"content": "revised content", "hashtags": ["#tag1"], "revision_summary": "one sentence"}
```

---

## 5. Hooks Bank (`prompts/hooks_bank.json`)

### Structure

```json
{
  "examples": [...],         // ~60 positive examples
  "negative_examples": [...]  // ~5 negative counter-examples
}
```

### Positive Example Schema

```json
{
  "id": "rcb-ipl-win-a",
  "event": "RCB wins IPL after 18 years",
  "tags": ["cricket", "ipl", "rcb", "celebration", "bengaluru", "viral", "18-years"],
  "card": "Ee Sala Cup Namdu! 🏆",
  "caption": "18 saal baad cup aaya... ab ghar ka time hai! 🏡 [bengaluru SRP link]",
  "city_hint": "bengaluru",
  "media_format": "meme_overlay",
  "meme_concept": "Virat Kohli crying + trophy photo",
  "hashtags": ["#EeSalaCupNamdu", "#IPL2025", "#HousingDotCom"]
}
```

### Negative Example Schema

```json
{
  "id": "neg-001",
  "event": "Generic banner ad attempt",
  "tags": ["general"],
  "card": "Real estate in India is growing.",
  "caption": "Explore our properties. Best deals. #RealEstate",
  "avoid_because": "Generic, no trend angle, reads like a banner ad — zero shareability"
}
```

### Coverage (as of May 2026)

~60 positive examples spanning:
- Cricket (IPL, Champions Trophy, World Cup)
- Entertainment (Bollywood releases, award shows, reality TV)
- Technology (AI anxiety, layoffs, ChatGPT moments)
- Economy (Budget, RBI rate decisions, inflation)
- Festivals (Diwali, Holi, Dussehra)
- Sports (Olympics, Pro Kabaddi, Formula 1)
- Current affairs (RERA milestones, infrastructure projects)
- Pop culture (viral memes, GenZ trends)

~5 negative examples showing common failures:
- Generic banner copy with no trend angle
- Forced RE angle that kills the hook
- Corporate-speak voice
- Religion/caste adjacent content
- Data-first with no hook

### How Examples Are Selected

`tools/example_retriever.py` scores each example against the current trend's tags using tag-overlap scoring. Returns top 8 positive + 2 negative examples, injected into the social creative prompt as few-shot context.

---

## 6. Few-Shot Strategy — Performance History Injection

The social creative agent uses **two sources of few-shot context**, not just the hooks bank:

### Source 1 — Hooks Bank (structural examples)
Tag-matched positive and negative examples from `prompts/hooks_bank.json`.
- Shows: what a good post looks like for THIS type of trend
- Format: card text + caption + hashtags + `AVOID THIS: WHY BAD: ...`

### Source 2 — Live Performance History (calibration)
`tools/creative_utils.get_performance_history()` queries the DB for:
- **Top 3 performers:** posts with highest `actual_engagement_rate_7d` (or `pred_engagement_rate` if no actual data yet)
- **Bottom 2 performers:** posts with lowest engagement

Injected as:
```
=== POSTS THAT PERFORMED WELL ===
Platform: twitter | ER: 4.2% | Content: [full post text]
Platform: instagram | ER: 8.1% | Content: [full post text]

=== POSTS THAT UNDERPERFORMED ===
Platform: twitter | ER: 0.3% | Content: [full post text]
```

**Why this works without fine-tuning:** After ~20-30 runs, the model has live calibration data for what this specific brand's audience responds to — not generic examples. As actual engagement data populates (6h/24h/7d tracker jobs), the quality of the feedback signal improves.

**Context growth concern:** Capped at 5 total posts (3 top + 2 bottom) in `get_performance_history()` to prevent context bloat as the DB grows.

---

## 7. Prompting Invariants (Rules Across All Agents)

These rules are repeated in every agent's system prompt and reinforced in the QA system:

| Rule | Enforcement |
|---|---|
| Trend hook = hero, RE = punchline | Social creative, QA `TREND_DOMINANCE` dim |
| First hashtag MUST be the original trending hashtag | Platform agents, QA `hashtag_strategy` |
| No named politicians tagged (only government schemes OK) | Safety gate, creative prompt guardrail |
| No forward-looking price guarantees with numbers | Safety gate |
| City SRP URL when any city is named | Creative prompt, internal link agent |
| Max 2 emojis (social posts) | Platform agent prompts |
| Hinglish voice on Twitter/Instagram | Creative + revision prompts |
| `[LOOKUP: EntityName]` placeholder for uncertain handles | Twitter and LinkedIn agents |
| Disclaimer for articles with price data | News creative prompt |
| Never swap trend for RE data to fix quality | QA revision system — explicit lock |
| `overall_quality_score < 4` → reject (no revision) | `_decide()` function |
