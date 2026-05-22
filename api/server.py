"""
FastAPI server.
Endpoints:
  POST /run          — trigger a content run (async, returns run_id)
  GET  /runs/{id}    — get run status and results
  GET  /api/runs     — list all runs (newest first, limit 50)
  POST /api/runs/direct — trigger a direct run with slack_topic
  POST /slack/action — Slack interactive button handler (kill-switch)
  GET  /api/posts/*  — post CRUD + feedback (see api/routes/posts.py)
  GET  /api/prompts/* — hooks_bank.json CRUD (see api/routes/prompts.py)
  GET  /api/trends/* — live trends + search (see api/routes/trends.py)
  GET  /api/settings/* — .env viewer/editor (see api/routes/settings.py)
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

import logging as _logging


def _utc_iso(dt: datetime | None) -> str | None:
    """Serialize a datetime to ISO-8601 with explicit UTC offset.
    DB-stored datetimes are naive (no tzinfo) but are always UTC — tag them."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()

from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional

from config import get_settings
from workflow.graph import get_graph

logger = logging.getLogger(__name__)
app = FastAPI(title="Housing.com Content Agent", version="1.0.0")

# Register API routers
from api.routes.posts import router as posts_router
from api.routes.prompts import router as prompts_router
from api.routes.trends import router as trends_router
from api.routes.settings import router as settings_router
from api.routes.analytics import router as analytics_router

app.include_router(posts_router)
app.include_router(prompts_router)
app.include_router(trends_router)
app.include_router(settings_router)
app.include_router(analytics_router)

# In-memory run registry (upgrade to Redis/DB for production)
_runs: dict[str, dict] = {}
_RUNS_MAX = 200


def _register_run(run_id: str, data: dict) -> None:
    """Store run and evict oldest entries beyond _RUNS_MAX to prevent unbounded growth."""
    _runs[run_id] = data
    if len(_runs) > _RUNS_MAX:
        oldest = next(iter(_runs))
        del _runs[oldest]


# ── Per-run event capture ────────────────────────────────────────────────────
_run_events: dict[str, list[dict]] = {}


class _RunLogHandler(_logging.Handler):
    """Captures INFO+ log records into the in-memory run event store."""

    def __init__(self, run_id: str) -> None:
        super().__init__()
        self.run_id = run_id
        self.setFormatter(_logging.Formatter("%(name)s: %(message)s"))

    def emit(self, record: _logging.LogRecord) -> None:
        try:
            events = _run_events.setdefault(self.run_id, [])
            events.append({
                "ts": record.created,
                "level": record.levelname,
                "logger": record.name.split(".")[-1],
                "msg": self.format(record),
            })
            if len(events) > 500:
                del events[0]
        except Exception:
            pass


def _attach_log_handler(run_id: str) -> _RunLogHandler:
    handler = _RunLogHandler(run_id)
    handler.setLevel(_logging.INFO)
    _logging.getLogger().addHandler(handler)
    return handler


def _detach_log_handler(handler: _RunLogHandler) -> None:
    _logging.getLogger().removeHandler(handler)


class RunRequest(BaseModel):
    dry_run: Optional[bool] = None            # overrides .env setting
    topic_hint: Optional[str] = None
    target_platforms: Optional[list[str]] = None


@app.post("/run")
async def trigger_run(req: RunRequest, background_tasks: BackgroundTasks):
    settings = get_settings()
    run_id = str(uuid.uuid4())[:8]

    initial_state = {
        "run_id": run_id,
        "triggered_at": datetime.now(timezone.utc).isoformat(),
        "dry_run": req.dry_run if req.dry_run is not None else settings.dry_run,
        "topic_hint": req.topic_hint,
        "slack_topic": None,
        "target_platforms": req.target_platforms or settings.platform_list,
        "research": [],
        "trends": [],
        "content_briefs": [],
        "creative_drafts": [],
        "platform_posts": [],
        "qa_results": [],
        "approved_posts": [],
        "published": [],
        "retry_count": 0,
        "qa_post_attempts": {},
        "error": None,
    }
    _register_run(run_id, {"status": "running", "state": initial_state})

    background_tasks.add_task(_execute_run, run_id, initial_state)
    return {"run_id": run_id, "status": "started"}


