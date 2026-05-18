# Design Debates — Deferred Architecture Decisions

Decisions that were evaluated and explicitly deferred rather than implemented. Recorded here
to avoid relitigating them and to document when to revisit.

---

## 1. Human-in-the-loop interrupt before publish (SKIPPED)

**What:** Use LangGraph `interrupt()` before `publisher_node` to pause the graph and let a
human approve or reject each post before it goes live.

**Why it was considered:** Automated QA can miss nuance — brand voice drift, topical
sensitivity, or timing issues a human would catch in seconds.

**Why we skipped it:**
- Requires a webhook, web UI, or Slack `/approve` command to signal graph resume
- Blocks the async execution loop while waiting — no timeout safety without extra plumbing
- Current 3-pass QA + circuit breaker already rejects unsafe/low-quality posts automatically

**When to revisit:** When we have a Slack `/approve` slash command or a web dashboard that
can send a resume signal via LangGraph's `update_state()` API. At that point, the change is
a one-liner: `interrupt(value={"pending_posts": approved_posts})` before `publisher_node`.

**Current proxy:** QA pass 1 (safety, binary gate) + pass 2 (quality, platform-specific
thresholds) act as the automated approval gate. Posts below threshold are dropped, not published.

---

## 2. Single LLM judge per QA criterion (KEEP MULTI-PASS)

**What:** Collapse the 3-pass QA (safety → quality → engagement) into a single LLM call
that scores all dimensions in one shot.

**Why it was considered:** Reduces LLM calls from 3 to 1 per post; cheaper and faster.

**Why we rejected it:**
- Safety gate must run on the fast tier (Haiku/Gemini Flash) to fail fast without wasting a
  Sonnet call. Mixing safety + quality forces the entire combined call to the slower tier.
- CIP research (2024, "LLM Judges Are Unreliable") documents systematic positional bias in
  single-judge evaluations (~60-69% favour whichever response appears second). Separate
  passes with independent contexts reduce compounding bias effects.
- Pass 3 (engagement) is a heuristic estimate and benefits from a different mental frame
  than quality scoring — separating them reduces cross-contamination.

**Decision:** Keep 3-pass design: fast tier for safety + engagement, balanced for quality.
All three passes use `temperature=0.0` for deterministic scoring.

---

## 3. FireCrawl for paywalled RE content scraping (DEFERRED)

**What:** Replace Tavily with FireCrawl for scraping paywalled real estate sources
(Economic Times Real Estate, LiveMint, Business Standard).

**Why it was considered:** Tavily returns publicly cached snippets. Paywalled articles often
have richer data (RERA orders, builder financials, city price indices) that the news agent
would benefit from.

**Why we deferred it:**
- Additional API cost + a second key to manage in `.env`
- Tavily covers 90%+ of the open-access RE sources we currently use adequately
- The benefit is marginal until we observe specific cases where Tavily misses content

**When to revisit:** When the news_creative_agent or researcher node is visibly producing
thin articles due to missing paywalled source data. At that point, evaluate FireCrawl's
`/scrape` endpoint as a targeted supplement (not a full Tavily replacement) for 2-3
high-value domains.
