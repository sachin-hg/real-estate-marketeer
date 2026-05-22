from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

import anthropic

from config import get_settings
from models.state import PlatformPost, QAResult, WorkflowState

logger = logging.getLogger(__name__)


# ─── Pass 1: Safety (platform-agnostic, binary) ───────────────────────────────

SAFETY_SYSTEM = """You are a brand safety and legal compliance reviewer for Housing.com India.

HARD BLOCK — any one of these = {"passed": false}:
- Content that attacks, demeans, or incites hostility toward a religion, caste, or community
  IMPORTANT: Government of India schemes (Beti Bachao Beti Padhao, PMAY, PM Awas Yojana,
  Smart City Mission, Swachh Bharat, etc.) are official programs — NOT religious or communal content.
  Mentioning them positively is fine.
- Political PARTY names (BJP, Congress, AAP, etc.) or election campaigning content
  NOTE: Government policies and schemes are not party content — they belong to all of India.
- Defamation: specific false claims about named builders, companies, or individuals
- SPECIFIC forward-looking price guarantees with numbers: "prices WILL rise 40% by 2027",
  "guaranteed 15% annual returns" — these are violations.
  NOT violations: vague historical-cycle language like "ghar ka value badhta hai",
  "property appreciates over time", "8 saal mein value badi" — this is widely understood
  general RE wisdom, not a contractual guarantee.
- Content that DENIES or RESTRICTS housing access based on religion, caste, or gender
  (Housing Protection Act). This means: "we don't sell to [group]" style discrimination.
  CRITICAL DISTINCTION — these are NOT violations:
  • Content CELEBRATING women as property owners / homebuyers
  • Content promoting women's names on property registries
  • Content about improving gender ratio leading to more female homebuyers
  • Hashtags like #BetiBachao (a Govt scheme) or #WomenHomebuyers
  • Any content that PROMOTES inclusion and equal participation in real estate
  Promoting women's property rights is the OPPOSITE of discrimination. Only block content
  that discriminates AGAINST a group, never content that celebrates their inclusion.
- Content that could be construed as insider information about listed companies
- Explicit, violent, or sexually suggestive content

Respond ONLY with valid JSON:
{"passed": true|false, "violations": [], "violation_categories": []}"""


# ─── Pass 2: Quality — per-platform scoring with structured critique ──────────

