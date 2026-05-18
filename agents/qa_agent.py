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
- Religious or communal content (Hindu, Muslim, Sikh, Christian, caste references)
- Political party names, political leaders, election content
- Defamation: specific false claims about named builders, companies, or individuals
- FORWARD-LOOKING price guarantees or ROI promises: "prices WILL rise X%", "guaranteed returns"
  — historical data like "prices rose 30% in 2024" is NOT a violation
- Discriminatory content based on religion, caste, gender (Housing Protection Act)
- Content that could be construed as insider information about listed companies
- Explicit, violent, or sexually suggestive content

NOTE: Factual historical price data, engaging CTAs like "aaj hi dekho", and general market
commentary are all fine. Mentioning a builder's project with sourced data is NOT defamation.

Respond ONLY with valid JSON:
{"passed": true|false, "violations": [], "violation_categories": []}"""


# ─── Pass 2: Quality — per-platform scoring with structured critique ──────────

_PLATFORM_QUALITY = {

"twitter": """You are a content quality reviewer for Housing.com India's Twitter/X account.

Score each dimension 0.0–10.0:

CHARACTER_COMPLIANCE: Is the main tweet ≤280 characters? (10=yes, 0=no — hard constraint)
HOOK_PUNCH (30%): Does the opening stop the scroll? Wit, surprise, irony, meme format?
  9-10=unexpected & quotable; 6-8=good but slightly predictable; 3-5=generic; 0-2=flat/corporate
TREND_INTEGRATION (25%): Is the real estate angle NATURAL — not bolted on?
  9-10=feels inevitable; 6-8=clear but slightly forced; 3-5=tenuous; 0-2=no real connection
HINGLISH_TONE (25%): Natural Hinglish/wit? Max 2 emojis? No corporate speak?
CTA_QUALITY (20%): housing.com link or city SRP URL present? Low-friction ask?

CRITICAL for housing.com: RE connection must arise FROM the trend — not "also check housing.com".

Return ONLY valid JSON:
{
  "character_compliance": 0.0,
  "hook_punch": 0.0,
  "trend_integration": 0.0,
  "hinglish_tone": 0.0,
  "cta_quality": 0.0,
  "overall_quality_score": 0.0,
  "failing_dimensions": ["dimension_name"],
  "critique": "One paragraph: what specifically is weak and why — be concrete, quote the problem phrase",
  "revision_instructions": ["Specific instruction 1", "Specific instruction 2"]
}""",

"instagram": """You are a content quality reviewer for Housing.com India's Instagram account.

Score each dimension 0.0–10.0:

CAPTION_QUALITY (30%): Is caption ≤150 chars? Hinglish? Ends with CTA or link?
  9-10=perfect length, punchy, CTA; 6-8=good but slightly long/weak; 3-5=too long or corporate; 0-2=unusable
CARD_CAPTION_ALIGNMENT (25%): Do the card/overlay text and caption complement each other as a unit?
  9-10=card and caption feel designed together; 3-5=disconnected or redundant
