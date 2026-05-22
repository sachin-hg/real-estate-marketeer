"""Module 4 Exercise — Solution"""
import anthropic, json, os
from typing import TypedDict
from langgraph.graph import StateGraph, START, END

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", "test"))

class PipelineState(TypedDict):
    topic: str
    research: list[dict]
    content_briefs: list[dict]

TOOLS = [{"name": "web_search", "description": "Search for RE news",
          "input_schema": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}}]

def mock_web_search(q): return [{"title": f"RE: {q}", "content": "Mock", "url": "https://example.com"}]

def researcher_node(state: PipelineState) -> dict:
    messages = [{"role": "user", "content": f"Research: {state['topic']}"}]
    while True:
        resp = client.messages.create(model="claude-sonnet-4-6", max_tokens=512, tools=TOOLS, messages=messages)
        if resp.stop_reason == "end_turn":
            try: return {"research": json.loads(next(b.text for b in resp.content if b.type == "text"))}
            except: return {"research": []}
        tool = next((b for b in resp.content if b.type == "tool_use"), None)
        if tool:
            messages += [{"role": "assistant", "content": resp.content},
                         {"role": "user", "content": [{"type": "tool_result", "tool_use_id": tool.id,
                          "content": json.dumps(mock_web_search(tool.input["query"]))}]}]

def planner_node(state: PipelineState) -> dict:
    return {"content_briefs": [{"topic": state["topic"], "draft_type": "social"}]}

builder = StateGraph(PipelineState)
builder.add_node("researcher", researcher_node)
builder.add_node("planner",    planner_node)
builder.add_edge(START, "researcher")
builder.add_edge("researcher", "planner")
builder.add_edge("planner", END)
graph = builder.compile()
