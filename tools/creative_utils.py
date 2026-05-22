"""
Shared helpers for social_creative_agent and news_creative_agent.

Extracted from creative_marketeer.py to avoid duplication across the two nodes.
"""
from __future__ import annotations

import logging
import uuid

from models.state import CreativeDraft

logger = logging.getLogger(__name__)


def get_performance_history() -> str:
    try:
        from db.connection import get_db_session
        from db.models import PublishedPostRecord
        from sqlalchemy import desc, asc

        with get_db_session() as session:
            top = (
                session.query(PublishedPostRecord)
                .filter(PublishedPostRecord.actual_engagement_7d.isnot(None))
                .order_by(desc(PublishedPostRecord.actual_engagement_7d))
                .limit(3).all()
            )
            bottom = (
                session.query(PublishedPostRecord)
                .filter(PublishedPostRecord.actual_engagement_7d.isnot(None))
                .order_by(asc(PublishedPostRecord.actual_engagement_7d))
                .limit(2).all()
            )
            if not top and not bottom:
                return "No historical data yet — this is an early run."

            def fmt(records, label):
                lines = [label]
                for r in records:
                    actual_er = r.actual_engagement_7d
                    pred_er = getattr(r, "pred_engagement_rate", None) or 0
                    angle = (getattr(r, "creative_angle", "") or "").strip()
                    trend = (getattr(r, "trend_hashtag", "") or "").strip()
                    media = (getattr(r, "media_format", "") or "").strip()
                    content = (r.content or "")[:120]
                    delta = actual_er - pred_er
                    delta_str = f"+{delta:.1%}" if delta >= 0 else f"{delta:.1%}"
                    lines.append(
                        f"  [{r.platform}] actual ER {actual_er:.1%} "
                        f"(pred {pred_er:.1%}, delta {delta_str})\n"
                        f"    ANGLE: {angle or 'not recorded'}\n"
                        f"    HOOK:  {content}..."
                        + (f"\n    TREND: {trend}" if trend else "")
                        + (f"\n    FORMAT: {media}" if media else "")
                    )
                return "\n".join(lines)

            return (
                fmt(top, "TOP PERFORMERS — study WHAT made these work (angle, hook, trend tie-in):")
                + "\n\n"
                + fmt(bottom, "WORST PERFORMERS — avoid these patterns:")
            )
    except Exception as exc:
        logger.debug("History fetch skipped: %s", exc)
        return "No historical data yet — this is an early run."


def parse_drafts(raw: str, default_type: str = "social") -> list[CreativeDraft]:
    from tools.json_utils import extract_json
    data = extract_json(raw)
    if isinstance(data, list):
        for d in data:
            d.setdefault("draft_type", default_type)
        return data
    logger.error("Failed to parse %s drafts. Raw (first 800 chars): %s", default_type, raw[:800])
    return []


def normalize_drafts(drafts: list[dict]) -> list[dict]:
    """Fill in required fields with safe defaults if the LLM omitted them."""
    for d in drafts:
        if not d.get("id"):
            d["id"] = str(uuid.uuid4())
        d.setdefault("internal_links", [])
        d.setdefault("zomato_hook", "")
        d.setdefault("caption", "")
        d.setdefault("city_hint", None)
        d.setdefault("media_format", "branded_card")
        d.setdefault("trend_hashtag", "")
        d.setdefault("meme_concept", "")
        d.setdefault("re_signals", None)
        # news-specific fields
        d.setdefault("pull_quote", "")
        d.setdefault("meta_description", "")
        d.setdefault("slug", "")
        if not d.get("target_platforms"):
            d["target_platforms"] = (
                ["twitter", "instagram"] if d.get("draft_type") == "social" else ["housing_news"]
            )
    return drafts
