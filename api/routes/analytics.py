from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/")
def get_analytics():
    from db.connection import get_db_session
    from db.models import PublishedPostRecord, LlmCallRecord, ApiCallRecord
    from sqlalchemy import func, distinct

    with get_db_session() as session:
        # ── Posts over time (daily) ─────────────────────────────────────────
        date_rows = (
            session.query(
                func.strftime("%Y-%m-%d", PublishedPostRecord.published_at).label("date"),
                func.count(PublishedPostRecord.id).label("total"),
            )
            .filter(PublishedPostRecord.published_at.isnot(None))
            .group_by(func.strftime("%Y-%m-%d", PublishedPostRecord.published_at))
            .order_by("date")
            .all()
        )
        published_rows = (
            session.query(
                func.strftime("%Y-%m-%d", PublishedPostRecord.published_at).label("date"),
                func.count(PublishedPostRecord.id).label("cnt"),
            )
            .filter(PublishedPostRecord.published_at.isnot(None), PublishedPostRecord.post_status == "published")
            .group_by(func.strftime("%Y-%m-%d", PublishedPostRecord.published_at))
            .all()
        )
        qa_rejected_rows = (
            session.query(
                func.strftime("%Y-%m-%d", PublishedPostRecord.published_at).label("date"),
                func.count(PublishedPostRecord.id).label("cnt"),
            )
            .filter(PublishedPostRecord.published_at.isnot(None), PublishedPostRecord.post_status == "qa_rejected")
            .group_by(func.strftime("%Y-%m-%d", PublishedPostRecord.published_at))
            .all()
        )
        pub_map = {r.date: r.cnt for r in published_rows}
        qa_rej_map = {r.date: r.cnt for r in qa_rejected_rows}
        posts_over_time = [
            {
                "date": r.date,
                "total": r.total,
                "published": pub_map.get(r.date, 0),
                "qa_rejected": qa_rej_map.get(r.date, 0),
            }
            for r in date_rows
        ]

        # ── Cost over time (per run) ────────────────────────────────────────
        _API_COST: dict[str, float] = {
            "tavily": 0.005, "serpapi": 0.010, "apify": 0.005,
            "rapidapi_twitter_trends": 0.001,
        }
        run_llm_rows = (
            session.query(
                LlmCallRecord.run_id,
                func.sum(LlmCallRecord.cost_usd).label("llm_cost"),
                func.min(LlmCallRecord.called_at).label("first_call"),
            )
            .filter(LlmCallRecord.cost_usd.isnot(None))
            .group_by(LlmCallRecord.run_id)
            .order_by("first_call")
            .all()
        )
        run_api_rows = (
            session.query(ApiCallRecord.run_id, ApiCallRecord.api_name, func.count(ApiCallRecord.id).label("cnt"))
            .filter(ApiCallRecord.run_id.in_([r.run_id for r in run_llm_rows]))
            .group_by(ApiCallRecord.run_id, ApiCallRecord.api_name)
            .all()
        )
        api_cost_map: dict[str, float] = {}
        for r in run_api_rows:
            api_cost_map[r.run_id] = api_cost_map.get(r.run_id, 0.0) + _API_COST.get(r.api_name or "", 0.0) * r.cnt

        cost_over_time = [
            {
                "run_id": r.run_id,
                "date": r.first_call.strftime("%Y-%m-%d") if r.first_call else None,
                "llm_cost": round(float(r.llm_cost or 0), 4),
                "api_cost": round(api_cost_map.get(r.run_id, 0.0), 4),
                "total_cost": round(float(r.llm_cost or 0) + api_cost_map.get(r.run_id, 0.0), 4),
            }
            for r in run_llm_rows
        ]

        # ── Engagement data (pred vs actual, last 200 posts with pred_er) ──
        eng_rows = (
            session.query(PublishedPostRecord)
            .filter(PublishedPostRecord.pred_engagement_rate.isnot(None))
            .order_by(PublishedPostRecord.published_at.desc())
            .limit(200)
            .all()
        )
        engagement_data = [
            {
                "post_id": r.post_id,
                "platform": r.platform,
                "pred_er": round(float(r.pred_engagement_rate or 0), 4),
                "actual_er": round(float(r.actual_engagement_7d), 4) if r.actual_engagement_7d is not None else None,
                "qa_overall": round(float(r.qa_overall or 0), 1),
                "published_at": r.published_at.isoformat() if r.published_at else None,
            }
            for r in eng_rows
        ]

        # ── Per-platform time series ────────────────────────────────────────
        # Main aggregation: count, avg_qa, avg_pred_er, avg_actual_er
        plat_time_raw = (
            session.query(
                func.strftime("%Y-%m-%d", PublishedPostRecord.published_at).label("date"),
                PublishedPostRecord.platform,
                func.count(PublishedPostRecord.id).label("count"),
                func.avg(PublishedPostRecord.qa_overall).label("avg_qa"),
                func.avg(PublishedPostRecord.pred_engagement_rate).label("avg_pred_er"),
                func.avg(PublishedPostRecord.actual_engagement_7d).label("avg_actual_er"),
            )
            .filter(PublishedPostRecord.published_at.isnot(None))
            .group_by(
                func.strftime("%Y-%m-%d", PublishedPostRecord.published_at),
                PublishedPostRecord.platform,
            )
            .order_by("date")
            .all()
        )
        # Separate query for rejected count per (date, platform) — avoids case() syntax issues
        plat_rej_raw = (
            session.query(
                func.strftime("%Y-%m-%d", PublishedPostRecord.published_at).label("date"),
                PublishedPostRecord.platform,
                func.count(PublishedPostRecord.id).label("cnt"),
            )
            .filter(
                PublishedPostRecord.published_at.isnot(None),
                PublishedPostRecord.post_status == "qa_rejected",
            )
            .group_by(
                func.strftime("%Y-%m-%d", PublishedPostRecord.published_at),
                PublishedPostRecord.platform,
            )
            .all()
        )
        plat_rej_map = {(r.date, r.platform): r.cnt for r in plat_rej_raw}

        platform_over_time = [
            {
                "date": r.date,
                "platform": r.platform,
                "count": r.count,
                "avg_qa": round(float(r.avg_qa), 2) if r.avg_qa is not None else None,
                "avg_pred_er": round(float(r.avg_pred_er), 4) if r.avg_pred_er is not None else None,
                "avg_actual_er": round(float(r.avg_actual_er), 4) if r.avg_actual_er is not None else None,
                "rejected_count": plat_rej_map.get((r.date, r.platform), 0),
                "rejection_rate": round(
                    plat_rej_map.get((r.date, r.platform), 0) / r.count, 4
                ) if r.count > 0 else 0.0,
            }
            for r in plat_time_raw
        ]

        # ── Platform performance (all-time aggregate) ───────────────────────
        plat_rows = (
            session.query(
                PublishedPostRecord.platform,
                func.count(PublishedPostRecord.id).label("count"),
                func.avg(PublishedPostRecord.pred_engagement_rate).label("avg_pred_er"),
                func.avg(PublishedPostRecord.actual_engagement_7d).label("avg_actual_er"),
                func.avg(PublishedPostRecord.qa_overall).label("avg_qa"),
            )
            .filter(PublishedPostRecord.post_status != "qa_rejected")
            .group_by(PublishedPostRecord.platform)
            .all()
        )
        platform_performance = [
            {
                "platform": r.platform,
                "count": r.count,
                "avg_pred_er": round(float(r.avg_pred_er or 0), 4),
                "avg_actual_er": round(float(r.avg_actual_er), 4) if r.avg_actual_er is not None else None,
                "avg_qa": round(float(r.avg_qa or 0), 2),
            }
            for r in plat_rows
        ]

        # ── Top posts by predicted ER ───────────────────────────────────────
        top_rows = (
            session.query(PublishedPostRecord)
            .filter(
                PublishedPostRecord.post_status != "qa_rejected",
                PublishedPostRecord.pred_engagement_rate.isnot(None),
            )
            .order_by(PublishedPostRecord.pred_engagement_rate.desc())
            .limit(10)
            .all()
        )
        top_posts = [
            {
                "post_id": r.post_id,
                "platform": r.platform,
                "pred_er": round(float(r.pred_engagement_rate or 0), 4),
                "actual_er": round(float(r.actual_engagement_7d), 4) if r.actual_engagement_7d is not None else None,
                "qa_overall": round(float(r.qa_overall or 0), 1),
                "published_at": r.published_at.isoformat() if r.published_at else None,
                "content_snippet": (r.content or "")[:120],
            }
            for r in top_rows
        ]

        # ── Totals ─────────────────────────────────────────────────────────
        total_posts = session.query(func.count(PublishedPostRecord.id)).scalar() or 0
        avg_qa = session.query(func.avg(PublishedPostRecord.qa_overall)).scalar() or 0.0
        avg_pred_er = session.query(func.avg(PublishedPostRecord.pred_engagement_rate)).scalar() or 0.0
        total_llm_cost = session.query(func.sum(LlmCallRecord.cost_usd)).scalar() or 0.0
        total_api_cost = sum(v for v in api_cost_map.values())

    return {
        "posts_over_time": posts_over_time,
        "cost_over_time": cost_over_time,
        "platform_over_time": platform_over_time,
        "engagement_data": engagement_data,
        "platform_performance": platform_performance,
        "top_posts": top_posts,
        "totals": {
            "total_posts": total_posts,
            "avg_qa": round(float(avg_qa), 2),
            "avg_pred_er": round(float(avg_pred_er), 4),
            "total_cost": round(float(total_llm_cost) + total_api_cost, 4),
        },
    }