@app.get("/runs/{run_id}")
async def get_run(run_id: str):
    run = _runs.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    state = run.get("state", {})
    return {
        "run_id": run_id,
        "status": run["status"],
        "research_count": len(state.get("research", [])),
        "trends_count": len(state.get("trends", [])),
        "drafts_count": len(state.get("creative_drafts", [])),
        "posts_approved": len(state.get("approved_posts", [])),
        "published": state.get("published", []),
        "error": state.get("error"),
    }


def _get_run_from_db(run_id: str) -> dict | None:
    """Load a completed run from the DB (for CLI runs not in memory)."""
    try:
        from db.connection import get_db_session
        from db.models import RunRecord
        with get_db_session() as session:
            rec = session.query(RunRecord).filter_by(run_id=run_id).first()
            if not rec:
                return None
            summary = json.loads(rec.summary_json or "{}") if rec.summary_json else {}
            events = _build_synthetic_events(run_id)
            return {
                "run_id": run_id,
                "status": rec.status or "completed",
                "triggered_at": _utc_iso(rec.triggered_at),
                "dry_run": rec.dry_run,
                "topic_hint": rec.topic_hint,
                "research_count": rec.research_count or 0,
                "trends_count": rec.trends_count or 0,
                "briefs_count": rec.briefs_count or 0,
                "drafts_count": rec.drafts_count or 0,
                "platform_posts_count": rec.posts_attempted or 0,
                "posts_approved": rec.posts_approved or 0,
                "published": summary.get("published", []),
                "error": rec.error,
                "events": events,
                "research": summary.get("research", []),
                "trends": summary.get("trends", []),
                "content_briefs": summary.get("content_briefs", []),
                "creative_drafts": summary.get("creative_drafts", []),
            }
    except Exception as exc:
        logger.warning("DB run lookup failed for %s: %s", run_id, exc)
        return None


def _build_synthetic_events(run_id: str) -> list[dict]:
    """Build a synthetic event log from api_calls + llm_calls tables for past runs."""
    events = []
    try:
        from db.connection import get_db_session
        from db.models import ApiCallRecord, LlmCallRecord
        with get_db_session() as session:
            for r in session.query(ApiCallRecord).filter_by(run_id=run_id).all():
                if not r.called_at:
                    continue
                ts = r.called_at.replace(tzinfo=timezone.utc).timestamp() if r.called_at.tzinfo is None else r.called_at.timestamp()
                msg = f"API [{r.api_name}] {r.endpoint or ''}[:60] → {r.result_count or 0} results in {r.elapsed_ms or 0}ms"
                if r.use_case:
                    msg += f" | {r.use_case[:60]}"
                events.append({"ts": ts, "level": "INFO" if r.status == "ok" else "WARNING",
                                "logger": r.agent or "api", "msg": msg})
            for r in session.query(LlmCallRecord).filter_by(run_id=run_id).all():
                if not r.called_at:
                    continue
                ts = r.called_at.replace(tzinfo=timezone.utc).timestamp() if r.called_at.tzinfo is None else r.called_at.timestamp()
                cost = f" cost=${r.cost_usd:.4f}" if r.cost_usd else ""
                msg = f"LLM [{r.agent}] model={r.model} in={r.input_tokens} out={r.output_tokens}{cost} {r.elapsed_ms or 0}ms"
                events.append({"ts": ts, "level": "INFO", "logger": r.agent or "llm", "msg": msg})
    except Exception as exc:
        logger.debug("_build_synthetic_events failed for %s: %s", run_id, exc)
    events.sort(key=lambda e: e["ts"])
    return events


