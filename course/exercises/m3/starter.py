"""
Module 3 Exercise — Add TypedDict state to the researcher agent.
Fill in the TODO sections. Run tests: python -m pytest tests.py -v
"""
import anthropic, json, os
from typing import TypedDict

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", "test"))

# TODO 1: Define PipelineState TypedDict with these fields:
#   topic: str
#   research: ???        ← what type does researcher return?
#   content_briefs: list[dict]
class PipelineState(TypedDict):
    topic: str
    research: ???   # TODO: fill in the type (hint: list of article dicts)
    content_briefs: list[dict]

TOOLS = [{"name": "web_search",
          "description": "Search for real estate news",
          "input_schema": {"type": "object",
                           "properties": {"query": {"type": "string"}},
                           "required": ["query"]}}]

def mock_web_search(query: str) -> list[dict]:
    return [{"title": f"RE: {query}", "content": "Mock content", "url": "https://example.com"}]

# TODO 2: Fix researcher_node to:
#   - Accept state: PipelineState (not a plain string)
#   - Use state["topic"] for the research query
#   - Return {"research": results} (partial state update, not just the list)
def researcher_node(topic: str) -> list[dict]:   # TODO: change this signature
    messages = [{"role": "user", "content": f"Research: {topic}"}]  # TODO: use state
    while True:
        resp = client.messages.create(model="claude-sonnet-4-6", max_tokens=1024,
                                      tools=TOOLS, messages=messages)
        if resp.stop_reason == "end_turn":
            return json.loads(resp.content[-1].text)  # TODO: return partial state dict
        tool = next(b for b in resp.content if b.type == "tool_use")
        result = mock_web_search(tool.input["query"])
        messages += [{"role": "assistant", "content": resp.content},
                     {"role": "user", "content": [{"type": "tool_result",
                      "tool_use_id": tool.id, "content": json.dumps(result)}]}]

def planner_node(state: PipelineState) -> dict:
    return {"content_briefs": [{"topic": state["topic"], "draft_type": "social"}]}
