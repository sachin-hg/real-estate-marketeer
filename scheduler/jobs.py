"""
APScheduler jobs:
  - content_run_job: triggers a full pipeline run (9 AM and 6 PM IST by default)
  - engagement_tracker_job: fetches actual metrics from platforms (6h, 24h, 7d windows)
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from config import get_settings

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")


# ─── Content run ─────────────────────────────────────────────────────────────

async def content_run_job(topic_hint: str | None = None):
    from workflow.graph import graph

    settings = get_settings()
    run_id = str(uuid.uuid4())[:8]
    logger.info("Scheduled content run starting: %s", run_id)

    initial_state = {
        "run_id": run_id,
        "triggered_at": datetime.now(timezone.utc).isoformat(),
        "dry_run": settings.dry_run,
        "topic_hint": topic_hint,
        "slack_topic": None,
        "target_platforms": settings.platform_list,
        "research": [],
        "trends": [],
        "creative_drafts": [],
        "platform_posts": [],
        "qa_results": [],
        "approved_posts": [],
        "published": [],
        "retry_count": 0,
        "qa_post_attempts": {},
        "error": None,
    }

    try:
        await graph.ainvoke(initial_state)
        logger.info("Scheduled run %s complete", run_id)
    except Exception as exc:
        logger.error("Scheduled run %s failed: %s", run_id, exc, exc_info=True)


# ─── Engagement tracker ───────────────────────────────────────────────────────

async def fetch_engagement_metrics(post_id: str, platform: str, platform_post_id: str, window: str):
    """
    Fetch actual metrics from platform APIs and store to DB.
    Currently stubs — replace with real API calls.
    """
    logger.info("Engagement tracker: %s %s @ %s window", platform, post_id[:8], window)
    metrics = _fetch_platform_metrics(platform, platform_post_id, window)
    if metrics:
        _store_metrics(post_id, window, metrics)


def _fetch_platform_metrics(platform: str, post_id: str, window: str) -> dict | None:
    """TODO: implement per-platform metric fetching."""
    # Twitter: tweepy client.get_tweet(id, tweet_fields=["public_metrics"])
    # Instagram: Graph API insights endpoint
    # Housing News: GA4 / internal analytics API
    logger.debug("Metric fetch for %s %s is a stub — implement when live", platform, post_id)
    return None


def _store_metrics(post_id: str, window: str, metrics: dict):
    try:
        from db.connection import get_db_session
        from db.models import PublishedPostRecord
        from sqlalchemy import update

        cols = {
            f"actual_impressions_{window}": metrics.get("impressions"),
            f"actual_likes_{window}": metrics.get("likes"),
        }
        if window == "24h":
            cols.update({
                "actual_shares_24h": metrics.get("shares"),
                "actual_comments_24h": metrics.get("comments"),
                "actual_ctr_24h": metrics.get("ctr"),
                "actual_saves_24h": metrics.get("saves"),
            })
        if window == "7d":
            er = metrics.get("engagement_rate")
            cols["actual_engagement_7d"] = er
            cols["actual_housing_traffic"] = metrics.get("housing_traffic")
            # Compute prediction accuracy
            with get_db_session() as s:
                record = s.query(PublishedPostRecord).filter_by(post_id=post_id).first()
                if record and record.pred_engagement_rate and er:
                    cols["prediction_accuracy"] = er / record.pred_engagement_rate

        with get_db_session() as session:
            session.execute(
                update(PublishedPostRecord)
                .where(PublishedPostRecord.post_id == post_id)
                .values(**{k: v for k, v in cols.items() if v is not None})
            )
            session.commit()

    except Exception as exc:
        logger.error("Failed to store metrics for %s: %s", post_id, exc)


def schedule_engagement_tracking(post_id: str, platform: str, platform_post_id: str):
    """Call this after publishing to schedule the 3 metric-fetch jobs."""
    from datetime import timedelta

    now = datetime.now(timezone.utc)
    for hours, label in [(6, "6h"), (24, "24h"), (168, "7d")]:
        run_at = now + timedelta(hours=hours)
        scheduler.add_job(
            fetch_engagement_metrics,
            "date",
            run_date=run_at,
            args=[post_id, platform, platform_post_id, label],
            id=f"engagement_{post_id}_{label}",
            replace_existing=True,
        )
    logger.debug("Scheduled engagement tracking for post %s", post_id[:8])


# ─── Register scheduled runs ──────────────────────────────────────────────────

def register_jobs():
    # 9:00 AM IST daily
    scheduler.add_job(
        content_run_job,
        CronTrigger(hour=9, minute=0, timezone="Asia/Kolkata"),
        id="morning_run",
        replace_existing=True,
    )
    # 6:00 PM IST daily
    scheduler.add_job(
        content_run_job,
        CronTrigger(hour=18, minute=0, timezone="Asia/Kolkata"),
        id="evening_run",
        replace_existing=True,
    )
    logger.info("Scheduled: morning (9 AM IST) + evening (6 PM IST) content runs")
