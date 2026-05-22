"""
Module 4 — Graphs: Wiring Agents Together
Wraps agents in a LangGraph StateGraph.
Run: pip install langgraph && python m4_graph.py
"""
import anthropic
import json
import os
from typing import TypedDict
from langgraph.graph import StateGraph, START, END

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

class PipelineState(TypedDict):
    topic: str
    research: list[dict]
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
    return [{"title": f"Result: {query}", "content": "Mumbai prices up 8% YoY", "url": "https://housing.com/news"}]

def researcher_node(state: PipelineState) -> dict:
    messages = [{"role": "user", "content": f"Research: {state['topic']}"}]
    while True:
        resp = client.messages.create(model="claude-sonnet-4-6", max_tokens=1024,
                                      tools=TOOLS, messages=messages)
        if resp.stop_reason == "end_turn":
            try:
                return {"research": json.loads(next(b.text for b in resp.content if b.type == "text"))}
            except:
                return {"research": []}
        tool = next((b for b in resp.content if b.type == "tool_use"), None)
        if tool:
            result = mock_web_search(tool.input["query"])
            messages += [{"role": "assistant", "content": resp.content},
                         {"role": "user", "content": [{"type": "tool_result",
                          "tool_use_id": tool.id, "content": json.dumps(result)}]}]

def planner_node(state: PipelineState) -> dict:
    print(f"[planner] Received {len(state['research'])} articles")
    return {"content_briefs": [{"topic": state["topic"], "draft_type": "social"}]}

# Build the graph
builder = StateGraph(PipelineState)
builder.add_node("researcher", researcher_node)
builder.add_node("planner",    planner_node)
builder.add_edge(START, "researcher")
builder.add_edge("researcher", "planner")
builder.add_edge("planner", END)
graph = builder.compile()

if __name__ == "__main__":
    print("Running graph.invoke()...")
    result = graph.invoke({
        "topic": "Bengaluru IT corridor real estate 2025",
        "research": [], "trends": [], "content_briefs": [],
        "creative_drafts": [], "platform_posts": []
    })
    print(f"Result: {json.dumps(result['content_briefs'], indent=2)}")
