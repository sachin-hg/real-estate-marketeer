from __future__ import annotations

import logging
from typing import Literal

from langgraph.graph import END, START, StateGraph
from langgraph.pregel import RetryPolicy

from agents.researcher import researcher_node
from agents.social_trend_researcher import trend_researcher_node
from agents.creative_marketeer import creative_node
from agents.platform_orchestrator import platform_agents_node
from agents.internal_link_agent import run_internal_link_agent as retriever_node
from agents.qa_agent import qa_node
from agents.publisher import publisher_node
from models.state import WorkflowState

logger = logging.getLogger(__name__)


def notify_node(state: WorkflowState) -> dict:
    """Send Slack summary after publishing (non-blocking)."""
    from tools.slack_notifier import post_publish_summary, post_error_alert

    if state.get("error"):
        post_error_alert(state["run_id"], state["error"])
        return {}

    published = state.get("published", [])
    if not published:
        # All posts were rejected by QA — send an error alert so the team knows
        qa_results = state.get("qa_results", [])
        reasons = "; ".join(
            f"{r['platform']}: {r.get('revision_notes') or ', '.join(r.get('safety_violations', []) or r.get('quality_issues', []))}"
            for r in qa_results if r.get("decision") != "publish"
        )[:300]
        post_error_alert(
            state["run_id"],
            f"All posts rejected by QA — nothing published. Reasons: {reasons or 'see logs'}",
        )
        return {}

    # Build a lookup of approved post content by post_id
    approved_by_id = {p["id"]: p for p in state.get("approved_posts", [])}

    posts_with_qa = []
    for post in published:
        qa = next(
            (q for q in state.get("qa_results", []) if q["post_id"] == post["post_id"]),
            {},
        )
        approved = approved_by_id.get(post["post_id"], {})
        posts_with_qa.append({
            **post,
            "content": approved.get("content", ""),
            "qa": qa,
        })

    post_publish_summary(state["run_id"], posts_with_qa)
    return {}


def route_after_qa(state: WorkflowState) -> Literal["publisher", "end_no_posts"]:
    if state.get("approved_posts"):
        return "publisher"
    logger.warning("QA: all posts rejected for run %s", state["run_id"])
    return "end_no_posts"


def build_graph() -> StateGraph:
    builder = StateGraph(WorkflowState)

    # Retry policy for nodes that make external API / LLM calls.
    # publisher and notifier are excluded — retrying publish would double-post.
    _api_retry = RetryPolicy(max_attempts=3, initial_interval=1.0, backoff_factor=2.0)

    # ── Nodes ──────────────────────────────────────────────────────────────────
    builder.add_node("researcher",        researcher_node,       retry=_api_retry)
    builder.add_node("trend_researcher",  trend_researcher_node, retry=_api_retry)
    builder.add_node("creative_marketeer", creative_node,        retry=_api_retry)
    builder.add_node("internal_retriever", retriever_node,       retry=_api_retry)
    builder.add_node("platform_agents",   platform_agents_node,  retry=_api_retry)
    builder.add_node("qa_agent",          qa_node,               retry=_api_retry)
    builder.add_node("publisher",         publisher_node)   # no retry — would double-post
    builder.add_node("notifier",          notify_node)      # no retry — duplicate Slack msgs

    # ── Parallel research (both start immediately, creative waits for both) ───
    builder.add_edge(START, "researcher")
    builder.add_edge(START, "trend_researcher")
    builder.add_edge("researcher", "creative_marketeer")
    builder.add_edge("trend_researcher", "creative_marketeer")

    # ── Sequential pipeline ───────────────────────────────────────────────────
    builder.add_edge("creative_marketeer", "internal_retriever")
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

    return builder.compile()


# Module-level compiled graph — import and call .ainvoke(state) to run
graph = build_graph()
