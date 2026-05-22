"""Module 2 Exercise — Solution"""
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
    if client_ is None:
        client_ = client

    messages = [{"role": "user", "content": f"Research: {topic}"}]

    while True:
        resp = client_.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            tools=TOOLS,
            messages=messages
        )
        if resp.stop_reason == "end_turn":
            text = next((b.text for b in resp.content if b.type == "text"), "[]")
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return []
        tool = next((b for b in resp.content if b.type == "tool_use"), None)
        if tool:
            result = mock_web_search(tool.input["query"])
            messages = messages + [
                {"role": "assistant", "content": resp.content},
                {"role": "user", "content": [{"type": "tool_result",
                 "tool_use_id": tool.id, "content": json.dumps(result)}]}
            ]
