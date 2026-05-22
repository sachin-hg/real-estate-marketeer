from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/posts", tags=["posts"])


def _serialize_record(r) -> dict:
    def _parse_json_list(val):
        if not val:
            return []
        try:
            parsed = json.loads(val)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []

    def _parse_json_obj(val):
        if not val:
            return {}
        try:
            parsed = json.loads(val)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}

    return {
        "id": r.id,
        "post_id": r.post_id,
        "run_id": r.run_id,
        "platform": r.platform,
        "platform_post_id": r.platform_post_id,
        "published_url": r.published_url,
        "output_path": r.output_path,
        "published_at": r.published_at.isoformat() if r.published_at else None,
        "content": r.content,
        "hashtags": _parse_json_list(r.hashtags),
        "internal_links": _parse_json_list(r.internal_links),
        "media_urls": _parse_json_list(r.media_urls),
        "creative_angle": r.creative_angle,
        "qa_safety_passed": r.qa_safety_passed,
        "qa_re_relevance": r.qa_re_relevance,
        "qa_backlink_score": r.qa_backlink_score,
        "qa_brand_voice": r.qa_brand_voice,
        "qa_overall": r.qa_overall,
        "pred_impressions": r.pred_impressions,
        "pred_likes": r.pred_likes,
        "pred_shares": r.pred_shares,
        "pred_comments": r.pred_comments,
        "pred_ctr": r.pred_ctr,
        "pred_engagement_rate": r.pred_engagement_rate,
        "pred_confidence": r.pred_confidence,
        "actual_impressions_6h": r.actual_impressions_6h,
        "actual_likes_6h": r.actual_likes_6h,
        "actual_impressions_24h": r.actual_impressions_24h,
        "actual_likes_24h": r.actual_likes_24h,
        "actual_shares_24h": r.actual_shares_24h,
        "actual_comments_24h": r.actual_comments_24h,
        "actual_ctr_24h": r.actual_ctr_24h,
        "actual_saves_24h": r.actual_saves_24h,
        "actual_impressions_7d": r.actual_impressions_7d,
        "actual_engagement_7d": r.actual_engagement_7d,
        "actual_housing_traffic": r.actual_housing_traffic,
        "prediction_accuracy": r.prediction_accuracy,
        "qa_decision": r.qa_decision,
        "post_status": r.post_status,
        "qa_rejection_reasons": _parse_json_list(r.qa_rejection_reasons),
        "user_rating": r.user_rating,
        "user_tags": _parse_json_list(r.user_tags),
        "user_feedback": r.user_feedback,
        "user_action": r.user_action,
        "rejection_reason": r.rejection_reason,
        "draft_type": r.draft_type,
        "zomato_hook": r.zomato_hook,
        "trend_hashtag": r.trend_hashtag,
        "media_format": r.media_format,
        "source_topic": r.source_topic,
        "qa_critique": r.qa_critique or "",
        "qa_quality_dimensions": _parse_json_obj(r.qa_quality_dimensions),
        "engagement_reasoning": r.engagement_reasoning or "",
        "trend_data": _parse_json_obj(r.trend_data),
        "extra_data": _parse_json_obj(r.extra_data),
    }