_PLATFORM_QUALITY = {

"twitter": """You are a content quality reviewer for Housing.com India's Twitter/X account.

PURPOSE: Twitter is a trend-jacking machine. Housing.com rides what India is already talking about
(IPL, AI anxiety, a meme, a Bollywood moment) and drops a 1-2 liner so sharp it earns a quote-tweet
without asking. The TREND is the hero. Housing is the punchline — it emerges from the hook, never
replaces it. This is emotion-first, NOT data-first. Wit, wordplay, Hinglish, GenZ resonance.
No obligation to be data-enriched. No false claims ever.

CHARACTER_COMPLIANCE: Is the main tweet ≤280 characters? (10=yes, 0=no — hard constraint)

Score each dimension 0.0–10.0:

TREND_DOMINANCE (35%): Is the cultural/trend hook the DOMINANT element of the post?
  Ask: if you removed the housing.com link, would this still feel like a tweet about the trend?
  9-10=trend is the whole post, housing emerges naturally as the punchline or cherry-on-top;
  6-8=trend present but housing angle competes for attention;
  3-5=trend is a thin wrapper around a housing message;
  0-2=no real trend hook — this is just a housing promo
  CRITICAL: A post that swaps the original trend for real estate data to "improve RE connection"
  scores 0 here. The trend hook must stay dominant and untouched.

SHAREABILITY (30%): Would a GenZ Indian RT, quote-tweet, or screenshot this?
  Test: would someone share this even if they're not looking for a home?
  9-10=so quotable it spreads on its own; witty wordplay, relatable emotion, or surprising twist;
  6-8=shareable but slightly predictable; 3-5=fine but forgettable; 0-2=nobody would share this

HINGLISH_WIT (25%): Natural Hinglish voice? Max 2 emojis? Wordplay or punchline present?
  Zero corporate speak. No "Exciting opportunity to explore real estate."
  9-10=reads like a tweet from a witty Indian friend; 6-8=mostly there; 3-5=slightly stiff; 0-2=corporate

CTA_QUALITY (10%): housing.com link or city SRP present? Low-friction — not a hard sell.
  Note: CTA weight is intentionally low. Virality > conversion for Twitter.

Return ONLY valid JSON:
{
  "character_compliance": 0.0,
  "trend_dominance": 0.0,
  "shareability": 0.0,
  "hinglish_wit": 0.0,
  "cta_quality": 0.0,
  "overall_quality_score": 0.0,
  "failing_dimensions": ["dimension_name"],
  "critique": "One paragraph: what specifically is weak and why — be concrete, quote the problem phrase",
  "revision_instructions": ["Specific instruction 1", "Specific instruction 2"]
}""",

"instagram": """You are a content quality reviewer for Housing.com India's Instagram account.

PURPOSE: Instagram shares the same creative agenda as Twitter — trend-jacking with wit, wordplay,
and GenZ resonance. The difference is the medium: a visual card stops the scroll, the caption closes.
Posts should make people SAVE or DM-forward, not just like. The card hook concept must be strong on
its own. Caption is the kicker (≤150 chars). Housing angle emerges from the cultural hook — not bolted on.
Emotion-first, aspiration or humour, Hinglish. No data dumps.

Score each dimension 0.0–10.0:

CARD_HOOK_STRENGTH (30%): Is the visual card concept strong enough to stop the scroll?
  Evaluate the overlay text / card headline, not just whether a card exists.
  9-10=card idea is scroll-stopping on its own — witty, visual, surprising;
  6-8=solid concept but slightly generic; 3-5=card concept is weak or forgettable; 0-2=no clear hook

TREND_AND_SHAREABILITY (30%): Is a cultural/trending hook dominant? Would someone save or DM this?
  Test: would someone who isn't house-hunting still engage with this?
  9-10=pure GenZ save-bait — relatable, funny, or aspirational; trend drives the whole post;
  6-8=good but slightly predictable; 3-5=fine but forgettable; 0-2=generic RE promo

CAPTION_PUNCH (25%): Caption ≤150 chars? Hinglish? Emotionally resonant kicker with CTA or link?
  Card and caption must feel designed as a unit — not two separate ideas.
  9-10=caption perfectly closes what the card opened; 6-8=good but slightly disconnected or long;
  3-5=too long, too corporate, or repeats the card; 0-2=unusable

HASHTAG_STRATEGY (15%): Trend hashtag first? 15-20 total tags? Branded tags (#HousingDotCom, #GharKhojna)?

Return ONLY valid JSON:
{
  "card_hook_strength": 0.0,
  "trend_and_shareability": 0.0,
  "caption_punch": 0.0,
  "hashtag_strategy": 0.0,
  "overall_quality_score": 0.0,
  "failing_dimensions": ["dimension_name"],
  "critique": "One paragraph: what specifically is weak — quote the problem phrase",
  "revision_instructions": ["Specific instruction 1", "Specific instruction 2"]
}""",

"linkedin": """You are a content quality reviewer for Housing.com India's LinkedIn account.

PURPOSE: Trend-jacking for a professional audience — targeting developers, PMs, designers, marketers,
sales reps, and ops folks. Posts riff on professional anxieties (AI replacing jobs, salary, layoffs,
WFH, Gen Z vs. managers) and pivot to "you should work at Housing.com." RE content is not the goal
but not banned either — the lens is employer brand. Dry wit, data-backed, GenZ-resonant.
housing.com/careers CTA is mandatory. English-forward. Shareability matters even in B2B context.

Score each dimension 0.0–10.0:

TREND_JACKING_PROFESSIONAL (25%): Is a current professional trend the hook?
  9-10=riffs sharply on something professionals are actively discussing right now;
  6-8=trend is present but slightly generic; 3-5=weak or stale hook; 0-2=no trend angle at all

EMPLOYER_BRAND_ANGLE (30%): Does the post connect the trend to Housing.com as a workplace?
  Is the housing.com/careers CTA present and natural?
  9-10=crystal-clear employer angle + careers link, value prop for candidate is obvious;
  6-8=angle present but implicit; 3-5=housing promo leaked in, careers CTA missing; 0-2=no employer angle

TONE_AND_WIT (25%): Dry wit? English-forward? No "thrilled/humbled/excited"? No corporate padding?
  Specific public data points add credibility. Short, confident, quotable.
  9-10=sounds like the wittiest person in the room, not a PR team; 6-8=mostly there;
  3-5=slightly stiff or padded; 0-2=full corporate-speak

LENGTH_COMPLIANCE (10%): Post body 150-400 characters? (10=yes, 0=hard violation)

DATA_CREDIBILITY (10%): If data is cited, is it from a public source with an @handle or name?
  Note: data is helpful but wit > data for LinkedIn. Absence of data is not a failure.

NOTE: DO NOT penalise a post for low RE relevance — employer brand is the goal, not homes.

Return ONLY valid JSON:
{
  "trend_jacking_professional": 0.0,
  "employer_brand_angle": 0.0,
  "tone_and_wit": 0.0,
  "length_compliance": 0.0,
  "data_credibility": 0.0,
  "overall_quality_score": 0.0,
  "failing_dimensions": ["dimension_name"],
  "critique": "One paragraph: what specifically is weak — quote the problem phrase",
  "revision_instructions": ["Specific instruction 1", "Specific instruction 2"]
}""",

"housing_news": """You are a content quality reviewer for Housing.com's editorial news platform.

PURPOSE: SEO-driven editorial authority. Articles must rank on Google for high-intent RE queries
("2BHK price Pune 2025", "RERA complaint builder", "Bengaluru locality guide"). The goal is
monthly organic sessions and time-on-page — not shares. Sourced data, clear structure, ≥2 internal
links. Factual accuracy is the hardest constraint — a single wrong stat is a failure.

Score each dimension 0.0–10.0:

FACTUAL_ACCURACY (30%): Do ALL specific claims (prices, percentages, dates, builder names) match
  the source articles provided? One unsourced or contradicted claim = score ≤3.
  9-10=every claim is traceable to source; 6-8=minor omissions; 0-5=any incorrect or unverifiable stat

HEADLINE_QUALITY (20%): Curiosity-gap hook, ≤70 chars, keyword-natural (not stuffed)?
  Would a buyer researching RE click it?
  9-10=irresistible and keyword-smart; 6-8=good angle, slightly generic; 3-5=serviceable;
  0-2=boring / keyword dump / too long

SEO_QUALITY (20%): Are high-intent keywords in the headline and H2s? Are locality/city names used
  as natural anchors (not forced)? Is there a meta description concept (first 160 chars of article)?
  9-10=reads like it was written for both humans and Google; 6-8=mostly there; 3-5=SEO ignored;
  0-2=no discernible keyword strategy

ARTICLE_STRUCTURE (15%): Engaging opener that hooks the reader in ≤2 sentences? H2 sections?
  Pull quote or data callout that stands alone?

INTERNAL_LINKS (15%): ≥2 housing.com SRP/locality/calculator links placed contextually — not forced?
  9-10=2+ links feel editorial; 5-8=present but weak placement; 0-4=missing or awkwardly inserted

Return ONLY valid JSON:
{
  "factual_accuracy": 0.0,
  "headline_quality": 0.0,
  "seo_quality": 0.0,
  "article_structure": 0.0,
  "internal_links": 0.0,
  "overall_quality_score": 0.0,
  "failing_dimensions": ["dimension_name"],
  "critique": "One paragraph: what specifically is weak — quote the problem phrase",
  "revision_instructions": ["Specific instruction 1", "Specific instruction 2"]
}""",

"youtube": """You are a content quality reviewer for Housing.com's YouTube Shorts and long-form channel.

PURPOSE: Witty trend-jacking meets data-driven education. If the trend is strong, ride it — no
obligation to pack in data. If the trend is thin, lean on the explainer. Either way: the first
sentence must earn the next 59 seconds. Format is scripted but must SOUND unscripted — natural
speech, not read-aloud prose. No false claims, ever. CTR and watch time are the metrics.

Score each dimension 0.0–10.0:

HOOK_THREE_SECONDS (30%): Does the first line compel someone to keep watching?
  9-10=creates instant curiosity or surprise — viewer has no choice but to continue;
  6-8=decent but slightly predictable; 3-5=slow start; 0-2=opens with a title card or "Hello everyone"

TREND_OR_EDUCATION_STRENGTH (25%): Is there either (a) a strong trend hook that drives the whole
  video, OR (b) a clear educational value that a buyer/investor can't find in 30 seconds elsewhere?
  At least one must score ≥7. Both together = 10.
  0-4=neither a fresh trend nor useful education — just filler

SCRIPT_NATURALNESS (25%): Does it flow like speech? Contractions, pauses, natural rhythm?
  Would it sound good read aloud without edits?
  9-10=indistinguishable from a great podcast host; 6-8=mostly natural; 3-5=stiff/written;
  0-2=would sound robotic if read aloud

DATA_ACCURACY (10%): Are all cited stats and claims accurate? Absence of data is fine.
  One wrong stat = score ≤2.

CTA_AND_SEO (10%): Clear CTA (visit housing.com / city link / subscribe)? Title ≤60 chars?
  Description keywords present? Chapter timestamps if long-form?

Return ONLY valid JSON:
{
  "hook_three_seconds": 0.0,
  "trend_or_education_strength": 0.0,
  "script_naturalness": 0.0,
  "data_accuracy": 0.0,
  "cta_and_seo": 0.0,
  "overall_quality_score": 0.0,
  "failing_dimensions": ["dimension_name"],
  "critique": "One paragraph: what specifically is weak — quote the problem phrase",
  "revision_instructions": ["Specific instruction 1", "Specific instruction 2"]
}""",
}

