from __future__ import annotations

import asyncio
import logging

from config import get_settings
from models.state import WorkflowState
from agents.platform.twitter_agent import run_twitter_agent
from agents.platform.instagram_agent import run_instagram_agent
from agents.platform.youtube_agent import run_youtube_agent
from agents.platform.housing_news_agent import run_housing_news_agent
from agents.platform.linkedin_agent import run_linkedin_agent

logger = logging.getLogger(__name__)

PLATFORM_RUNNERS = {
    "twitter": run_twitter_agent,
    "instagram": run_instagram_agent,
    "youtube": run_youtube_agent,
    "housing_news": run_housing_news_agent,
    "linkedin": run_linkedin_agent,
}

# Which draft_type(s) each platform accepts
PLATFORM_DRAFT_TYPES: dict[str, list[str]] = {
    "twitter":      ["social"],
    "instagram":    ["social"],
    "youtube":      ["social", "news"],   # YouTube accepts both Shorts (social) and long-form (news)
    "housing_news": ["news"],
    "linkedin":     ["social"],           # Employer brand — riffs on trends, not RE news
}


async def platform_agents_node(state: WorkflowState) -> dict:
    """
    LangGraph node: runs all platform agents concurrently for each draft.
    Uses the top N creative drafts (configured via MAX_CREATIVE_DRAFTS).
    """
    settings = get_settings()
    target_platforms = state.get("target_platforms", settings.platform_list)
    drafts = state.get("creative_drafts", [])
    run_id = state["run_id"]

    if not drafts:
        logger.warning("Platform orchestrator: no drafts to process")
        return {"platform_posts": []}

    tasks = []
    task_labels = []
    for draft in drafts:
        draft_type = draft.get("draft_type", "social")

        # Per-draft platform list (set by creative LLM) gated by globally enabled platforms.
        # This lets a layoff trend skip Instagram, or a cricket trend skip LinkedIn,
        # without disabling those platforms globally.
        draft_platforms = draft.get("target_platforms") or target_platforms
        effective_platforms = [p for p in draft_platforms if p in target_platforms]

        if not effective_platforms:
            logger.debug("No effective platforms for draft '%s' (draft=%s, global=%s)",
                         draft.get("headline", "")[:40], draft_platforms, target_platforms)
            continue

        for platform in effective_platforms:
            runner = PLATFORM_RUNNERS.get(platform)
            if not runner:
                logger.warning("Unknown platform: %s", platform)
                continue
            # Safety valve: only send draft to platforms that accept its type
            expected_types = PLATFORM_DRAFT_TYPES.get(platform, ["social"])
            if draft_type not in expected_types:
                logger.debug("Skipping %s for %s draft '%s'",
                             platform, draft_type, draft.get("headline", "")[:40])
                continue
            if platform == "instagram":
                tasks.append(runner(draft, settings, run_id))
            else:
                tasks.append(runner(draft, settings))
            task_labels.append(f"{platform}/{draft.get('headline', '')[:40]}")

    logger.info("Platform orchestrator: running %d tasks concurrently (timeout=%ds)",
                len(tasks), settings.platform_agent_timeout)
    for label in task_labels:
        logger.debug("Platform orchestrator: queued task %s", label)

    from tools.run_logger import Timer
    with Timer() as t:
        try:
            results = await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=settings.platform_agent_timeout,
            )
        except asyncio.TimeoutError:
            logger.error(
                "Platform orchestrator: timed out after %ds — %d tasks may be incomplete",
                settings.platform_agent_timeout, len(tasks),
            )
            results = [asyncio.TimeoutError(f"Timed out: {lbl}") for lbl in task_labels]

    posts = []
    for label, result in zip(task_labels, results):
        if isinstance(result, Exception):
            logger.error("Platform agent FAILED [%s]: %s", label, result, exc_info=result)
        else:
            posts.append(result)
            logger.debug("Platform agent SUCCESS [%s] → post_id=%s",
                         label, result.get("id", "")[:8])

    logger.info("Platform orchestrator: %d/%d posts generated in %.0fs",
                len(posts), len(tasks), t.elapsed_ms / 1000)
    return {"platform_posts": posts}
