# Demo Video Script & Recording Guide
## Housing.com AI Content Engine — Hackathon 2026

**Target length:** 4–5 minutes
**Audience:** CTOs, CMOs, CEOs, CPOs, Directors of Engineering/Marketing/Product
**Tone:** Confident, fast-paced, results-first. Show don't tell.

---

## Pre-Recording Setup Checklist

```bash
# Terminal 1 — main demo
cd /Users/sachinagrawal/ai-agents/real-estate-marketeer
source .env  # ensure keys are loaded

# Terminal 2 — serve the dashboard (open before recording)
python main.py serve
# → open http://localhost:8000 in browser

# Browser tabs to pre-open (in order):
# 1. http://localhost:8000 (React dashboard)
# 2. output/080af0ce/twitter_post.md (sample Twitter output)
# 3. output/080af0ce/instagram_post.md (sample Instagram output)
# 4. output/080af0ce/instagram_image.png (branded card)
# 5. output/080af0ce/housing_news_post.md (SEO article)

# Window layout:
# Left half: Terminal (large, dark theme, 18pt font)
# Right half: Browser with dashboard

# Recording tool: QuickTime → New Screen Recording (or Loom, OBS)
# Resolution: 1920×1080, 60fps
# Microphone: on (use the narration script below)
```

---

## Scene 1 — Hook (0:00–0:30)

**[Screen: Dashboard open, showing previous run history]**

**Narration:**
> "What you're looking at is a live run of Housing.com's AI Content Engine — a system that just turned a trending news story about RERA show-cause notices into a Twitter thread, an Instagram story carousel, a Reel concept, and an 800-word SEO article. In 97 seconds."

*[Click into run `080af0ce` in the dashboard — show the QA summary table]*

> "4 posts published. 3-pass quality check passed on all of them. And it cost roughly 43 cents."

*[Pause 2 seconds. Let that number land.]*

> "The same output from a human content team: 4–6 hours, ₹10,000–15,000 fully loaded. Let me show you exactly how it works."

---

## Scene 2 — Live Run (0:30–2:15)

**[Screen: Terminal, full width. Type slowly so viewers can read.]*

**Narration:**
> "I'm going to trigger a fresh run right now. One command."

*[Type and run:]*
```bash
python main.py run
```

> "The pipeline has 8 nodes. Watch the progress."

*[As each node logs, narrate briefly:]*

**researcher_node starts:**
> "Node 1 is the News Researcher — Sonnet 4.6 making up to 5 rounds of web searches across 12 credible real estate news sources."

**trend_researcher_node starts (parallel):**
> "Simultaneously — Node 2, the Trend Researcher, is aggregating Google Trends India, YouTube Trending, and Reddit India. These two run in parallel. Already saving us time."

**planner_node:**
> "Now the Planner — this is the quality gate. It reads both the news stories and the trends, and it decides: which topics have a genuine housing angle? Coldplay concert? Dropped. RERA ruling? Brief generated."

**social_creative_node:**
> "This is where Claude Opus 4.7 comes in — the most capable model for creative tasks. Before it writes a single word, it reads the Past Performance DB — the top 5 and bottom 5 posts by actual engagement rate from previous runs. The system already knows what landed and what flopped. It writes Hinglish social content using what we call the Zomato Method: the trend is the hero, and housing is the punchline."

**news_creative_node:**
> "Simultaneously: Sonnet 4.6 is writing a 700–1000 word SEO article. Structured, with H2 sections, a pull quote, and internal links to Housing.com property pages."

**platform_agents:**
> "Now the platform agents — five of them running concurrently. Twitter agent enforces the 280-character limit and thread format. Instagram agent writes story slide copy and a 20-second Reel script. YouTube Shorts. LinkedIn. Housing.com News CMS format."

**qa_agent:**
> "3-pass quality gate. First: safety check — binary pass/fail on political content, communal references, price guarantees. Second: quality scoring across 7 dimensions per platform. Third: engagement prediction — predicted impressions, engagement rate, confidence score."

**publisher:**
> "And publish. In dry run mode, everything writes to disk. Flip `DRY_RUN=false` and add your platform API keys — it goes live."

