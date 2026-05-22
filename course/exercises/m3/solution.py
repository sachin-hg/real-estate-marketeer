"""Module 3 Exercise — Solution"""
import anthropic, json, os
from typing import TypedDict

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", "test"))

class PipelineState(TypedDict):
    topic: str
    research: list[dict]
    content_briefs: list[dict]

TOOLS = [{"name": "web_search",
          "description": "Search for real estate news",
          "input_schema": {"type": "object",
                           "properties": {"query": {"type": "string"}},
                           "required": ["query"]}}]

def mock_web_search(query: str) -> list[dict]:
    return [{"title": f"RE: {query}", "content": "Mock content", "url": "https://example.com"}]

def researcher_node(state: PipelineState) -> dict:
    messages = [{"role": "user", "content": f"Research: {state['topic']}"}]
    while True:
        resp = client.messages.create(model="claude-sonnet-4-6", max_tokens=1024,
                                      tools=TOOLS, messages=messages)
        if resp.stop_reason == "end_turn":
            try:
                results = json.loads(next(b.text for b in resp.content if b.type == "text"))
            except:
                results = []
            return {"research": results}
        tool = next((b for b in resp.content if b.type == "tool_use"), None)
        if tool:
            result = mock_web_search(tool.input["query"])
            messages += [{"role": "assistant", "content": resp.content},
                         {"role": "user", "content": [{"type": "tool_result",
                          "tool_use_id": tool.id, "content": json.dumps(result)}]}]

def planner_node(state: PipelineState) -> dict:
    return {"content_briefs": [{"topic": state["topic"], "draft_type": "social"}]}