_DEFAULT_QUALITY_SYSTEM = """You are a content quality reviewer for Housing.com India.
Score overall quality 0.0–10.0. Return JSON:
{
  "overall_quality_score": 0.0,
  "failing_dimensions": [],
  "critique": "...",
  "revision_instructions": []
}"""


# ─── Pass 3: Engagement — platform benchmarks injected at runtime ─────────────

_PLATFORM_BENCHMARKS = {
    "twitter":      {"avg_er": "0.8%", "good_er": "2-4%",   "viral_er": "8%+",  "metric": "engagement rate"},
    "instagram":    {"avg_er": "3%",   "good_er": "6-8%",   "viral_er": "12%+", "metric": "engagement rate"},
    "youtube":      {"avg_er": "4%",   "good_er": "8-12%",  "viral_er": "15%+", "metric": "CTR (Shorts)"},
    "housing_news": {"avg_er": "1,000 sessions/article", "good_er": "3,000+", "viral_er": "5,000+/month", "metric": "monthly sessions"},
    "linkedin":     {"avg_er": "0.5%", "good_er": "2-3%",   "viral_er": "5%+",  "metric": "engagement rate"},
}

_ENGAGEMENT_SYSTEM_TEMPLATE = """You are a social media analyst specialising in Indian real estate content.

Platform: {platform}
Benchmarks for Housing.com (~200K followers):
  Average {metric}: {avg_er} | Good: {good_er} | Viral: {viral_er}

Scoring drivers (weight in prediction):
1. HOOK (40%): Does the opening stop the scroll / earn the click?
2. RELEVANCE (25%): Right topic at right time — is the trend still fresh?
3. EMOTION (20%): Curiosity, aspiration, FOMO, or humour?
4. CTA (15%): Clear, low-friction call to action?

Return ONLY valid JSON:
{{
  "predicted_impressions": 0,
  "predicted_likes": 0,
  "predicted_shares": 0,
  "predicted_comments": 0,
  "predicted_ctr": 0.0,
  "predicted_saves": 0,
  "pred_engagement_rate": 0.0,
  "pred_confidence": 0.0,
  "engagement_reasoning": "...",
  "top_element": "...",
  "weak_element": "..."
}}"""


# ─── Per-platform decision thresholds ─────────────────────────────────────────

_PLATFORM_THRESHOLDS = {
    "twitter":      {"min_quality": 6.5, "min_er": 0.005, "hard_dims": ["character_compliance", "trend_dominance"]},
    "instagram":    {"min_quality": 6.0, "min_er": 0.020, "hard_dims": []},
    "linkedin":     {"min_quality": 6.5, "min_er": 0.000, "hard_dims": ["length_compliance", "employer_brand_angle"]},
    "housing_news": {"min_quality": 7.0, "min_er": 0.000, "hard_dims": ["factual_accuracy"]},
    "youtube":      {"min_quality": 6.0, "min_er": 0.000, "hard_dims": []},
}


# ─── Per-platform revision system prompts ─────────────────────────────────────

