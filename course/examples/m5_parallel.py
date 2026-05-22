"""
Module 5 — Parallel Agents + operator.add
Adds trend_researcher running in parallel with researcher.
Run: pip install langgraph && python m5_parallel.py
"""
import anthropic
import asyncio
import json
import os
from typing import TypedDict, Annotated
import operator
from langgraph.graph import StateGraph, START, END

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

class PipelineState(TypedDict):
    topic: str
    research: list[dict]
    trends: list[dict]
    content_briefs: list[dict]
    creative_drafts: Annotated[list[dict], operator.add]
    platform_posts:  Annotated[list[dict], operator.add]

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

def trend_researcher_node(state: PipelineState) -> dict:
    """Runs in parallel with researcher. Finds trending topics."""
    print("[trend_researcher] Fetching trends...")
    return {"trends": [
        {"hashtag": "#MumbaiRealEstate", "platform": "twitter", "volume": "15K",
         "context": "stamp duty cut discussion", "creative_hook": "Mumbai homebuyers rejoice!"},
        {"hashtag": "#WorkFromHome", "platform": "twitter", "volume": "80K",
         "context": "return to office debate", "creative_hook": "WFH cancelled? Upgrade your home!"},
    ]}

def planner_node(state: PipelineState) -> dict:
    """Fan-in: waits for BOTH researcher AND trend_researcher."""
    print(f"[planner] Got {len(state['research'])} articles + {len(state['trends'])} trends")
    return {"content_briefs": [{
        "topic": state["topic"],
        "draft_type": "social",
        "trend_hashtag": state["trends"][0]["hashtag"] if state["trends"] else None,
        "source_count": len(state["research"])
    }]}

builder = StateGraph(PipelineState)
builder.add_node("researcher",       researcher_node)
builder.add_node("trend_researcher", trend_researcher_node)
builder.add_node("planner",          planner_node)
builder.add_edge(START, "researcher")
builder.add_edge(START, "trend_researcher")    # parallel fan-out
builder.add_edge("researcher",       "planner")  # fan-in
builder.add_edge("trend_researcher", "planner")  # fan-in
builder.add_edge("planner", END)
graph = builder.compile()

async def main():
    print("Running parallel pipeline...")
    result = await graph.ainvoke({
        "topic": "Mumbai stamp duty cut 2025",
        "research": [], "trends": [], "content_briefs": [],
        "creative_drafts": [], "platform_posts": []
    })
    print(f"\nResearch: {len(result['research'])} articles")
    print(f"Trends:   {len(result['trends'])} topics")
    print(f"Briefs:   {json.dumps(result['content_briefs'], indent=2)}")

if __name__ == "__main__":
    asyncio.run(main())