@router.get("/stats")
def get_stats():
    from db.connection import get_db_session
    from db.models import PublishedPostRecord
    from sqlalchemy import func

    with get_db_session() as session:
        total = session.query(func.count(PublishedPostRecord.id)).scalar() or 0
        avg_qa = session.query(func.avg(PublishedPostRecord.qa_overall)).scalar() or 0.0
        avg_pred_er = session.query(func.avg(PublishedPostRecord.pred_engagement_rate)).scalar() or 0.0

        platform_rows = (
            session.query(PublishedPostRecord.platform, func.count(PublishedPostRecord.id))
            .group_by(PublishedPostRecord.platform)
            .all()
        )
        by_platform = {row[0]: row[1] for row in platform_rows}

        action_rows = (
            session.query(PublishedPostRecord.user_action, func.count(PublishedPostRecord.id))
            .filter(PublishedPostRecord.user_action.isnot(None))
            .group_by(PublishedPostRecord.user_action)
            .all()
        )
        by_action = {row[0]: row[1] for row in action_rows}

        status_rows = (
            session.query(PublishedPostRecord.post_status, func.count(PublishedPostRecord.id))
            .filter(PublishedPostRecord.post_status.isnot(None))
            .group_by(PublishedPostRecord.post_status)
            .all()
        )
        by_post_status = {row[0]: row[1] for row in status_rows}

        qa_rejected_count = by_post_status.get("qa_rejected", 0)
        qa_rejection_rate = qa_rejected_count / max(total, 1)

        # Per-platform QA rejection breakdown
        platform_rejected_rows = (
            session.query(PublishedPostRecord.platform, func.count(PublishedPostRecord.id))
            .filter(PublishedPostRecord.post_status == "qa_rejected")
            .group_by(PublishedPostRecord.platform)
            .all()
        )
        qa_rejected_by_platform = {row[0]: row[1] for row in platform_rejected_rows}

        non_rejected_count = total - qa_rejected_count

        # Average cost per non-rejected post — only across runs that have cost data.
        # Cost logging was added mid-way; old runs have no llm_calls rows, so exclude them
        # from the denominator to avoid diluting the average with zero-cost ghost posts.
        from db.models import LlmCallRecord, ApiCallRecord
        from sqlalchemy import distinct

        # Runs with at least one LLM cost recorded
        costed_run_ids = [
            r[0] for r in session.query(distinct(LlmCallRecord.run_id))
            .filter(LlmCallRecord.cost_usd.isnot(None))
            .all()
            if r[0]
        ]

        total_llm_cost = session.query(func.sum(LlmCallRecord.cost_usd)).scalar() or 0.0

        _API_COST_PER_CALL: dict[str, float] = {
            "tavily": 0.005, "serpapi": 0.010, "apify": 0.005,
            "rapidapi_twitter_trends": 0.001,
        }
        api_name_rows = (
            session.query(ApiCallRecord.api_name, func.count(ApiCallRecord.id))
            .filter(ApiCallRecord.run_id.in_(costed_run_ids))
            .group_by(ApiCallRecord.api_name)
            .all()
        ) if costed_run_ids else []
        total_api_cost = sum(
            _API_COST_PER_CALL.get(name or "", 0.0) * cnt
            for name, cnt in api_name_rows
        )

        total_cost = float(total_llm_cost) + total_api_cost

        # Non-rejected posts only from costed runs
        costed_non_rejected = (
            session.query(func.count(PublishedPostRecord.id))
            .filter(
                PublishedPostRecord.run_id.in_(costed_run_ids),
                PublishedPostRecord.post_status != "qa_rejected",
            )
            .scalar() or 0
        ) if costed_run_ids else 0

        # Divide by costed posts only (avoids diluting with zero-cost legacy posts),
        # but fall back to total non-rejected when there's no cost data at all.
        avg_cost_per_post = total_cost / max(costed_non_rejected, 1) if costed_non_rejected else 0.0

    return {
        "total": total,
        "avg_qa": round(float(avg_qa), 2),
        "avg_pred_er": round(float(avg_pred_er), 4),
        "by_platform": by_platform,
        "by_action": by_action,
        "by_post_status": by_post_status,
        "qa_rejection_rate": round(float(qa_rejection_rate), 4),
        "qa_rejected_by_platform": qa_rejected_by_platform,
        "total_llm_cost": round(float(total_llm_cost), 4),
        "total_api_cost": round(total_api_cost, 4),
        "total_cost": round(total_cost, 4),
        "non_rejected_count": non_rejected_count,
        "avg_cost_per_post": round(avg_cost_per_post, 4),
    }


@router.get("/")
def list_posts(
    platform: Optional[str] = None,
    status: Optional[str] = None,
    post_status: Optional[str] = None,
    run_id: Optional[str] = None,
    draft_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
):
    from db.connection import get_db_session
    from db.models import PublishedPostRecord
    from sqlalchemy import desc
    from datetime import datetime, timezone

    with get_db_session() as session:
        q = session.query(PublishedPostRecord)
        if platform:
            q = q.filter(PublishedPostRecord.platform == platform)
        if status:
            q = q.filter(PublishedPostRecord.user_action == status)
        if post_status:
            q = q.filter(PublishedPostRecord.post_status == post_status)
        if run_id:
            q = q.filter(PublishedPostRecord.run_id == run_id)
        if draft_type:
            q = q.filter(PublishedPostRecord.draft_type == draft_type)
        if search:
            q = q.filter(PublishedPostRecord.content.ilike(f"%{search}%"))
        if date_from:
            try:
                q = q.filter(PublishedPostRecord.published_at >= datetime.fromisoformat(date_from))
            except ValueError:
                pass
        if date_to:
            try:
                # Include the full day by going to end-of-day if no time component
                dt = datetime.fromisoformat(date_to)
                if dt.hour == 0 and dt.minute == 0 and dt.second == 0:
                    from datetime import timedelta
                    dt = dt + timedelta(days=1)
                q = q.filter(PublishedPostRecord.published_at < dt)
            except ValueError:
                pass

        total = q.count()
        records = (
            q.order_by(desc(PublishedPostRecord.published_at))
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )
        items = [_serialize_record(r) for r in records]

    return {"total": total, "page": page, "limit": limit, "items": items}


@router.get("/{post_id}")
def get_post(post_id: str):
    from db.connection import get_db_session
    from db.models import PublishedPostRecord

    with get_db_session() as session:
        record = session.query(PublishedPostRecord).filter(
            PublishedPostRecord.post_id == post_id
        ).first()
        if not record:
            raise HTTPException(status_code=404, detail="Post not found")
        return _serialize_record(record)


class FeedbackBody(BaseModel):
    rating: Optional[int] = None
    tags: Optional[list[str]] = None
    feedback: Optional[str] = None
    action: Optional[str] = None
    rejection_reason: Optional[str] = None