_PLATFORM_REVISION = {

"twitter": """You are Housing.com India's Twitter/X editor. Surgical editing only.

LOCKED — do not change these under any circumstances:
- The central trend/cultural hook (the meme, the AI angle, the IPL moment, the relatable situation)
- The Hinglish voice and wit
- The human emotion being tapped (fear, FOMO, aspiration, humour)
- The topic itself — the trend IS the post

What you may fix:
- CHARACTER_COMPLIANCE: trim to ≤280 chars — tighten without losing the punchline
- SHAREABILITY: sharpen the wordplay or punchline so it earns a quote-tweet
- HINGLISH_WIT: remove any corporate-sounding phrases; strengthen the wit
- CTA_QUALITY: add or fix the housing.com link at the end — never at the expense of the hook
- TREND_DOMINANCE failure: if the housing angle feels bolted on, make it emerge MORE naturally
  from the SAME trend — do NOT introduce data, stats, or a new topic to fix this

If a post has no fixable trend hook (it was already swapped to RE data), score it reject — do not try to salvage.
Hard rule: main_tweet MUST be ≤280 characters.
Return ONLY valid JSON:
{"content": "revised tweet text", "hashtags": ["#tag1"], "revision_summary": "one sentence"}""",

"instagram": """You are Housing.com India's Instagram content editor. Surgical editing only.

LOCKED — do not change these under any circumstances:
- The central trend/cultural hook and the emotion it taps
- The Hinglish voice and punchy tone
- The card concept (what the visual communicates)

What you may fix:
- CAPTION_PUNCH: trim to ≤150 chars; sharpen the closing kicker; ensure card and caption feel like a unit
- TREND_AND_SHAREABILITY: deepen the housing pivot on the SAME trend — never swap trend for RE data
- CARD_HOOK_STRENGTH: if the card concept is weak, propose a stronger visual idea for the same trend
- HASHTAG_STRATEGY: trend hashtag first, 15-20 total, branded tags present

Do NOT replace the original cultural topic with real estate statistics — that is housing_news content.
Return ONLY valid JSON:
{"content": "revised caption ≤150 chars", "hashtags": ["#OriginalTrendTag", "..."], "revision_summary": "one sentence"}""",

"linkedin": """You are Housing.com India's LinkedIn employer brand editor. Surgical editing only.

Goal: trend-jacking for professionals — make people want to work at Housing.com.
LOCKED: the professional trend hook being riffed on.

What you may fix:
- EMPLOYER_BRAND_ANGLE: ensure housing.com/careers CTA is present and the "work here" message is clear
- TONE_AND_WIT: remove corporate padding ("thrilled/excited/honoured"), sharpen to dry confident wit
- LENGTH_COMPLIANCE: trim or expand to 150-400 characters
- DATA_CREDIBILITY: add @handle source tag if a stat is cited without attribution

Do NOT push RE content if it wasn't already there. Do NOT make it more formal.
Post body MUST be 150-400 characters.
Return ONLY valid JSON:
{"content": "revised post body", "hashtags": ["#tag1"], "revision_summary": "one sentence"}""",

"housing_news": """You are Housing.com India's editorial content editor. Surgical editing only.

LOCKED: all factual claims — never introduce or change a stat.

What you may fix:
- HEADLINE_QUALITY: rewrite headline as curiosity-gap hook ≤70 chars — keep the keyword
- SEO_QUALITY: add locality/city names as natural anchors; ensure first 160 chars work as meta description
- ARTICLE_STRUCTURE: strengthen the opener; add or rename H2 sections; surface a pull quote
- INTERNAL_LINKS: embed ≥2 housing.com SRP/locality/calculator links contextually
- FACTUAL_ACCURACY: if a claim doesn't match the source, remove or soften it — never invent a replacement stat

Return ONLY valid JSON:
{"content": "revised full article text", "hashtags": ["#tag1"], "revision_summary": "one sentence"}""",

"youtube": """You are Housing.com India's YouTube content editor. Surgical editing only.

LOCKED: the trend hook or educational angle — do not replace it.

What you may fix:
- HOOK_THREE_SECONDS: rewrite only the first sentence to create instant curiosity — keep the rest
- TREND_OR_EDUCATION_STRENGTH: if trend hook is weak, sharpen it; if education value is low, add one concrete insight
- SCRIPT_NATURALNESS: break up long written sentences; add contractions and natural pauses
- DATA_ACCURACY: remove or soften any claim that can't be verified — never invent a replacement stat
- CTA_AND_SEO: add CTA at the end; fix title if >60 chars

Return ONLY valid JSON:
{"content": "revised script", "hashtags": ["#tag1"], "revision_summary": "one sentence"}""",
}

_DEFAULT_REVISION_SYSTEM = """You are a content editor for Housing.com India.
Apply the critique exactly. Preserve the platform tone and core message.
Return ONLY valid JSON:
{"content": "revised content", "hashtags": ["#tag1"], "revision_summary": "one sentence"}"""


# ─── Main node (async — posts evaluated in parallel) ─────────────────────────

