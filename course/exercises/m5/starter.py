"""
Module 5 Exercise — Add parallel fan-out and operator.add reducer.
Fill in the TODOs. Run tests: python -m pytest tests.py -v
"""
import anthropic, json, os, asyncio
from typing import TypedDict, Annotated
import operator
from langgraph.graph import StateGraph, START, END

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", "test"))

class PipelineState(TypedDict):
    topic: str
    research: list[dict]
    trends: list[dict]
    content_briefs: list[dict]
    creative_drafts: ???   # TODO 1: Add operator.add reducer for parallel-safe writes

TOOLS = [{"name": "web_search", "description": "Search for RE news",
          "input_schema": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}}]

def mock_web_search(q): return [{"title": f"RE: {q}", "content": "Mock", "url": "https://example.com"}]

def researcher_node(state: PipelineState) -> dict:
    return {"research": [{"title": "RE news", "content": "Prices up 8%"}]}

def trend_researcher_node(state: PipelineState) -> dict:
    return {"trends": [{"hashtag": "#MumbaiRE", "volume": "15K"}]}

def planner_node(state: PipelineState) -> dict:
    return {"content_briefs": [{"topic": state["topic"],
                                 "research_count": len(state["research"]),
                                 "trend_count": len(state["trends"])}]}

# TODO 2: Build the graph with parallel fan-out
# researcher and trend_researcher must run in parallel (both start from START)
# planner must wait for both (fan-in)
builder = StateGraph(PipelineState)
builder.add_node("researcher",       researcher_node)
builder.add_node("trend_researcher", trend_researcher_node)
builder.add_node("planner",          planner_node)

# TODO: Add the correct edges for parallel execution
# Hint: researcher needs a START edge AND trend_researcher needs a START edge
builder.add_edge(START, "researcher")
# ??? missing edge for trend_researcher
builder.add_edge("researcher",       "planner")
builder.add_edge("trend_researcher", "planner")
builder.add_edge("planner", END)
graph = builder.compile()
