"""
Direct pipeline — for Slack-triggered runs.

Skips the automated researcher and trend_researcher nodes entirely.
The topic_enricher converts the user's raw topic into synthetic research + trends,
then the rest of the pipeline is identical to the normal graph.

Topology:
  START → topic_enricher → creative_marketeer → internal_retriever
       → platform_agents → qa_agent → publisher → notifier → END
"""
from __future__ import annotations

import logging
from typing import Literal

from langgraph.graph import END, START, StateGraph
from langgraph.pregel import RetryPolicy

from agents.topic_enricher import topic_enricher_node
from agents.creative_marketeer import creative_node
from agents.platform_orchestrator import platform_agents_node
from agents.internal_link_agent import run_internal_link_agent as retriever_node
from agents.qa_agent import qa_node
from agents.publisher import publisher_node
from models.state import WorkflowState
from workflow.graph import notify_node, route_after_qa   # reuse from main graph

logger = logging.getLogger(__name__)


def build_direct_graph() -> StateGraph:
    builder = StateGraph(WorkflowState)

    _api_retry = RetryPolicy(max_attempts=3, initial_interval=1.0, backoff_factor=2.0)

    builder.add_node("topic_enricher",     topic_enricher_node,  retry=_api_retry)
    builder.add_node("creative_marketeer", creative_node,         retry=_api_retry)
    builder.add_node("internal_retriever", retriever_node,        retry=_api_retry)
    builder.add_node("platform_agents",    platform_agents_node,  retry=_api_retry)
    builder.add_node("qa_agent",           qa_node,               retry=_api_retry)
    builder.add_node("publisher",          publisher_node)   # no retry — would double-post
    builder.add_node("notifier",           notify_node)      # no retry — duplicate Slack msgs

    builder.add_edge(START,               "topic_enricher")
    builder.add_edge("topic_enricher",    "creative_marketeer")
    builder.add_edge("creative_marketeer", "internal_retriever")
    builder.add_edge("internal_retriever", "platform_agents")
    builder.add_edge("platform_agents",    "qa_agent")

    builder.add_conditional_edges(
        "qa_agent",
        route_after_qa,
        {"publisher": "publisher", "end_no_posts": "notifier"},
    )

    builder.add_edge("publisher", "notifier")
    builder.add_edge("notifier",  END)

    return builder.compile()


direct_graph = build_direct_graph()
