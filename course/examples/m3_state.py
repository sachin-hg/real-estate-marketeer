"""
Module 3 — State: The Agent's Memory
Demonstrates TypedDict state with two agents sharing state.
Run: python m3_state.py  (set ANTHROPIC_API_KEY env var)
"""
import anthropic
import json
import os
from typing import TypedDict

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

class PipelineState(TypedDict):
    topic: str
    research: list[dict]    # [{title, content, url}]
    trends: list[dict]
    content_briefs: list[dict]
    creative_drafts: list[dict]
    platform_posts: list[dict]

TOOLS = [{"name": "web_search",
          "description": "Search for real estate news",
          "input_schema": {"type": "object",
                           "properties": {"query": {"type": "string"}},
                           "required": ["query"]}}]

def mock_web_search(query: str) -> list[dict]:
    return [{"title": f"Mumbai: {query}", "content": "Prices up 8% YoY. Stamp duty cut.", "url": "https://housing.com/news"}]

def researcher_node(state: PipelineState) -> dict:
    """Takes full state, returns only the fields it changes."""
    print(f"[researcher] Researching: {state['topic']}")
    messages = [{"role": "user", "content": f"Research real estate news for: {state['topic']}. Return JSON list of articles."}]
    while True:
        resp = client.messages.create(model="claude-sonnet-4-6", max_tokens=1024,
                                      tools=TOOLS, messages=messages)
        if resp.stop_reason == "end_turn":
            try:
                results = json.loads(next(b.text for b in resp.content if b.type == "text"))
            except (json.JSONDecodeError, StopIteration):
                results = [{"title": "RE news", "content": "Market update", "url": "https://housing.com"}]
            print(f"[researcher] Found {len(results)} articles")
            return {"research": results}   # partial state update — only this field
        tool = next((b for b in resp.content if b.type == "tool_use"), None)
        if tool:
            result = mock_web_search(tool.input["query"])
            messages += [{"role": "assistant", "content": resp.content},
                         {"role": "user", "content": [{"type": "tool_result",
                          "tool_use_id": tool.id, "content": json.dumps(result)}]}]

def planner_node(state: PipelineState) -> dict:
    """Reads research from state, writes content_briefs."""
    print(f"[planner] Processing {len(state['research'])} articles")
    briefs = [{"topic": state["topic"], "draft_type": "social",
               "tone": "hinglish_viral", "source_count": len(state["research"])}]
    return {"content_briefs": briefs}

if __name__ == "__main__":
    state: PipelineState = {
        "topic": "Mumbai stamp duty cut 2025",
        "research": [], "trends": [],
        "content_briefs": [], "creative_drafts": [], "platform_posts": []
    }
    state.update(researcher_node(state))
    state.update(planner_node(state))
    print(f"\nFinal content_briefs:")
    print(json.dumps(state["content_briefs"], indent=2))