HASHTAG_STRATEGY (20%): Trend hashtag first? 15-20 tags? Branded tags (#HousingDotCom, #GharKhojna) present?
HINGLISH_PUNCH (25%): GenZ-relatable, Hinglish, punchy? Rhymes or movie dialogues welcome?

Return ONLY valid JSON:
{
  "caption_quality": 0.0,
  "card_caption_alignment": 0.0,
  "hashtag_strategy": 0.0,
  "hinglish_punch": 0.0,
  "overall_quality_score": 0.0,
  "failing_dimensions": ["dimension_name"],
  "critique": "One paragraph: what specifically is weak — quote the problem phrase",
  "revision_instructions": ["Specific instruction 1", "Specific instruction 2"]
}""",

"linkedin": """You are a content quality reviewer for Housing.com India's LinkedIn employer brand account.

Housing.com's LinkedIn is about WORKING at Housing.com — not buying homes.
Posts riff on trending professional topics (layoffs, AI, work culture, salary) to showcase
Housing.com as a great employer. RE relevance is intentionally LOW — employer brand is the goal.

Score each dimension 0.0–10.0:

EMPLOYER_BRAND_ANGLE (35%): Is the housing.com/careers CTA present? Does the post clearly connect
  the trend to "you should work at Housing.com"? Is the value proposition for the candidate clear?
  9-10=crystal clear employer angle + careers link; 6-8=angle present but implicit; 3-5=weak/missing;
TONE_AUTHENTICITY (30%): English-forward wit? No "thrilled/humbled/excited to share"? Dry humor?
  Specific public data points? Confident, short, no padding?
LENGTH_COMPLIANCE (15%): Is post body 150-400 characters? (10 if yes, 0 if hard violation)
DATA_SOURCING (20%): Public data cited with @handle source tags (@ANAROCK, @NAREDCO etc.)?

NOTE: DO NOT score RE_RELEVANCE for LinkedIn — employer brand is intentionally about careers, not homes.

Return ONLY valid JSON:
{
  "employer_brand_angle": 0.0,
  "tone_authenticity": 0.0,
  "length_compliance": 0.0,
  "data_sourcing": 0.0,
  "overall_quality_score": 0.0,
  "failing_dimensions": ["dimension_name"],
  "critique": "One paragraph: what specifically is weak — quote the problem phrase",
  "revision_instructions": ["Specific instruction 1", "Specific instruction 2"]
}""",

"housing_news": """You are a content quality reviewer for Housing.com's editorial news platform.

Score each dimension 0.0–10.0:

HEADLINE_QUALITY (25%): Curiosity-gap hook, not keyword-stuffed? ≤70 chars? Would you click it?
  9-10=irresistible; 6-8=good angle; 3-5=serviceable; 0-2=boring/keyword dump
ARTICLE_STRUCTURE (25%): Engaging opener? H2 sections? Pull quote that stands alone?
INTERNAL_LINKS (25%): ≥2 housing.com SRP/locality/calculator links naturally placed?
  9-10=2+ links contextually relevant; 5-8=present but weak placement; 0-4=missing or forced
FACTUAL_ACCURACY (25%): Do all specific claims match the source articles provided?

Return ONLY valid JSON:
{
  "headline_quality": 0.0,
  "article_structure": 0.0,
  "internal_links": 0.0,
  "factual_accuracy": 0.0,
  "overall_quality_score": 0.0,
  "failing_dimensions": ["dimension_name"],
  "critique": "One paragraph: what specifically is weak — quote the problem phrase",
  "revision_instructions": ["Specific instruction 1", "Specific instruction 2"]
}""",

"youtube": """You are a content quality reviewer for Housing.com's YouTube Shorts and long-form channel.

Score each dimension 0.0–10.0:

HOOK_THREE_SECONDS (35%): Does the first line/sentence compel someone to keep watching?
  9-10=unexpected hook that creates instant curiosity; 6-8=decent but predictable; 3-5=slow start
SCRIPT_NATURALNESS (30%): Does the script flow like speech, not written English read aloud?
  Conversational contractions, pauses, natural rhythm?
CTA_CLARITY (20%): Clear, specific call-to-action? Visit housing.com / subscribe / city link?
SEO_METADATA (15%): Title ≤60 chars? Description keywords? Chapter timestamps if long-form?

Return ONLY valid JSON:
{
  "hook_three_seconds": 0.0,
  "script_naturalness": 0.0,
  "cta_clarity": 0.0,
  "seo_metadata": 0.0,
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
    "twitter":      {"min_quality": 6.5, "min_er": 0.005, "hard_dims": ["character_compliance"]},
    "instagram":    {"min_quality": 6.0, "min_er": 0.020, "hard_dims": []},
    "linkedin":     {"min_quality": 6.5, "min_er": 0.000, "hard_dims": ["length_compliance"]},
    "housing_news": {"min_quality": 7.0, "min_er": 0.000, "hard_dims": ["factual_accuracy"]},
    "youtube":      {"min_quality": 6.0, "min_er": 0.000, "hard_dims": []},
}


# ─── Per-platform revision system prompts ─────────────────────────────────────

_PLATFORM_REVISION = {

"twitter": """You are Housing.com India's Twitter/X editor.
Apply the critique exactly. Preserve the Zomato-style Hinglish wit and the core trend angle.
Hard rule: main_tweet MUST be ≤280 characters.
Return ONLY valid JSON:
{"content": "revised tweet text", "hashtags": ["#tag1"], "revision_summary": "one sentence"}""",

"instagram": """You are Housing.com India's Instagram content editor.
Apply the critique exactly. Caption MUST be ≤150 chars. Keep it Hinglish and punchy.
Trend hashtag must be first. Ensure 15-20 total hashtags.
Return ONLY valid JSON:
{"content": "revised caption ≤150 chars", "hashtags": ["#OriginalTrendTag", "..."], "revision_summary": "one sentence"}""",

"linkedin": """You are Housing.com India's LinkedIn employer brand editor.
Apply the critique exactly. Post body MUST be 150-400 characters.
English-forward wit. housing.com/careers CTA required. Public data with @handle source tags.
No "thrilled/humbled/excited". No corporate padding.
Return ONLY valid JSON:
{"content": "revised post body", "hashtags": ["#tag1"], "revision_summary": "one sentence"}""",

"housing_news": """You are Housing.com India's editorial content editor.
Apply the critique exactly. Improve the headline to be a curiosity-gap hook (≤70 chars).
Ensure ≥2 housing.com internal links are naturally embedded. All factual claims must match sources.
Return ONLY valid JSON:
{"content": "revised full article text", "hashtags": ["#tag1"], "revision_summary": "one sentence"}""",

"youtube": """You are Housing.com India's YouTube content editor.
Apply the critique exactly. Rewrite the hook so the first sentence earns the view in 3 seconds.
Make the script sound like natural speech. Ensure a clear CTA.
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

    # Evaluate all posts concurrently — each post's full lifecycle is independent
    tasks = [
        _qa_lifecycle(post, source_summary, client, settings, post_attempts)
        for post in posts
    ]
    per_post = await asyncio.gather(*tasks, return_exceptions=True)

    qa_results: list[QAResult] = []
    approved: list[PlatformPost] = []

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

    logger.info("QA: %d/%d posts approved", len(approved), len(posts))
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
        return [result, re_result], {**revised, "status": "approved"}, attempt2

    logger.info("QA post %s [%s] still failing after revision (score=%.1f, %s) — dropping",
                post_id[:8], post["platform"], re_result["overall_quality_score"], re_result["decision"])
    return [result, re_result], None, attempt2


# ─── Evaluation (async, quality+engagement run in parallel) ──────────────────

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
        f"HASHTAGS: {' '.join(post.get('hashtags', []))}"
    )
    logger.info("QA evaluating post %s [%s] attempt=%d chars=%d",
                post["id"][:8], platform, attempt, len(post["content"]))

    # Pass 1: Safety — binary gate, fast tier
    with Timer() as t1:
        safety = await call_json_async(
            tier="fast", system=SAFETY_SYSTEM, user_msg=post_text,
            max_tokens=512, log_label=f"qa/safety/{platform}/{post['id'][:8]}",
        )
    logger.info("QA Pass1 Safety [%s] passed=%s violations=%s | %.0fms",
                platform, safety.get("passed", "?"), safety.get("violations", []), t1.elapsed_ms)

    if not safety.get("passed", True):
        return _build_result(post, safety, {}, {}, "reject", attempt)

    # Pass 2: Quality (balanced — semantic scoring) +
    # Pass 3: Engagement (fast — heuristic estimation) — run in parallel
    quality_system = _PLATFORM_QUALITY.get(platform, _DEFAULT_QUALITY_SYSTEM)
    quality_ctx = f"{post_text}\n\nSOURCE ARTICLES:\n{sources}"
    benchmarks = _PLATFORM_BENCHMARKS.get(platform, _PLATFORM_BENCHMARKS["twitter"])
    engagement_system = _ENGAGEMENT_SYSTEM_TEMPLATE.format(platform=platform, **benchmarks)

    with Timer() as t23:
        quality, engagement = await asyncio.gather(
            call_json_async(tier="balanced", system=quality_system, user_msg=quality_ctx,
                            max_tokens=1200, log_label=f"qa/quality/{platform}/{post['id'][:8]}"),
            call_json_async(tier="fast", system=engagement_system, user_msg=post_text,
                            max_tokens=768, log_label=f"qa/engagement/{platform}/{post['id'][:8]}"),
        )
    logger.info("QA Pass2+3 [%s] quality=%.1f failing=%s pred_er=%.1f%% | %.0fms",
                platform, quality.get("overall_quality_score", 0),
                quality.get("failing_dimensions", []),
                engagement.get("pred_engagement_rate", 0) * 100, t23.elapsed_ms)

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

Apply the critique. Return the revised JSON now."""

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