async def qa_node(state: WorkflowState) -> dict:
    """
    LangGraph node: per-platform QA on all posts, with one critique-driven retry.
    All posts are evaluated concurrently; per-post quality+engagement passes run in parallel.
    """
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    source_summary = _summarise_sources(state.get("research", []))

    posts = state.get("platform_posts", [])
    if not posts:
        logger.warning("QA: no platform_posts to evaluate")
        return {
            "qa_results": [],
            "approved_posts": [],
            "qa_post_attempts": state.get("qa_post_attempts") or {},
            "retry_count": state.get("retry_count", 0) + 1,
        }

    post_attempts: dict[str, int] = dict(state.get("qa_post_attempts") or {})
    qa_results: list[QAResult] = []
    approved: list[PlatformPost] = []

    if settings.human_in_the_loop:
        # Advisory mode: score every post once; only hard safety blocks stop a post.
        # Quality scores are opinions for the human reviewer — not pass/fail gates.
        logger.info("QA (advisory/HITL mode): scoring %d posts — no auto-rejection on quality", len(posts))
        eval_tasks = [
            _evaluate_post(post, source_summary, client, settings, 1)
            for post in posts
        ]
        eval_results = await asyncio.gather(*eval_tasks, return_exceptions=True)

        for post, result in zip(posts, eval_results):
            if isinstance(result, Exception):
                logger.error("QA advisory error for post %s [%s]: %s",
                             post["id"][:8], post["platform"], result, exc_info=result)
                continue
            # Hard safety block still applies — everything else is advisory
            if result.get("safety_passed", True):
                result = {**result, "decision": "advisory"}
                approved.append({**post, "status": "approved"})
                logger.info("QA ADVISORY post %s [%s] score=%.1f — queued for human review",
                            post["id"][:8], post["platform"], result.get("overall_quality_score", 0))
            else:
                result = {**result, "decision": "reject"}
                logger.info("QA SAFETY BLOCK post %s [%s] violations=%s",
                            post["id"][:8], post["platform"], result.get("safety_violations", []))
            qa_results.append(result)
            post_attempts[post["id"]] = 1

    else:
        # Auto-publish mode: full lifecycle with retry/revise
        tasks = [
            _qa_lifecycle(post, source_summary, client, settings, post_attempts)
            for post in posts
        ]
        per_post = await asyncio.gather(*tasks, return_exceptions=True)

        for post, result in zip(posts, per_post):
            if isinstance(result, Exception):
                logger.error("QA lifecycle error for post %s [%s]: %s",
                             post["id"][:8], post["platform"], result, exc_info=result)
                continue
            post_qa_results, approved_post, final_attempt = result
            qa_results.extend(post_qa_results)
            if approved_post:
                approved.append(approved_post)
            post_attempts[post["id"]] = final_attempt

    logger.info("QA: %d/%d posts %s", len(approved), len(posts),
                "queued for review" if settings.human_in_the_loop else "approved")
    return {
        "qa_results": qa_results,
        "approved_posts": approved,
        "qa_post_attempts": post_attempts,
        "retry_count": state.get("retry_count", 0) + 1,
    }


# ─── Per-post lifecycle ───────────────────────────────────────────────────────

async def _qa_lifecycle(
    post: PlatformPost,
    sources: str,
    client,
    settings,
    post_attempts: dict[str, int],
) -> tuple[list[QAResult], Optional[PlatformPost], int]:
    """Full QA lifecycle for a single post: evaluate → [revise → re-evaluate]."""
    post_id = post["id"]
    attempt = post_attempts.get(post_id, 0) + 1

    result = await _evaluate_post(post, sources, client, settings, attempt)

    if result["decision"] == "publish":
        logger.info("QA APPROVED post %s [%s] attempt=%d score=%.1f",
                    post_id[:8], post["platform"], attempt, result["overall_quality_score"])
        return [result], {**post, "status": "approved"}, attempt

    if result["decision"] == "reject":
        logger.info("QA REJECTED post %s [%s]: safety=%s quality=%.1f",
                    post_id[:8], post["platform"],
                    result["safety_violations"], result["overall_quality_score"])
        return [result], None, attempt

    # "revise" decision
    if attempt > settings.max_qa_retries:
        logger.info("QA circuit-breaker: post %s [%s] hit max retries (%d) — dropping",
                    post_id[:8], post["platform"], settings.max_qa_retries)
        return [result], None, attempt

    logger.info("QA revising post %s [%s] (attempt %d/%d): %s",
                post_id[:8], post["platform"], attempt, settings.max_qa_retries,
                result.get("critique", "")[:120])

    revised = await _revise_with_critique(post, result, client, settings)
    if not revised:
        return [result], None, attempt

    attempt2 = attempt + 1
    re_result = await _evaluate_post(revised, sources, client, settings, attempt2)

    if re_result["decision"] == "publish":
        logger.info("QA post %s [%s] APPROVED after revision (score %.1f → %.1f)",
                    post_id[:8], post["platform"],
                    result["overall_quality_score"], re_result["overall_quality_score"])
        # Original pre-revision version is implicitly rejected — save it for audit trail
        _save_original_as_revised_rejected(post, result)
        approved = {
            **revised,
            "status": "approved",
            "extra": {
                **revised.get("extra", {}),
                "revised_from_content": post["content"][:500],
                "revision_score_before": result["overall_quality_score"],
                "revision_score_after": re_result["overall_quality_score"],
                "revision_critique": result.get("critique", "")[:300],
            },
        }
        return [result, re_result], approved, attempt2

    logger.info("QA post %s [%s] still failing after revision (score=%.1f, %s) — dropping",
                post_id[:8], post["platform"], re_result["overall_quality_score"], re_result["decision"])
    return [result, re_result], None, attempt2