*[Run completes. Summary table visible.]*

> "Done. [X] posts published. And in 6 hours, the Analytics Collector fetches real engagement data from each platform and writes it back into the Past Performance DB. The next run's Planner reads that DB. Every run makes the system smarter — without any human retraining."

> "Let's look at what it made."

---

## Scene 3 — Output Walkthrough (2:15–3:30)

### 3a — Twitter Thread (2:15–2:45)

**[Switch to browser → open twitter_post.md output file]**

**Narration:**
> "Here's the Twitter output. Look at the main tweet — this is the hook: '8,212 projects just received RERA notices in Maharashtra alone. Is your dream home on the list?' Then the thread unfolds: what happened, consequences for buyers, a 3-step RERA verification checklist, and a CTA with an internal Housing.com link."

*[Scroll to the JSON extra section showing `char_count: 238`]*

> "238 characters. Under the 280 limit. The system enforces this hard — if it goes over, the QA system catches it and revises."

### 3b — Instagram Card + Stories (2:45–3:10)

**[Open instagram_image.png — the branded card]**

**Narration:**
> "This is the branded card. Purple background, white text, Housing.com logo. Generated with PIL — no DALL-E API cost. Zero dollars."

*[Open instagram_post.md, scroll to story slides and reel_concept]*

> "Five story slides — auto-written as a carousel. Hook slide, the numbers, what it means for buyers, how to check in 3 steps, and a CTA. Each slide has its own gradient, copy, and hashtag set. And here — a complete 28-second Reel script with shot-by-shot direction: hook at 0–4 seconds, presenter on camera at 5–22 seconds, Housing.com app CTA at 23–28. The social team just needs to shoot it."

### 3c — SEO Article (3:10–3:30)

**[Open housing_news_post.md, scroll through the article_body]*

**Narration:**
> "The news article. 800 words. 4 H2 sections: what happened, what's at risk for buyers, the 5-step verification checklist, why this matters. Pull quote independently shareable. Primary keyword: 'how to check RERA registration' — embedded naturally in H1, opening paragraph, and two H2 sections."

*[Scroll to internal links section]*

> "Three internal links to Housing.com property pages — Mumbai SRP, Pune SRP, Hyderabad SRP — placed contextually. Not shoehorned. These links flow from the article content."

---

## Scene 4 — The Dashboard (3:30–4:00)

