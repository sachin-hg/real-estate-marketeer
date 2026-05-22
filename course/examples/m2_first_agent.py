"""
Module 2 — Your First Agent
Run with a real ANTHROPIC_API_KEY:  python m2_first_agent.py
Uses Tavily for web_search if TAVILY_API_KEY is set, else mock results.
"""
import anthropic
import json
import os

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

def web_search(query: str, max_results: int = 5) -> list[dict]:
    """Real Tavily search if API key set, else mock."""
    tavily_key = os.environ.get("TAVILY_API_KEY")
    if tavily_key:
        try:
            from tavily import TavilyClient
            tc = TavilyClient(api_key=tavily_key)
            results = tc.search(query, max_results=max_results)
            return [{"title": r.get("title", ""), "content": r.get("content", ""),
                     "url": r.get("url", "")} for r in results.get("results", [])]
        except ImportError:
            print("tavily-python not installed — using mock results")
    # Mock fallback
    return [
        {"title": f"Mumbai real estate: {query}", "content": "Property prices in Mumbai up 8% YoY. Stamp duty cut drives demand.", "url": "https://housing.com/news/1"},
        {"title": f"Bengaluru market outlook: {query}", "content": "IT corridor sees sustained demand. 2BHK in Whitefield: ₹85L avg.", "url": "https://housing.com/news/2"},
    ]

TOOLS = [
    {
        "name": "web_search",
        "description": "Search for recent real estate news, market data, and housing trends in India.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query with city, topic, time context"},
                "max_results": {"type": "integer", "default": 5}
            },
            "required": ["query"]
        }
    }
]

SYSTEM_PROMPT = """You are a real estate research analyst for Housing.com.
Use web_search to find 5–8 recent, credible real estate news stories.
Focus on: price movements, new projects, policy changes (RERA, PMAY), infrastructure.
Return JSON: list of {title, content, url, relevance (1-5), city}.
Search at least twice with different queries before returning."""


def researcher_agent(topic: str) -> list[dict]:
    """ReAct loop: reason → search → observe → repeat until end_turn."""
    messages = [{"role": "user", "content": f"Research this topic: {topic}"}]
    iterations = 0

    while True:
        iterations += 1
        print(f"\n[Iteration {iterations}] Calling LLM...")

        resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )

        print(f"  stop_reason: {resp.stop_reason}")

        if resp.stop_reason == "end_turn":
            # Extract text block
            text_block = next((b for b in resp.content if b.type == "text"), None)
            if text_block:
                try:
                    return json.loads(text_block.text)
                except json.JSONDecodeError:
                    return [{"title": "Parse error", "content": text_block.text, "url": ""}]
            return []

        # Handle tool calls
        for block in resp.content:
            if block.type == "tool_use":
                print(f"  Tool call: {block.name}({block.input})")
                if block.name == "web_search":
                    result = web_search(
                        block.input["query"],
                        block.input.get("max_results", 5)
                    )
                    print(f"  → {len(result)} results")
                    messages = messages + [
                        {"role": "assistant", "content": resp.content},
                        {"role": "user", "content": [
                            {"type": "tool_result",
                             "tool_use_id": block.id,
                             "content": json.dumps(result)}
                        ]}
                    ]
                    break  # Process one tool at a time


if __name__ == "__main__":
    topic = "Mumbai real estate stamp duty 2025"
    print(f"Researching: {topic}\n{'='*50}")
    results = researcher_agent(topic)
    print(f"\n{'='*50}")
    print(f"Found {len(results)} articles:\n")
    for i, r in enumerate(results, 1):
        print(f"{i}. {r.get('title', 'No title')}")
        print(f"   City: {r.get('city', 'N/A')} | Relevance: {r.get('relevance', 'N/A')}/5")
        print(f"   {r.get('url', '')}\n")
