from __future__ import annotations

import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
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
        "user_rating": r.user_rating,
        "user_tags": _parse_json_list(r.user_tags),
        "user_feedback": r.user_feedback,
        "user_action": r.user_action,
        "rejection_reason": r.rejection_reason,
        "draft_type": r.draft_type,
        "zomato_hook": r.zomato_hook,
        "trend_hashtag": r.trend_hashtag,
        "media_format": r.media_format,
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

    return {
        "total": total,
        "avg_qa": round(float(avg_qa), 2),
        "avg_pred_er": round(float(avg_pred_er), 4),
        "by_platform": by_platform,
        "by_action": by_action,
    }


@router.get("/")
def list_posts(
    platform: Optional[str] = None,
    status: Optional[str] = None,
    run_id: Optional[str] = None,
    draft_type: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
):
    from db.connection import get_db_session
    from db.models import PublishedPostRecord
    from sqlalchemy import desc

    with get_db_session() as session:
        q = session.query(PublishedPostRecord)
        if platform:
            q = q.filter(PublishedPostRecord.platform == platform)
        if status:
            q = q.filter(PublishedPostRecord.user_action == status)
        if run_id:
            q = q.filter(PublishedPostRecord.run_id == run_id)
        if draft_type:
            q = q.filter(PublishedPostRecord.draft_type == draft_type)

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