**[Switch to http://localhost:8000 dashboard]**

**Narration:**
> "The dashboard gives the content and marketing teams full visibility. Every run is logged — QA decisions, predicted engagement, platform breakdown."

*[Click on a run, show the QA summary table]*

> "QA scores per post, per platform. Safety pass/fail. Predicted engagement rate. When actual engagement data comes in — the system fetches it at 6 hours, 24 hours, and 7 days — prediction accuracy is calculated. The model learns what actually worked."

*[Show the posts list if available]*

> "And the Slack bot — any team member can DM our bot a topic or a URL, and the system generates targeted content around it in 2 minutes. Marketing doesn't need to open a terminal."

---

## Scene 5 — The Business Case (4:00–4:30)

**[Switch to terminal, or to a simple text slide if pre-prepared]**

**Narration:**
> "Here's the business case in 30 seconds."

> "Traditional content team for a platform like Housing.com: ₹8–10 lakh per month. Output: 60–80 posts across 2–3 platforms."

> "This system: ₹14,000 per month all-in. Output: 300 posts across 5 platforms. Cost per post: ₹47 versus ₹12,000–16,000."

> "Annual savings: over ₹1 crore. Payback period: less than 2 months."

> "And by month 6, with SEO articles indexing and social accounts compounding, we're projecting 1.2 to 1.5 million monthly impressions from content that cost less than a single sponsored LinkedIn post."

---

## Scene 6 — Close (4:30–5:00)

**[Terminal showing the output directory]*

```bash
ls output/
# show 50+ run directories
```

**Narration:**
> "This isn't a prototype. These are 50+ runs that have already been completed. The system is production-ready today. `DRY_RUN=false` plus platform API keys — it's live in 30 minutes."

> "Three asks: one, deploy to production and start the feedback flywheel. Two, run a 30-day pilot alongside the human team and measure the engagement delta. Three, scale — multi-city, multiple languages, and Housing.com becomes the number-one content brand in Indian PropTech."

> "The AI Content Engine. Trend to publish in 2 minutes. Thank you."

---

## Optional Bonus Demo: Slack Bot Trigger (30s add-on)

**[If time allows, show Slack integration]**

```
# In Slack, DM the bot:
"content: RBI cuts repo rate by 25bps"

# Show bot responding in thread 2 minutes later with:
# - Twitter post preview
# - Instagram caption
# - Housing.com News headline
# - Cost: $0.52
```

**Narration:**
> "And if the marketing team doesn't want to touch the terminal — they just message the Slack bot. A topic, a URL, or a free-text brief. Two minutes later, a full content package in their Slack thread."

---

## Post-Production Notes

### Screen recording tips
- Use **1920×1080** minimum
- **Zoom in** on terminal text during the live run (CMD+= in terminal)
- **Slow scroll** through output files — give viewers time to read
- **Pause 1–2 seconds** after each major stat for emphasis
- Add **text overlays** in post: key numbers, node names as they appear

### Suggested overlays (add in iMovie / CapCut / Adobe Premiere)
- Scene 1: "₹0.43 / run" in bottom-right corner
- Scene 2, planner node: "Quality gate: off-topic content filtered"
- Scene 2, social_creative: "Claude Opus 4.7 — reads Past Perf DB before writing"
- Scene 2, publisher: "Analytics Collector → 6h/24h/7d → Past Perf DB"
- Scene 2, qa_agent: "3-pass QA — Safety → Quality → Engagement"
- Scene 3, twitter: "238 / 280 chars — under limit ✓"
- Scene 3, IG card: "$0 image generation — PIL, no DALL-E"
- Scene 3, IG stories: "5-slide carousel — hook → numbers → meaning → how-to → CTA"
- Scene 3, article: "Primary keyword embedded in H1 + 2× H2 ✓"
- Scene 5: Large text "₹8L/mo → ₹14K/mo" then "97% cost reduction"

### B-roll suggestions
- Housing.com homepage / app (2s)
- Indian real estate news headlines scrolling (2s)
- Python pipeline execution scrolling (captured during live run)
- Dashboard with QA scores (captured from browser)
- Slack notification arriving in thread (2s)
- The Instagram branded card full-screen (2s)

### Music
- Upbeat, minimal, tech-forward — no lyrics
- Build to a peak during the cost comparison stat (Scene 5)
- Fade out on the final close

---

## Claude Chrome Extension / Browser Integration Note

For an even more impressive demo, if using **Claude's computer use** or **browser automation**:

1. Open Claude at claude.ai/code
2. Share screen showing the live terminal
3. Ask Claude live: "What did this pipeline just publish for the RERA trend?"
4. Claude reads the output files and summarizes in real time
5. Then: "Show me the engagement prediction for the Instagram post"
6. Claude pulls the QA score from summary.json and explains the prediction

This turns the demo into a **live AI-assisted walkthrough** rather than a scripted recording — which is far more impressive for a technical audience. The system explaining itself is the point.

Alternatively: run `python main.py serve` → open the FastAPI `/docs` page → show the live Swagger UI → trigger `POST /run` from the browser. Shows the REST API surface without terminal commands.

---

## Timing Guide

| Scene | Duration | Key Moment |
|-------|----------|-----------|
| 1 — Hook | 0:30 | "43 cents" — pause here |
| 2 — Live run | 1:45 | Each node narrated live |
| 3a — Twitter | 0:30 | Show char count: 238/280 |
| 3b — Instagram | 0:25 | Show branded card → reel script |
| 3c — Housing News | 0:20 | Show internal links placement |
| 4 — Dashboard | 0:30 | QA scores + feedback loop |
| 5 — Business case | 0:30 | "97% cost reduction" — slow down |
| 6 — Close | 0:30 | Show 50+ output directories |
| **Total** | **~4:45** | |

---

*Script written for Housing.com Hackathon 2026. Application: `/Users/sachinagrawal/ai-agents/real-estate-marketeer/`. Run: `python main.py run`*
