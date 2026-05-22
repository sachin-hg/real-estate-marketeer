from __future__ import annotations

import asyncio
import logging
from typing import Literal, Optional

from langgraph.graph import END, START, StateGraph
from langgraph.types import RetryPolicy

from agents.researcher import researcher_node
from agents.social_trend_researcher import trend_researcher_node
from agents.planner import planner_node
from agents.social_creative_agent import social_creative_node
from agents.news_creative_agent import news_creative_node
from agents.platform_orchestrator import platform_agents_node
from agents.internal_link_agent import run_internal_link_agent as retriever_node
from agents.qa_agent import qa_node
from agents.publisher import publisher_node
from models.state import WorkflowState
from config import get_settings

logger = logging.getLogger(__name__)

# Lazy-initialized async graph singleton (with checkpointer)
_graph_singleton: Optional[object] = None
_graph_lock = asyncio.Lock()


async def notify_node(state: WorkflowState) -> dict:
    """Send Slack summary after publishing — one thread message per platform post."""
    from tools.slack_notifier import post_run_summary, post_error_alert

    if state.get("error"):
        await post_error_alert(state["run_id"], state["error"])
        return {}

    published = state.get("published", [])
    if not published:
        qa_results = state.get("qa_results", [])
        reasons = "; ".join(
            f"{r['platform']}: {r.get('revision_notes') or ', '.join(r.get('safety_violations', []) or r.get('quality_issues', []))}"
            for r in qa_results if r.get("decision") != "publish"
        )[:300]
        await post_error_alert(
            state["run_id"],
            f"All posts rejected by QA — nothing published. Reasons: {reasons or 'see logs'}",
        )
        return {}

    await post_run_summary(state)
    return {}


def route_after_qa(state: WorkflowState) -> Literal["publisher", "end_no_posts"]:
    if state.get("approved_posts"):
        return "publisher"
    logger.warning("QA: all posts rejected for run %s", state["run_id"])
    return "end_no_posts"


def _build_builder() -> StateGraph:
    """Return an uncompiled graph builder — shared by sync and async compilation paths."""
    builder = StateGraph(WorkflowState)

    # Retry policy for nodes that make external API / LLM calls.
    # publisher and notifier are excluded — retrying publish would double-post.
    _api_retry = RetryPolicy(max_attempts=3, initial_interval=1.0, backoff_factor=2.0)

    # ── Nodes ──────────────────────────────────────────────────────────────────
    builder.add_node("researcher",        researcher_node,        retry=_api_retry)
    builder.add_node("trend_researcher",  trend_researcher_node,  retry=_api_retry)
    builder.add_node("planner",           planner_node,           retry=_api_retry)
    builder.add_node("social_creative",   social_creative_node,   retry=_api_retry)
    builder.add_node("news_creative",     news_creative_node,     retry=_api_retry)
    builder.add_node("internal_retriever", retriever_node,        retry=_api_retry)
    builder.add_node("platform_agents",   platform_agents_node,   retry=_api_retry)
    builder.add_node("qa_agent",          qa_node,                retry=_api_retry)
    builder.add_node("publisher",         publisher_node)   # no retry — would double-post
    builder.add_node("notifier",          notify_node)      # no retry — duplicate Slack msgs

    # ── Parallel research → planner fan-in ───────────────────────────────────
    builder.add_edge(START, "researcher")
    builder.add_edge(START, "trend_researcher")
    builder.add_edge("researcher",       "planner")
    builder.add_edge("trend_researcher", "planner")

    # ── Planner → parallel creative nodes ────────────────────────────────────
    builder.add_edge("planner", "social_creative")
    builder.add_edge("planner", "news_creative")

    # ── Creative fan-in at internal_retriever ─────────────────────────────────
    builder.add_edge("social_creative", "internal_retriever")
    builder.add_edge("news_creative",   "internal_retriever")

    # ── Sequential pipeline ───────────────────────────────────────────────────
    builder.add_edge("internal_retriever", "platform_agents")
    builder.add_edge("platform_agents", "qa_agent")

    # ── QA routing ────────────────────────────────────────────────────────────
    builder.add_conditional_edges(
        "qa_agent",
        route_after_qa,
        {"publisher": "publisher", "end_no_posts": "notifier"},
    )

    builder.add_edge("publisher", "notifier")
    builder.add_edge("notifier", END)

    return builder


def build_graph():
    """Sync build — no checkpointer. Used for tests and backward compatibility."""
    return _build_builder().compile()


async def get_graph():
    """Async singleton — lazily creates AsyncSqliteSaver checkpointer on first call.

    Uses a lock so concurrent startup calls don't each open their own DB connection.
    """
    global _graph_singleton
    if _graph_singleton is not None:
        return _graph_singleton

    async with _graph_lock:
        # Double-check after acquiring the lock
        if _graph_singleton is not None:
            return _graph_singleton

        settings = get_settings()
        checkpointer = None
        if settings.enable_checkpointing:
            import aiosqlite
            from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
            conn = await aiosqlite.connect(settings.checkpoint_db_path)
            checkpointer = AsyncSqliteSaver(conn)
            logger.info("Checkpointing enabled: %s", settings.checkpoint_db_path)

        _graph_singleton = _build_builder().compile(checkpointer=checkpointer)
        return _graph_singleton


# Sync-compiled graph (no checkpointer) — kept for import compatibility
graph = build_graph()