def _save_original_as_revised_rejected(post: PlatformPost, qa_result: dict) -> None:
    """Persist the pre-revision original to DB as qa_rejected so the audit trail is complete."""
    try:
        from tools.run_context import get_run_id
        from db.connection import get_db_session
        from db.models import PublishedPostRecord
        import json as _json
        from datetime import datetime, timezone

        run_id = get_run_id()
        if not run_id:
            return

        critique = qa_result.get("critique") or qa_result.get("revision_notes", "")
        quality_issues = qa_result.get("quality_issues", [])
        rejection_reasons = quality_issues or [critique[:120]] if critique else ["Revised by QA"]

        with get_db_session() as sess:
            existing = sess.query(PublishedPostRecord).filter_by(
                post_id=post["id"] + "_orig"
            ).first()
            if existing:
                return
            sess.add(PublishedPostRecord(
                post_id=post["id"] + "_orig",
                run_id=run_id,
                platform=post.get("platform", ""),
                content=post.get("content", ""),
                hashtags=_json.dumps(post.get("hashtags", [])),
                internal_links=_json.dumps(post.get("internal_links", [])),
                media_urls=_json.dumps(post.get("media_urls", [])),
                creative_angle=post.get("angle", ""),
                trend_hashtag=post.get("extra", {}).get("trend_hashtag") or post.get("trend_hashtag"),
                draft_type=post.get("draft_type"),
                qa_decision="qa_revised",
                post_status="qa_rejected",
                qa_rejection_reasons=_json.dumps(rejection_reasons),
                qa_critique=critique,
                qa_overall=qa_result.get("overall_quality_score"),
                published_at=datetime.now(timezone.utc),
            ))
            sess.commit()
        logger.debug("Saved pre-revision original %s [%s] as qa_rejected", post["id"][:8], post.get("platform"))
    except Exception as exc:
        logger.debug("Failed to save pre-revision original: %s", exc)


# ─── Evaluation (async, quality+engagement run in parallel) ──────────────────

_PLATFORM_KEY_DIMS = {
    "twitter":   "TREND_DOMINANCE, SHAREABILITY, HINGLISH_WIT",
    "instagram": "CARD_HOOK_STRENGTH, TREND_AND_SHAREABILITY, CAPTION_PUNCH",
    "linkedin":  "TREND_JACKING_PROFESSIONAL, TONE_AND_WIT, EMPLOYER_BRAND_ANGLE",
}


def _build_calibration_block(platform: str, examples: str) -> str:
    """
    Build a calibration block to inject into the quality pass user message.

    Goal: anchor the scorer to real approved-and-published examples so scores
    reflect actual Housing.com quality standards, not an abstract ideal.
    The block teaches scoring by comparison, not by description.
    """
    key_dims = _PLATFORM_KEY_DIMS.get(platform, "relevant dimensions")
    return (
        f"\n\n{'=' * 60}\n"
        f"SCORING CALIBRATION — APPROVED PUBLISHED EXAMPLES\n"
        f"{'=' * 60}\n"
        f"The posts below PASSED QA review and were published by Housing.com. "
        f"They are your ground-truth benchmark for {key_dims}.\n\n"
        f"{examples}\n\n"
        f"HOW TO USE THESE EXAMPLES WHEN SCORING:\n\n"
        f"Step 1 — Compare before you score.\n"
        f"  For each dimension, ask: 'Is the post I'm reviewing better, similar, or worse\n"
        f"  than the approved examples on THIS specific dimension?'\n"
        f"  Do not assign a number until you've done this comparison explicitly.\n\n"
        f"Step 2 — Use the approved examples as your 7-8 anchor.\n"
        f"  • 9-10 : Clearly surpasses the approved examples — sharper wit, more unexpected\n"
        f"           hook, tighter wordplay, or stronger housing pivot than anything above\n"
        f"  • 7-8  : Matches the approved examples in craft and execution\n"
        f"  • 5-6  : Weaker than the approved examples but shows the right instincts —\n"
        f"           trend hook exists, Hinglish is present, housing angle is attempted\n"
        f"  • 3-4  : Clearly below the approved examples — hook is generic, voice is stiff,\n"
        f"           or housing angle feels bolted on (matches the 'AVOID THIS' examples)\n"
        f"  • 1-2  : Does not resemble the approved examples at all — corporate-speak,\n"
        f"           no trend, or housing promo in disguise\n\n"
        f"Step 3 — Flag score drift.\n"
        f"  If you are about to give a score of 9+ on any dimension, confirm the post\n"
        f"  CONCRETELY outperforms the approved examples on that dimension before doing so.\n"
        f"  If you are about to give a score of ≤3 on any dimension, confirm the post\n"
        f"  CONCRETELY underperforms the 'AVOID THIS' examples before doing so.\n"
        f"{'=' * 60}"
    )


def _extract_tags_from_post(post: PlatformPost) -> list[str]:
    """Extract trend/content tags from a platform post for example retrieval."""
    extra = post.get("extra", {})
    tags: list[str] = []
    # LinkedIn stores examples_used_tags explicitly
    tags.extend(extra.get("examples_used_tags", []))
    # Instagram/Twitter store trend_hashtag
    trend = extra.get("trend_hashtag", "").lstrip("#").lower()
    if trend:
        tags.append(trend)
    # City hint as city tag
    city = extra.get("city_hint", "")
    if city:
        tags.append(city.lower())
    # Fall back to first 3 hashtags from the post itself
    if not tags:
        tags = [h.lstrip("#").lower() for h in post.get("hashtags", [])[:3]]
    return tags


