"""
Module 2 Tests — validates the researcher_agent implementation.
Run: python -m pytest tests.py -v
"""
import json
import pytest
from unittest.mock import MagicMock, patch

# Import student's implementation
from starter import researcher_agent


def make_mock_client(stop_reasons: list) -> MagicMock:
    """Creates a mock Anthropic client that cycles through stop_reasons."""
    client = MagicMock()
    responses = []
    for i, stop_reason in enumerate(stop_reasons):
        resp = MagicMock()
        resp.stop_reason = stop_reason
        if stop_reason == "tool_use":
            tool_block = MagicMock()
            tool_block.type = "tool_use"
            tool_block.id = f"tool_{i}"
            tool_block.name = "web_search"
            tool_block.input = {"query": "test query"}
            resp.content = [tool_block]
        else:  # end_turn
            text_block = MagicMock()
            text_block.type = "text"
            text_block.text = json.dumps([{"title": "Test result", "content": "Test", "url": "https://example.com"}])
            resp.content = [text_block]
        responses.append(resp)
    client.messages.create.side_effect = responses
    return client


def test_loop_executes_tool_call():
    """Agent must call the LLM at least twice when first response is tool_use."""
    mock_client = make_mock_client(["tool_use", "end_turn"])
    researcher_agent("Mumbai real estate", client_=mock_client)
    assert mock_client.messages.create.call_count == 2, \
        "Should call LLM twice: once for tool_use, once after tool result"


def test_returns_list():
    """researcher_agent must return a list."""
    mock_client = make_mock_client(["end_turn"])
    result = researcher_agent("test", client_=mock_client)
    assert isinstance(result, list), f"Expected list, got {type(result)}"


def test_tool_result_appended():
    """After tool_use, the messages sent to the second LLM call must include tool_result."""
    mock_client = make_mock_client(["tool_use", "end_turn"])
    researcher_agent("Mumbai real estate", client_=mock_client)
    second_call_messages = mock_client.messages.create.call_args_list[1][1]["messages"]
    roles = [m["role"] for m in second_call_messages]
    assert "assistant" in roles, "Assistant message (tool call) must be in history"
    content_types = []
    for m in second_call_messages:
        if isinstance(m.get("content"), list):
            for block in m["content"]:
                if isinstance(block, dict):
                    content_types.append(block.get("type", ""))
    assert "tool_result" in content_types, "tool_result must be appended to messages"


def test_breaks_on_end_turn():
    """Loop must stop when stop_reason is end_turn, not continue forever."""
    mock_client = make_mock_client(["end_turn"])
    result = researcher_agent("test", client_=mock_client)
    assert mock_client.messages.create.call_count == 1
    assert isinstance(result, list)


def test_multiple_tool_calls():
    """Agent should handle multiple sequential tool calls."""
    mock_client = make_mock_client(["tool_use", "tool_use", "end_turn"])
    result = researcher_agent("deep research", client_=mock_client)
    assert mock_client.messages.create.call_count == 3
    assert isinstance(result, list)
