"""Module 4 Tests — run: python -m pytest tests.py -v"""
import pytest, json
from unittest.mock import MagicMock, patch

def make_mock_client():
    client = MagicMock()
    resp = MagicMock()
    resp.stop_reason = "end_turn"
    text_block = MagicMock(); text_block.type = "text"
    text_block.text = json.dumps([{"title": "Test", "content": "Data", "url": "https://example.com"}])
    resp.content = [text_block]
    client.messages.create.return_value = resp
    return client

def test_graph_is_compiled():
    from solution import graph
    assert graph is not None, "graph must be compiled (not None)"
    assert hasattr(graph, "invoke"), "graph must have an invoke method"

def test_graph_has_researcher_and_planner():
    from solution import graph
    node_names = set(graph.get_graph().nodes.keys())
    assert "researcher" in node_names, "Graph must have a 'researcher' node"
    assert "planner" in node_names, "Graph must have a 'planner' node"

def test_graph_invoke_returns_briefs():
    import solution; solution.client = make_mock_client()
    from solution import graph, PipelineState
    initial: PipelineState = {"topic": "Mumbai RE", "research": [], "content_briefs": []}
    result = graph.invoke(initial)
    assert "content_briefs" in result
    assert len(result["content_briefs"]) > 0

def test_researcher_runs_before_planner():
    import solution; solution.client = make_mock_client()
    from solution import graph, PipelineState
    initial: PipelineState = {"topic": "test topic", "research": [], "content_briefs": []}
    result = graph.invoke(initial)
    # planner uses topic from state — researcher must have run and state must be intact
    assert result["content_briefs"][0]["topic"] == "test topic"