@app.get("/api/runs/{run_id}")
async def get_run_detail(run_id: str):
    """Full run detail with events log — used by RunDetail page."""
    run = _runs.get(run_id)

    if not run:
        db_run = _get_run_from_db(run_id)
        if db_run:
            return db_run
        raise HTTPException(status_code=404, detail="Run not found")

    state = run.get("state", {})
    events = _run_events.get(run_id, [])

    research_items = [
        {"headline": r.get("headline", ""), "source": r.get("source", ""),
         "url": r.get("url", ""), "summary": r.get("summary", ""), "relevance": r.get("relevance", "")}
        for r in state.get("research", [])
    ]
    trend_items = [
        {"hashtag": t.get("hashtag", ""), "platform": t.get("platform", ""),
         "volume": t.get("volume", ""), "context": t.get("context", ""),
         "creative_hook": t.get("creative_hook", ""), "city_hint": t.get("city_hint"),
         "tags": t.get("tags", [])}
        for t in state.get("trends", [])
    ]
    brief_items = [
        {"topic": b.get("topic", ""), "angle": b.get("angle", ""), "draft_type": b.get("draft_type", ""),
         "target_platforms": b.get("target_platforms", []), "tone": b.get("tone", ""),
         "urgency": b.get("urgency", ""), "source_summary": b.get("source_summary", ""),
         "city_hint": b.get("city_hint"), "seo_keywords": b.get("seo_keywords", [])}
        for b in state.get("content_briefs", [])
    ]
    draft_items = [
        {"id": d.get("id", ""), "draft_type": d.get("draft_type", ""), "angle": d.get("angle", ""),
         "hook": d.get("hook", ""), "headline": d.get("headline", ""), "hashtags": d.get("hashtags", []),
         "trend_hashtag": d.get("trend_hashtag", ""), "target_platforms": d.get("target_platforms", []),
         "media_format": d.get("media_format", "")}
        for d in state.get("creative_drafts", [])
    ]

    return {
        "run_id": run_id,
        "status": run["status"],
        "triggered_at": state.get("triggered_at"),
        "dry_run": state.get("dry_run"),
        "topic_hint": state.get("topic_hint") or state.get("slack_topic"),
        "research_count": len(research_items),
        "trends_count": len(trend_items),
        "briefs_count": len(brief_items),
        "drafts_count": len(draft_items),
        "platform_posts_count": len(state.get("platform_posts", [])),
        "posts_approved": len(state.get("approved_posts", [])),
        "published": state.get("published", []),
        "error": state.get("error"),
        "events": events[-200:],
        "research": research_items,
        "trends": trend_items,
        "content_briefs": brief_items,
        "creative_drafts": draft_items,
    }


@app.post("/slack/action")
async def slack_action(request: Request):
    """Handle Slack interactive button presses (approve/reject/kill-switch)."""
    body = await request.body()
    try:
        import urllib.parse
        decoded = urllib.parse.unquote_plus(body.decode())
        if decoded.startswith("payload="):
            decoded = decoded[len("payload="):]
        payload = json.loads(decoded)
    except Exception:
        return JSONResponse({"ok": False}, status_code=400)

    action = payload.get("actions", [{}])[0]
    action_id = action.get("action_id", "")
    value = action.get("value", "")

    # Legacy kill-switch
    if value == "takedown":
        run_id = action.get("block_id", "").replace("killswitch_", "")
        logger.warning("Kill-switch triggered for run %s", run_id)
        _runs.get(run_id, {})["status"] = "taken_down"
        return {"text": f"Takedown requested for run {run_id}. Manual deletion required for live posts."}

    # Approve / reject buttons from post thread messages
    if action_id in ("approve_post", "reject_post") and value:
        parts = value.split("_", 1)
        if len(parts) == 2:
            user_action, post_id = parts[0], parts[1]
            await _update_post_user_action(post_id, user_action)
            actor = payload.get("user", {}).get("name", "someone")
            emoji = ":white_check_mark:" if user_action == "approve" else ":x:"
            return JSONResponse({"text": f"{emoji} {actor} marked post as *{user_action}d*"})

    return {"ok": True}


async def _update_post_user_action(post_id: str, action: str) -> None:
    """Persist user approve/reject action to DB."""
    try:
        from db.connection import get_db_session
        from db.models import PublishedPostRecord
        with get_db_session() as session:
            record = session.query(PublishedPostRecord).filter_by(post_id=post_id).first()
            if record:
                record.user_action = action + "d"   # "approved" | "rejected"
                session.commit()
                logger.info("Slack action: post %s marked %sd", post_id[:8], action)
            else:
                logger.warning("Slack action: post %s not found in DB", post_id[:8])
    except Exception as exc:
        logger.error("Failed to update user_action for post %s: %s", post_id[:8], exc)


