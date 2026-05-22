"""
Module 2 Exercise — Build the researcher agent loop.
Fill in the TODO sections to complete the ReAct loop.
Run tests: python -m pytest tests.py -v
"""
import anthropic
import json
import os

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", "test"))

TOOLS = [
    {
        "name": "web_search",
        "description": "Search for real estate news",
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"]
        }
    }
]

def mock_web_search(query: str) -> list[dict]:
    return [{"title": f"RE result: {query}", "content": "Mock content", "url": "https://example.com"}]


def researcher_agent(topic: str, client_=None) -> list[dict]:
    """
    ReAct loop researcher agent.

    TODO 1: Initialize the messages list with the user's research request.

    TODO 2: Implement the while True loop that:
      - Calls client.messages.create with the TOOLS
      - Breaks out of the loop when stop_reason == 'end_turn' (returning parsed results)
      - For tool_use stop_reason: extracts the tool call, runs mock_web_search,
        appends assistant + tool_result messages
    """
    if client_ is None:
        client_ = client

    # TODO 1: Initialize messages
    messages = []  # Replace this

    # TODO 2: Implement the ReAct loop
    # Your code here

    return []  # Replace this
