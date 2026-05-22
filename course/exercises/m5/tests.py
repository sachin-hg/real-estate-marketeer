"""Module 5 Tests — run: python -m pytest tests.py -v"""
import pytest, asyncio, json
from unittest.mock import MagicMock

def test_graph_has_both_research_nodes():
    from solution import graph
    node_names = set(graph.get_graph().nodes.keys())
    assert "researcher" in node_names
    assert "trend_researcher" in node_names

def test_both_nodes_connect_to_start():
    from solution import graph
    g = graph.get_graph()
    edges = [(e.source, e.target) for e in g.edges]
    has_researcher_start = any(src == "__start__" and tgt == "researcher" for src, tgt in edges)
    has_trend_start = any(src == "__start__" and tgt == "trend_researcher" for src, tgt in edges)
    assert has_researcher_start, "researcher must have an edge from START"
    assert has_trend_start, "trend_researcher must have an edge from START (parallel fan-out)"

def test_planner_receives_both_outputs():
    from solution import graph, PipelineState
    initial: PipelineState = {"topic": "Mumbai RE", "research": [], "trends": [],
                               "content_briefs": [], "creative_drafts": []}
    result = asyncio.run(graph.ainvoke(initial))
    assert result["content_briefs"][0]["research_count"] > 0, "planner must receive research data"
    assert result["content_briefs"][0]["trend_count"] > 0, "planner must receive trend data"

def test_creative_drafts_has_reducer():
    from solution import PipelineState
    import typing
    hints = typing.get_type_hints(PipelineState, include_extras=True)
    creative_type = str(hints.get("creative_drafts", ""))
    assert "Annotated" in creative_type or "add" in creative_type, \
        "creative_drafts must use Annotated[list[dict], operator.add] reducer"