@app.post("/slack/events")
async def slack_events(request: Request, background_tasks: BackgroundTasks):
    """
    Slack Events API HTTP endpoint (alternative to Socket Mode).

    Handles:
      - URL verification challenge (one-time setup)
      - app_mention and message events (direct messages)

    Requires SLACK_SIGNING_SECRET in .env for request verification.
    For local dev without a public URL, use Socket Mode instead:
      python main.py slack-bot
    """
    settings = get_settings()
    body_bytes = await request.body()

    # Verify the request signature to prevent spoofing
    if settings.slack_signing_secret:
        import hashlib, hmac, time
        ts  = request.headers.get("X-Slack-Request-Timestamp", "")
        sig = request.headers.get("X-Slack-Signature", "")
        if abs(time.time() - float(ts or 0)) > 300:
            return JSONResponse({"error": "Request too old"}, status_code=403)
        base  = f"v0:{ts}:{body_bytes.decode()}"
        computed = "v0=" + hmac.new(
            settings.slack_signing_secret.encode(),
            base.encode(),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(computed, sig):
            return JSONResponse({"error": "Invalid signature"}, status_code=403)

    try:
        payload = json.loads(body_bytes)
    except Exception:
        return JSONResponse({"error": "Bad JSON"}, status_code=400)

    # One-time URL verification challenge from Slack
    if payload.get("type") == "url_verification":
        return JSONResponse({"challenge": payload["challenge"]})

    event = payload.get("event", {})
    etype = event.get("type")

    # Ignore bot messages and non-DM/mention events
    if event.get("bot_id") or event.get("subtype"):
        return {"ok": True}
    if etype not in ("app_mention", "message"):
        return {"ok": True}
    if etype == "message" and event.get("channel_type") != "im":
        return {"ok": True}

    import re
    text     = re.sub(r"<@[A-Z0-9]+>", "", event.get("text", "")).strip()
    channel  = event.get("channel")
    thread   = event.get("thread_ts") or event.get("ts")
    run_id   = str(uuid.uuid4())[:8]

    if not text:
        return {"ok": True}

    # Acknowledge immediately (Slack requires response < 3s)
    background_tasks.add_task(
        _run_slack_pipeline, run_id, text, channel, thread, settings
    )
    return {"ok": True}


async def _run_slack_pipeline(
    run_id: str, topic: str, channel: str, thread_ts: str, settings
) -> None:
    """Run the direct pipeline and post results back to Slack."""
    from slack_sdk.web.async_client import AsyncWebClient
    from workflow.direct_graph import get_direct_graph
    from tools.slack_bot import _format_results, _collect_image_paths

    client = AsyncWebClient(token=settings.slack_bot_token)

    try:
        # Acknowledgement reply
        ack = await client.chat_postMessage(
            channel=channel,
            thread_ts=thread_ts,
            text=f":hourglass_flowing_sand: On it! Creating posts for: *{topic[:80]}*\nRun `{run_id}` — ~60 seconds.",
        )
        reply_ts = (ack.get("ts") or thread_ts) if isinstance(ack, dict) else thread_ts

        initial = {
            "run_id": run_id,
            "triggered_at": datetime.now(timezone.utc).isoformat(),
            "dry_run": settings.dry_run,
            "slack_topic": topic,
            "topic_hint": topic,
            "target_platforms": settings.platform_list,
            "research": [], "trends": [], "content_briefs": [], "creative_drafts": [],
            "platform_posts": [], "qa_results": [], "approved_posts": [],
            "published": [], "retry_count": 0, "qa_post_attempts": {}, "error": None,
        }
        _register_run(run_id, {"status": "running", "state": initial})
        _handler = _attach_log_handler(run_id)
        try:
            dg = await get_direct_graph()
            final_state = await dg.ainvoke(initial, config={"configurable": {"thread_id": run_id}})
            _runs[run_id] = {"status": "completed", "state": final_state}
        finally:
            _detach_log_handler(_handler)

        fallback, blocks = _format_results(final_state)
        await client.chat_postMessage(
            channel=channel, thread_ts=reply_ts,
            text=fallback, blocks=blocks,
        )

        from pathlib import Path
        for img_path in _collect_image_paths(final_state):
            try:
                await client.files_upload_v2(
                    channel=channel, thread_ts=reply_ts,
                    file=str(img_path), filename=img_path.name,
                    title=f"Card — {img_path.stem}",
                )
            except Exception as img_exc:
                logger.warning("Image upload failed %s: %s", img_path, img_exc)

    except Exception as exc:
        logger.error("Slack HTTP pipeline failed run %s: %s", run_id, exc, exc_info=True)
        try:
            await client.chat_postMessage(
                channel=channel, thread_ts=thread_ts,
                text=f":warning: Run `{run_id}` failed: `{exc}`",
            )
        except Exception:
            pass


@app.get("/api/runs")
async def list_runs():
    """List all runs, newest first, limit 50. Merges in-memory (web) + DB (CLI) runs."""
    items = []
    seen_ids: set[str] = set()

    # In-memory runs first (most recent web-triggered)
    for run_id, run_data in reversed(list(_runs.items())):
        state = run_data.get("state", {})
        items.append({
            "run_id": run_id,
            "status": run_data["status"],
            "triggered_at": state.get("triggered_at"),
            "research_count": len(state.get("research", [])),
            "trends_count": len(state.get("trends", [])),
            "drafts_count": len(state.get("creative_drafts", [])),
            "posts_approved": len(state.get("approved_posts", [])),
            "published_count": len(state.get("published", [])),
            "error": state.get("error"),
        })
        seen_ids.add(run_id)

    # DB runs (CLI-triggered or evicted from memory)
    try:
        from db.connection import get_db_session
        from db.models import RunRecord
        with get_db_session() as session:
            db_rows = (
                session.query(RunRecord)
                .order_by(RunRecord.triggered_at.desc())
                .limit(50)
                .all()
            )
            for rec in db_rows:
                if rec.run_id in seen_ids:
                    continue
                items.append({
                    "run_id": rec.run_id,
                    "status": rec.status or "completed",
                    "triggered_at": _utc_iso(rec.triggered_at),
                    "research_count": rec.research_count or 0,
                    "trends_count": rec.trends_count or 0,
                    "drafts_count": rec.drafts_count or 0,
                    "posts_approved": rec.posts_approved or 0,
                    "published_count": rec.posts_published or 0,
                    "error": rec.error,
                })
    except Exception as exc:
        logger.warning("DB run list failed: %s", exc)

    items.sort(key=lambda r: r.get("triggered_at") or "", reverse=True)
    return items[:50]


@app.get("/api/runs/{run_id}/calls")
async def get_run_calls(run_id: str):
    """Return all API + LLM calls for a run. Used by RunDetail debug section."""

    _API_COST_PER_CALL: dict[str, float] = {
        "tavily": 0.005, "serpapi": 0.010, "apify": 0.005,
        "rapidapi_twitter_trends": 0.001,
    }

    try:
        from db.connection import get_db_session
        from db.models import ApiCallRecord, LlmCallRecord

        with get_db_session() as session:
            api_rows = (
                session.query(ApiCallRecord).filter_by(run_id=run_id)
                .order_by(ApiCallRecord.called_at).all()
            )

            def _parse_response_preview(raw_json):
                if not raw_json:
                    return None, 0
                try:
                    parsed = json.loads(raw_json)
                    if isinstance(parsed, list):
                        return parsed[:5], len(parsed)
                    if isinstance(parsed, dict):
                        for key in ("results", "data", "items", "articles", "videos"):
                            if isinstance(parsed.get(key), list):
                                inner = parsed[key]
                                return {**parsed, key: inner[:5]}, len(inner)
                        return parsed, 0
                    return parsed, 0
                except Exception:
                    return raw_json[:500] if raw_json else None, 0

            api_calls = []
            for r in api_rows:
                preview, total_items = _parse_response_preview(r.response_json)
                api_calls.append({
                    "type": "api",
                    "called_at": _utc_iso(r.called_at),
                    "agent": r.agent,
                    "api_name": r.api_name,
                    "endpoint": r.endpoint,
                    "params": json.loads(r.params_json or "{}"),
                    "response_preview": preview,
                    "total_response_items": total_items,
                    "result_count": r.result_count,
                    "status": r.status,
                    "http_status": r.http_status,
                    "error": r.error,
                    "elapsed_ms": r.elapsed_ms,
                    "use_case": r.use_case,
                    "estimated_cost_usd": _API_COST_PER_CALL.get(r.api_name or "", 0.0),
                })

            llm_rows = (
                session.query(LlmCallRecord).filter_by(run_id=run_id)
                .order_by(LlmCallRecord.called_at).all()
            )
            _agent_seen: dict[str, int] = {}
            llm_calls = []
            for r in llm_rows:
                agent = r.agent or ""
                _agent_seen[agent] = _agent_seen.get(agent, 0) + 1
                llm_calls.append({
                    "type": "llm",
                    "called_at": _utc_iso(r.called_at),
                    "agent": agent,
                    "model": r.model,
                    "stop_reason": r.stop_reason,
                    "input_tokens": r.input_tokens,
                    "output_tokens": r.output_tokens,
                    "cost_usd": r.cost_usd,
                    "elapsed_ms": r.elapsed_ms,
                    "attempt": _agent_seen[agent],
                    "system_prompt": r.system_prompt or "",
                    "user_message": r.user_message or "",
                    "response_text": r.response_text or "",
                })

        total_api_cost = sum(c["estimated_cost_usd"] for c in api_calls)
        total_llm_cost = sum(c.get("cost_usd") or 0 for c in llm_calls)
        return {
            "run_id": run_id,
            "api_calls": api_calls,
            "llm_calls": llm_calls,
            "total_api_calls": len(api_calls),
            "total_llm_calls": len(llm_calls),
            "total_api_cost_usd": round(total_api_cost, 6),
            "total_llm_cost_usd": round(total_llm_cost, 6),
        }
    except Exception as exc:
        logger.warning("get_run_calls failed for %s: %s", run_id, exc)
        return {"run_id": run_id, "api_calls": [], "llm_calls": [],
                "total_api_calls": 0, "total_llm_calls": 0}


class DirectRunRequest(BaseModel):
    slack_topic: str
    dry_run: Optional[bool] = None
    target_platforms: Optional[list[str]] = None


@app.post("/api/runs/direct")
async def trigger_direct_run(req: DirectRunRequest, background_tasks: BackgroundTasks):
    """Trigger a direct (topic-focused) run using direct_graph."""
    from workflow.direct_graph import get_direct_graph

    settings = get_settings()
    run_id = str(uuid.uuid4())[:8]

    initial_state = {
        "run_id": run_id,
        "triggered_at": datetime.now(timezone.utc).isoformat(),
        "dry_run": req.dry_run if req.dry_run is not None else settings.dry_run,
        "slack_topic": req.slack_topic,
        "topic_hint": req.slack_topic,
        "target_platforms": req.target_platforms or settings.platform_list,
        "research": [],
        "trends": [],
        "content_briefs": [],
        "creative_drafts": [],
        "platform_posts": [],
        "qa_results": [],
        "approved_posts": [],
        "published": [],
        "retry_count": 0,
        "qa_post_attempts": {},
        "error": None,
    }
    _register_run(run_id, {"status": "running", "state": initial_state})

    async def _execute_direct(run_id: str, state: dict):
        _handler = _attach_log_handler(run_id)
        try:
            dg = await get_direct_graph()
            final = await dg.ainvoke(state, config={"configurable": {"thread_id": run_id}})
            _runs[run_id] = {"status": "completed", "state": final}
        except Exception as exc:
            logger.error("Direct run %s failed: %s", run_id, exc, exc_info=True)
            _runs[run_id] = {"status": "failed", "state": {**state, "error": str(exc)}}
        finally:
            _detach_log_handler(_handler)

    background_tasks.add_task(_execute_direct, run_id, initial_state)
    return {"run_id": run_id, "status": "started"}


@app.get("/health")
async def health():
    return {"status": "ok"}


async def _execute_run(run_id: str, initial_state: dict):
    from tools.run_context import set_run_id as _set_run_id
    from tools.run_logger import setup_run_logging
    _set_run_id(run_id)        # propagate run_id to all tools via ContextVar
    setup_run_logging(run_id)  # per-run file log at output/<run_id>/run.log
    _handler = _attach_log_handler(run_id)
    try:
        g = await get_graph()
        final_state = await g.ainvoke(initial_state, config={"configurable": {"thread_id": run_id}})
        _runs[run_id] = {"status": "completed", "state": final_state}
        logger.info("Run %s completed", run_id)
    except Exception as exc:
        logger.error("Run %s failed: %s", run_id, exc, exc_info=True)
        _runs[run_id] = {"status": "failed", "state": {**initial_state, "error": str(exc)}}
    finally:
        _detach_log_handler(_handler)


# Serve the compiled React SPA — static assets get exact file matches,
# all other paths fall back to index.html so React Router handles navigation.
from fastapi.responses import FileResponse as _FileResponse

# Serve generated media (images, markdown outputs) from the output/ directory
_output_dir = Path(__file__).parent.parent / "output"
_output_dir.mkdir(exist_ok=True)
app.mount("/output", StaticFiles(directory=str(_output_dir)), name="output")

_ui_dist = Path(__file__).parent.parent / "ui" / "dist"
if _ui_dist.exists():
    _assets_dir = _ui_dist / "assets"
    if _assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_assets_dir)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        candidate = _ui_dist / full_path
        if candidate.is_file():
            return _FileResponse(str(candidate))
        return _FileResponse(str(_ui_dist / "index.html"))
