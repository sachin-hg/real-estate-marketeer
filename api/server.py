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

from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional

from config import get_settings
from workflow.graph import graph

logger = logging.getLogger(__name__)
app = FastAPI(title="Housing.com Content Agent", version="1.0.0")

# Register API routers
from api.routes.posts import router as posts_router
from api.routes.prompts import router as prompts_router
from api.routes.trends import router as trends_router
from api.routes.settings import router as settings_router

app.include_router(posts_router)
app.include_router(prompts_router)
app.include_router(trends_router)
app.include_router(settings_router)

# In-memory run registry (upgrade to Redis/DB for production)
_runs: dict[str, dict] = {}


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
        "creative_drafts": [],
        "platform_posts": [],
        "qa_results": [],
        "approved_posts": [],
        "published": [],
        "retry_count": 0,
        "qa_post_attempts": {},
        "error": None,
    }
    _runs[run_id] = {"status": "running", "state": initial_state}

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


@app.post("/slack/action")
async def slack_action(request: Request):
    """Handle Slack interactive button presses (kill-switch)."""
    body = await request.body()
    try:
        payload = json.loads(body.decode().replace("payload=", "").strip())
    except Exception:
        return JSONResponse({"ok": False}, status_code=400)

    action = payload.get("actions", [{}])[0]
    if action.get("value") == "takedown":
        run_id = action.get("block_id", "").replace("killswitch_", "")
        logger.warning("Kill-switch triggered for run %s", run_id)
        _runs.get(run_id, {})["status"] = "taken_down"
        return {"text": f"Takedown requested for run {run_id}. Manual deletion required for live posts."}

    return {"ok": True}


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
    from workflow.direct_graph import direct_graph
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
            "research": [], "trends": [], "creative_drafts": [],
            "platform_posts": [], "qa_results": [], "approved_posts": [],
            "published": [], "retry_count": 0, "qa_post_attempts": {}, "error": None,
        }
        _runs[run_id] = {"status": "running", "state": initial}
        final_state = await direct_graph.ainvoke(initial)
        _runs[run_id] = {"status": "completed", "state": final_state}

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
    """List all runs, newest first, limit 50."""
    items = []
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
    return items[:50]


class DirectRunRequest(BaseModel):
    slack_topic: str
    dry_run: Optional[bool] = None
    target_platforms: Optional[list[str]] = None


@app.post("/api/runs/direct")
async def trigger_direct_run(req: DirectRunRequest, background_tasks: BackgroundTasks):
    """Trigger a direct (topic-focused) run using direct_graph."""
    from workflow.direct_graph import direct_graph

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
        "creative_drafts": [],
        "platform_posts": [],
        "qa_results": [],
        "approved_posts": [],
        "published": [],
        "retry_count": 0,
        "qa_post_attempts": {},
        "error": None,
    }
    _runs[run_id] = {"status": "running", "state": initial_state}

    async def _execute_direct(run_id: str, state: dict):
        try:
            final = await direct_graph.ainvoke(state)
            _runs[run_id] = {"status": "completed", "state": final}
        except Exception as exc:
            logger.error("Direct run %s failed: %s", run_id, exc, exc_info=True)
            _runs[run_id] = {"status": "failed", "state": {**state, "error": str(exc)}}

    background_tasks.add_task(_execute_direct, run_id, initial_state)
    return {"run_id": run_id, "status": "started"}


@app.get("/health")
async def health():
    return {"status": "ok"}


async def _execute_run(run_id: str, initial_state: dict):
    try:
        final_state = await graph.ainvoke(initial_state)
        _runs[run_id] = {"status": "completed", "state": final_state}
        logger.info("Run %s completed", run_id)
    except Exception as exc:
        logger.error("Run %s failed: %s", run_id, exc, exc_info=True)
        _runs[run_id] = {"status": "failed", "state": {**initial_state, "error": str(exc)}}


# Mount the compiled React UI (build with: cd ui && npm run build)
_ui_dist = Path(__file__).parent.parent / "ui" / "dist"
if _ui_dist.exists():
    app.mount("/", StaticFiles(directory=str(_ui_dist), html=True), name="ui")