async def _evaluate_post(
    post: PlatformPost,
    sources: str,
    client,
    settings,
    attempt: int = 1,
) -> QAResult:
    from tools.run_logger import Timer
    from tools.llm_router import call_json_async

    platform = post["platform"]
    post_text = (
        f"PLATFORM: {platform}\n"
        f"CONTENT:\n{post['content']}\n"
        f"HASHTAGS: {' '.join(post.get('hashtags', []))}\n"
        f"EXTRA:\n{json.dumps(post.get('extra', {}), indent=2)}"
    )
    logger.info("QA evaluating post %s [%s] attempt=%d chars=%d",
                post["id"][:8], platform, attempt, len(post["content"]))

    # Pass 1: Safety — binary gate, fast tier, deterministic (temperature=0)
    with Timer() as t1:
        safety = await call_json_async(
            tier="fast", system=SAFETY_SYSTEM, user_msg=post_text,
            max_tokens=512, log_label=f"qa/safety/{platform}/{post['id'][:8]}",
            temperature=0.0,
        )
    logger.info("QA Pass1 Safety [%s] passed=%s violations=%s | %.0fms",
                platform, safety.get("passed", "?"), safety.get("violations", []), t1.elapsed_ms)

    # Detect silent API failure — empty dict means call returned nothing (rate limit / auth)
    if "passed" not in safety:
        raise RuntimeError(
            f"QA safety pass returned empty result for post {post['id'][:8]} [{platform}] "
            f"— likely API failure. Post not evaluated."
        )

    if not safety.get("passed", True):
        return _build_result(post, safety, {}, {}, "reject", attempt)

    # Pass 2: Quality (balanced — semantic scoring) +
    # Pass 3: Engagement (fast — heuristic estimation) — run in parallel

    # Inject approved examples as scoring calibration anchors (social platforms only)
    quality_system = _PLATFORM_QUALITY.get(platform, _DEFAULT_QUALITY_SYSTEM)
    quality_ctx = f"{post_text}\n\nSOURCE ARTICLES:\n{sources}"
    if platform in ("twitter", "instagram", "linkedin"):
        from tools.example_retriever import get_relevant_examples
        tags = _extract_tags_from_post(post)
        examples = get_relevant_examples(tags, top_n=4)
        if examples:
            quality_ctx += _build_calibration_block(platform, examples)

    benchmarks = _PLATFORM_BENCHMARKS.get(platform, _PLATFORM_BENCHMARKS["twitter"])
    engagement_system = _ENGAGEMENT_SYSTEM_TEMPLATE.format(platform=platform, **benchmarks)

    with Timer() as t23:
        quality, engagement = await asyncio.gather(
            call_json_async(tier="balanced", system=quality_system, user_msg=quality_ctx,
                            max_tokens=1200, log_label=f"qa/quality/{platform}/{post['id'][:8]}",
                            temperature=0.0),
            call_json_async(tier="fast", system=engagement_system, user_msg=post_text,
                            max_tokens=768, log_label=f"qa/engagement/{platform}/{post['id'][:8]}",
                            temperature=0.0),
        )
    logger.info("QA Pass2+3 [%s] quality=%.1f failing=%s pred_er=%.1f%% | %.0fms",
                platform, quality.get("overall_quality_score", 0),
                quality.get("failing_dimensions", []),
                engagement.get("pred_engagement_rate", 0) * 100, t23.elapsed_ms)
    # Per-dimension score breakdown
    dim_scores = {k: v for k, v in quality.items()
                  if isinstance(v, (int, float)) and k not in ("overall_quality_score",)}
    if dim_scores:
        logger.info("QA Dimensions [%s]: %s",
                    platform,
                    " | ".join(f"{k}={v:.1f}" for k, v in sorted(dim_scores.items())))
    logger.info("QA Engagement [%s]: impressions=%s likes=%s shares=%s comments=%s confidence=%.0f%% | %s",
                platform,
                engagement.get("pred_impressions", "?"),
                engagement.get("pred_likes", "?"),
                engagement.get("pred_shares", "?"),
                engagement.get("pred_comments", "?"),
                engagement.get("pred_confidence", 0) * 100,
                (engagement.get("engagement_reasoning") or "")[:120])

    # Detect silent API failure — both calls returned {} with no score
    if "overall_quality_score" not in quality:
        raise RuntimeError(
            f"QA quality pass returned empty result for post {post['id'][:8]} [{platform}] "
            f"— likely API failure (rate limit / auth error). Post not evaluated."
        )

    # Programmatic hard-check: Twitter character limit (cheaper than relying on LLM score)
    if platform == "twitter":
        main_tweet = post.get("extra", {}).get("main_tweet") or post["content"].split("\n\n---\n\n")[0]
        if len(main_tweet) > 280:
            quality["character_compliance"] = 0.0
            if "character_compliance" not in quality.get("failing_dimensions", []):
                quality.setdefault("failing_dimensions", []).append("character_compliance")

    decision = _decide(quality, engagement, platform)
    logger.info("QA DECISION [%s] post %s → %s", platform, post["id"][:8], decision.upper())
    return _build_result(post, safety, quality, engagement, decision, attempt)


# ─── Decision logic ───────────────────────────────────────────────────────────

def _decide(quality: dict, engagement: dict, platform: str) -> str:
    thresholds = _PLATFORM_THRESHOLDS.get(platform, {"min_quality": 6.5, "min_er": 0.0, "hard_dims": []})
    issues = []

    for dim in thresholds.get("hard_dims", []):
        if quality.get(dim, 10) < 5:
            issues.append(f"hard constraint violation: {dim}")

    if quality.get("overall_quality_score", 10) < thresholds["min_quality"]:
        issues.append(f"quality {quality.get('overall_quality_score', 0):.1f} < {thresholds['min_quality']}")

    min_er = thresholds.get("min_er", 0)
    er = engagement.get("pred_engagement_rate", 0.0)
    if min_er > 0 and er > 0 and er < min_er:
        issues.append(f"pred ER {er:.1%} below {platform} threshold {min_er:.1%}")

    if not issues:
        return "publish"
    if quality.get("overall_quality_score", 0) >= 4:
        return "revise"
    return "reject"


# ─── Result builder ───────────────────────────────────────────────────────────