@router.post("/{post_id}/feedback")
def submit_feedback(post_id: str, body: FeedbackBody):
    from db.connection import get_db_session
    from db.models import PublishedPostRecord

    with get_db_session() as session:
        record = session.query(PublishedPostRecord).filter(
            PublishedPostRecord.post_id == post_id
        ).first()
        if not record:
            raise HTTPException(status_code=404, detail="Post not found")

        if body.rating is not None:
            record.user_rating = body.rating
        if body.tags is not None:
            record.user_tags = json.dumps(body.tags)
        if body.feedback is not None:
            record.user_feedback = body.feedback
        if body.action is not None:
            record.user_action = body.action
        if body.rejection_reason is not None:
            record.rejection_reason = body.rejection_reason

        session.commit()
        return _serialize_record(record)


class RejectBody(BaseModel):
    reason: str


@router.post("/{post_id}/reject")
def reject_post(post_id: str, body: RejectBody):
    from db.connection import get_db_session
    from db.models import PublishedPostRecord

    with get_db_session() as session:
        record = session.query(PublishedPostRecord).filter(
            PublishedPostRecord.post_id == post_id
        ).first()
        if not record:
            raise HTTPException(status_code=404, detail="Post not found")

        record.user_action = "rejected"
        record.rejection_reason = body.reason
        session.commit()
        return _serialize_record(record)


# ─── Edit post (manual tweaks) ────────────────────────────────────────────────

class UpdatePostBody(BaseModel):
    content: Optional[str] = None
    hashtags: Optional[list[str]] = None
    zomato_hook: Optional[str] = None
    media_urls: Optional[list[str]] = None


@router.patch("/{post_id}")
def update_post(post_id: str, body: UpdatePostBody):
    from db.connection import get_db_session
    from db.models import PublishedPostRecord

    with get_db_session() as session:
        record = session.query(PublishedPostRecord).filter(
            PublishedPostRecord.post_id == post_id
        ).first()
        if not record:
            raise HTTPException(status_code=404, detail="Post not found")

        if body.content is not None:
            record.content = body.content
        if body.hashtags is not None:
            record.hashtags = json.dumps(body.hashtags)
        if body.zomato_hook is not None:
            record.zomato_hook = body.zomato_hook
        if body.media_urls is not None:
            record.media_urls = json.dumps(body.media_urls)

        session.commit()
        logger.info("Post %s updated manually", post_id[:8])
        return _serialize_record(record)


@router.post("/{post_id}/publish")
def publish_draft(post_id: str):
    """Publish a HITL draft post to its target platform."""
    from db.connection import get_db_session
    from db.models import PublishedPostRecord
    from config import get_settings
    from agents.publisher import _publish_to_platform, _save_locally, OUTPUT_ROOT

    with get_db_session() as session:
        record = session.query(PublishedPostRecord).filter(
            PublishedPostRecord.post_id == post_id
        ).first()
        if not record:
            raise HTTPException(status_code=404, detail="Post not found")
        if record.post_status != "draft":
            raise HTTPException(
                status_code=400,
                detail=f"Post is not a draft (status: {record.post_status})",
            )

        settings = get_settings()
        post = {
            "id": record.post_id,
            "platform": record.platform,
            "content": record.content,
            "hashtags": json.loads(record.hashtags or "[]"),
            "internal_links": json.loads(record.internal_links or "[]"),
            "media_urls": json.loads(record.media_urls or "[]"),
            "extra": json.loads(record.extra_data or "{}"),
            "draft_id": None,
        }

        try:
            run_dir = OUTPUT_ROOT / record.run_id / "published"
            run_dir.mkdir(parents=True, exist_ok=True)

            if settings.dry_run:
                result = _save_locally(post, run_dir)
            else:
                result = _publish_to_platform(post, settings)

            record.post_status = "published"
            record.platform_post_id = result.get("platform_post_id", "") or ""
            record.published_url = result.get("url", "") or ""
            record.output_path = result.get("output_path", "") or ""
            session.commit()
            logger.info("Published draft post %s [%s]", post_id[:8], record.platform)
            return _serialize_record(record)
        except Exception as exc:
            logger.error("Publish failed for post %s: %s", post_id[:8], exc, exc_info=True)
            raise HTTPException(status_code=500, detail=f"Publish failed: {exc}")


_MEDIA_DIR = Path(__file__).parent.parent.parent / "output" / "media"
_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4"}
_MAX_BYTES = 20 * 1024 * 1024   # 20 MB


@router.post("/{post_id}/media")
async def upload_post_media(post_id: str, file: UploadFile = File(...)):
    """Upload or replace a media asset for a post. Returns the relative path served at /output/..."""
    if file.content_type not in _ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail=f"Unsupported media type: {file.content_type}")

    dest_dir = _MEDIA_DIR / post_id
    dest_dir.mkdir(parents=True, exist_ok=True)

    suffix = Path(file.filename or "upload").suffix or ".jpg"
    filename = f"{uuid.uuid4().hex[:8]}{suffix}"
    dest = dest_dir / filename

    data = await file.read()
    if len(data) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 20 MB)")

    dest.write_bytes(data)
    relative_path = f"output/media/{post_id}/{filename}"
    logger.info("Media uploaded for post %s → %s", post_id[:8], relative_path)
    return {"path": relative_path, "url": f"/{relative_path}"}
