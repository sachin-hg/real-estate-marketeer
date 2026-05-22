"""
Direct pipeline — for Slack-triggered runs.

Two parallel topic agents convert the user's raw topic into research + trends,
then the pipeline is identical to the normal graph from planner onward.

Topology:
  START → topic_researcher ──────────────┐
                                          ├──► planner → social_creative ──┐
  START → topic_trend_researcher ────────┘          └──► news_creative ───┴──► internal_retriever
                                                                                     │
                                                                       platform_agents → qa_agent → publisher → END
"""
from __future__ import annotations

import asyncio
import logging
from typing import Literal, Optional

from langgraph.graph import END, START, StateGraph
from langgraph.types import RetryPolicy

from agents.topic_researcher import topic_researcher_node
from agents.topic_trend_researcher import topic_trend_researcher_node
from agents.planner import planner_node
from agents.social_creative_agent import social_creative_node
from agents.news_creative_agent import news_creative_node
from agents.platform_orchestrator import platform_agents_node
from agents.internal_link_agent import run_internal_link_agent as retriever_node
from agents.qa_agent import qa_node
from agents.publisher import publisher_node
from models.state import WorkflowState
from workflow.graph import notify_node, route_after_qa   # reuse from main graph
from config import get_settings

logger = logging.getLogger(__name__)

# Lazy-initialized async graph singleton (with checkpointer)
_direct_graph_singleton: Optional[object] = None
_direct_graph_lock = asyncio.Lock()


def _build_direct_builder() -> StateGraph:
    """Return an uncompiled direct graph builder."""
    builder = StateGraph(WorkflowState)

    _api_retry = RetryPolicy(max_attempts=3, initial_interval=1.0, backoff_factor=2.0)

    builder.add_node("topic_researcher",       topic_researcher_node,       retry=_api_retry)
    builder.add_node("topic_trend_researcher", topic_trend_researcher_node, retry=_api_retry)
    builder.add_node("planner",               planner_node,                retry=_api_retry)
    builder.add_node("social_creative",       social_creative_node,        retry=_api_retry)
    builder.add_node("news_creative",         news_creative_node,          retry=_api_retry)
    builder.add_node("internal_retriever",    retriever_node,              retry=_api_retry)
    builder.add_node("platform_agents",       platform_agents_node,        retry=_api_retry)
    builder.add_node("qa_agent",              qa_node,                     retry=_api_retry)
    builder.add_node("publisher",             publisher_node)   # no retry — would double-post
    builder.add_node("notifier",              notify_node)      # no retry — duplicate Slack msgs

    # Parallel topic research → planner fan-in
    builder.add_edge(START,                    "topic_researcher")
    builder.add_edge(START,                    "topic_trend_researcher")
    builder.add_edge("topic_researcher",       "planner")
    builder.add_edge("topic_trend_researcher", "planner")
    # Planner → parallel creative nodes
    builder.add_edge("planner",         "social_creative")
    builder.add_edge("planner",         "news_creative")
    # Creative fan-in at internal_retriever
    builder.add_edge("social_creative", "internal_retriever")
    builder.add_edge("news_creative",   "internal_retriever")
    builder.add_edge("internal_retriever", "platform_agents")
    builder.add_edge("platform_agents",    "qa_agent")

    builder.add_conditional_edges(
        "qa_agent",
        route_after_qa,
        {"publisher": "publisher", "end_no_posts": "notifier"},
    )

    builder.add_edge("publisher", "notifier")
    builder.add_edge("notifier",  END)

    return builder


def build_direct_graph():
    """Sync build — no checkpointer. Used for tests and backward compatibility."""
    return _build_direct_builder().compile()


async def get_direct_graph():
    """Async singleton — lazily creates AsyncSqliteSaver checkpointer on first call."""
    global _direct_graph_singleton
    if _direct_graph_singleton is not None:
        return _direct_graph_singleton

    async with _direct_graph_lock:
        if _direct_graph_singleton is not None:
            return _direct_graph_singleton

        settings = get_settings()
        checkpointer = None
        if settings.enable_checkpointing:
            import aiosqlite
            from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
            conn = await aiosqlite.connect(settings.checkpoint_db_path)
            checkpointer = AsyncSqliteSaver(conn)
            logger.info("Direct graph checkpointing enabled: %s", settings.checkpoint_db_path)

        _direct_graph_singleton = _build_direct_builder().compile(checkpointer=checkpointer)
        return _direct_graph_singleton


# Sync-compiled graph (no checkpointer) — kept for import compatibility
direct_graph = build_direct_graph()
