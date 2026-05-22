"""Module 5 Exercise — Solution"""
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
    creative_drafts: Annotated[list[dict], operator.add]

def researcher_node(state: PipelineState) -> dict:
    return {"research": [{"title": "RE news", "content": "Prices up 8%"}]}

def trend_researcher_node(state: PipelineState) -> dict:
    return {"trends": [{"hashtag": "#MumbaiRE", "volume": "15K"}]}

def planner_node(state: PipelineState) -> dict:
    return {"content_briefs": [{"topic": state["topic"],
                                 "research_count": len(state["research"]),
                                 "trend_count": len(state["trends"])}]}

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
