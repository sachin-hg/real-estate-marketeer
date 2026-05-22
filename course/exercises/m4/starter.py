"""
Module 4 Exercise — Wire agents into a LangGraph StateGraph.
Fill in the TODO sections. Run tests: python -m pytest tests.py -v
"""
import anthropic, json, os
from typing import TypedDict

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", "test"))

class PipelineState(TypedDict):
    topic: str
    research: list[dict]
    content_briefs: list[dict]

TOOLS = [{"name": "web_search",
          "description": "Search for RE news",
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
                         {"role": "user", "content": [{"type": "tool_result", "tool_use_id": tool.id, "content": json.dumps(mock_web_search(tool.input["query"]))}]}]

def planner_node(state: PipelineState) -> dict:
    return {"content_briefs": [{"topic": state["topic"], "draft_type": "social"}]}

# TODO: Build the graph
# 1. Import StateGraph, START, END from langgraph.graph
# 2. Create builder = StateGraph(PipelineState)
# 3. Add both nodes with builder.add_node(...)
# 4. Add edges: START → researcher → planner → END
# 5. Compile: graph = builder.compile()

# Your code here:
graph = None  # TODO: replace with compiled graph