def _build_result(
    post: PlatformPost,
    safety: dict,
    quality: dict,
    engagement: dict,
    decision: str,
    attempt: int = 1,
) -> QAResult:
    notes_parts = list(quality.get("quality_issues", quality.get("failing_dimensions", [])))
    if quality.get("issues"):
        notes_parts.extend(quality["issues"])
    if engagement.get("weak_element"):
        notes_parts.append(f"Improve: {engagement['weak_element']}")
    notes = " | ".join(notes_parts)

    critique = quality.get("critique", "")
    revision_instructions = quality.get("revision_instructions", [])

    if decision == "revise" and not critique:
        failing = quality.get("failing_dimensions", [])
        critique = (
            f"Post needs improvement on: {', '.join(failing) or 'overall quality'}. "
            f"{engagement.get('weak_element', '')}".strip()
        )
        if not revision_instructions and failing:
            revision_instructions = [f"Improve {dim}" for dim in failing]

    # Capture all numeric dimension scores for artifact reporting
    _non_score_keys = {"overall_quality_score", "failing_dimensions", "critique",
                       "revision_instructions", "quality_issues", "issues"}
    quality_scores = {
        k: v for k, v in quality.items()
        if k not in _non_score_keys and isinstance(v, (int, float))
    }

    return {
        "post_id": post["id"],
        "platform": post["platform"],
        "safety_passed": safety.get("passed", True),
        "safety_violations": safety.get("violations", []),
        "re_relevance_score": quality.get("trend_integration",
                              quality.get("employer_brand_angle",
                              quality.get("re_relevance_score", 0))),
        "backlink_score": quality.get("internal_links",
                         quality.get("cta_quality",
                         quality.get("backlink_score", 0))),
        "brand_voice_score": quality.get("hinglish_tone",
                             quality.get("tone_authenticity",
                             quality.get("script_naturalness",
                             quality.get("brand_voice_score", 0)))),
        "factual_score": quality.get("factual_accuracy", quality.get("factual_score", 0)),
        "overall_quality_score": quality.get("overall_quality_score", 0),
        "quality_issues": notes_parts,
        "pred_impressions": engagement.get("predicted_impressions", 0),
        "pred_likes": engagement.get("predicted_likes", 0),
        "pred_shares": engagement.get("predicted_shares", 0),
        "pred_comments": engagement.get("predicted_comments", 0),
        "pred_ctr": engagement.get("predicted_ctr", 0),
        "pred_engagement_rate": engagement.get("pred_engagement_rate", 0),
        "pred_confidence": engagement.get("pred_confidence", 0),
        "engagement_reasoning": engagement.get("engagement_reasoning", ""),
        "top_element": engagement.get("top_element", ""),
        "weak_element": engagement.get("weak_element", ""),
        "decision": decision,
        "revision_notes": notes,
        "critique": critique,
        "revision_instructions": revision_instructions,
        "qa_attempt": attempt,
        "quality_scores": quality_scores,
    }


# ─── Critique-driven revision ─────────────────────────────────────────────────

async def _revise_with_critique(
    post: PlatformPost,
    qa_result: QAResult,
    client,
    settings,
) -> Optional[PlatformPost]:
    """Re-generate the post using QA critique as targeted instructions."""
    from tools.json_utils import extract_json
    from tools.run_logger import log_llm_call, Timer
    from tools.llm_router import acall_message

    platform = post["platform"]
    revision_system = _PLATFORM_REVISION.get(platform, _DEFAULT_REVISION_SYSTEM)

    instructions = qa_result.get("revision_instructions") or []
    critique = qa_result.get("critique") or qa_result.get("revision_notes", "")

    instructions_text = "\n".join(
        f"{i + 1}. {instr}" for i, instr in enumerate(instructions)
    ) or "(no specific instructions — improve overall quality)"

    prompt = f"""Platform: {platform}
Attempt: {qa_result.get('qa_attempt', 1)} → revising

CRITIQUE:
{critique}

SPECIFIC INSTRUCTIONS:
{instructions_text}

ORIGINAL CONTENT:
{post['content']}

HASHTAGS: {' '.join(post.get('hashtags', []))}
INTERNAL LINKS: {json.dumps(post.get('internal_links', []))}

HARD CONSTRAINT: The original cultural/trend hook and topic MUST be preserved.
Fix only what the critique calls out. Do not introduce new topics, data points, or angles
that are not already in the original post. The revision should feel like the same post,
tightened — not a different post."""

    try:
        with Timer() as t:
            resp = await acall_message(
                client=client,
                model=settings.model_balanced,
                system=revision_system,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1500,
            )
        raw = resp.content[0].text
        log_llm_call(
            logger, agent=f"qa/revision/{platform}/{post['id'][:8]}",
            model=settings.model_balanced,
            system_prompt=revision_system,
            user_message=prompt,
            response_text=raw,
            stop_reason=resp.stop_reason,
            elapsed_ms=t.elapsed_ms,
            extra={"input_tokens": resp.usage.input_tokens,
                   "output_tokens": resp.usage.output_tokens},
        )
        data = extract_json(raw)
        if isinstance(data, dict) and data.get("content"):
            logger.info("QA revision [%s] post %s | summary: %s",
                        platform, post["id"][:8], data.get("revision_summary", "")[:80])
            return {
                **post,
                "content": data["content"],
                "hashtags": data.get("hashtags", post.get("hashtags", [])),
                "extra": {
                    **post.get("extra", {}),
                    "revision_summary": data.get("revision_summary", ""),
                    "revised": True,
                },
            }
        logger.warning("QA revision [%s] returned unparseable response", platform)
        return None
    except Exception as exc:
        logger.warning("QA revision failed for post %s [%s]: %s", post["id"][:8], platform, exc)
        return None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _summarise_sources(research: list) -> str:
    return "\n".join(
        f"- {item.get('headline', '')} ({item.get('source', '')}): {item.get('summary', '')}"
        for item in research[:8]
    )
