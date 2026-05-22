"""Module 3 Tests — run: python -m pytest tests.py -v"""
import pytest, json
from unittest.mock import MagicMock

def make_mock_client():
    client = MagicMock()
    resp = MagicMock()
    resp.stop_reason = "end_turn"
    text_block = MagicMock()
    text_block.type = "text"
    text_block.text = json.dumps([{"title": "Test", "content": "Data", "url": "https://example.com"}])
    resp.content = [text_block]
    client.messages.create.return_value = resp
    return client

def test_researcher_accepts_state_dict():
    from solution import researcher_node, PipelineState
    import solution; solution.client = make_mock_client()
    state: PipelineState = {"topic": "Mumbai RE", "research": [], "content_briefs": []}
    result = researcher_node(state)
    assert isinstance(result, dict), "Must return a dict"
    assert "research" in result, "Must return {'research': ...}"

def test_researcher_returns_partial_update():
    from solution import researcher_node, PipelineState
    import solution; solution.client = make_mock_client()
    state: PipelineState = {"topic": "Mumbai RE", "research": [], "content_briefs": []}
    result = researcher_node(state)
    assert set(result.keys()) == {"research"}, f"Expected only 'research' key, got {set(result.keys())}"

def test_pipeline_state_has_correct_fields():
    from solution import PipelineState
    import typing
    hints = typing.get_type_hints(PipelineState)
    assert "topic" in hints
    assert "research" in hints
    assert "content_briefs" in hints

def test_state_composition():
    from solution import researcher_node, planner_node, PipelineState
    import solution; solution.client = make_mock_client()
    state: PipelineState = {"topic": "Mumbai RE", "research": [], "content_briefs": []}
    state.update(researcher_node(state))
    state.update(planner_node(state))
    assert len(state["research"]) > 0
    assert len(state["content_briefs"]) > 0
