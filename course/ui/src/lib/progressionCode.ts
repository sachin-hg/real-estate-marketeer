export const PIPELINE_V1 = `# pipeline.py — v1: A single agent with tool use
import anthropic, json

client = anthropic.Anthropic()
TOOLS = [{"name": "web_search", "description": "Search for RE news",
           "input_schema": {"type": "object",
                            "properties": {"query": {"type": "string"}},
                            "required": ["query"]}}]

def mock_web_search(query: str) -> list[dict]:
    return [{"title": f"Result: {query}", "content": "Mumbai prices up 8% YoY"}]

def researcher_agent(topic: str) -> list[dict]:
    messages = [{"role": "user", "content": f"Research: {topic}"}]
    while True:
        resp = client.messages.create(model="claude-sonnet-4-6", max_tokens=1024,
                                      tools=TOOLS, messages=messages)
        if resp.stop_reason == "end_turn":
            return json.loads(resp.content[-1].text)
        tool = next(b for b in resp.content if b.type == "tool_use")
        result = mock_web_search(tool.input["query"])
        messages += [{"role": "assistant", "content": resp.content},
                     {"role": "user", "content": [{"type": "tool_result",
                      "tool_use_id": tool.id, "content": json.dumps(result)}]}]

if __name__ == "__main__":
    print(researcher_agent("Mumbai real estate 2025"))
`

export const PIPELINE_V2 = `# pipeline.py — v2: TypedDict state
import anthropic, json
from typing import TypedDict

client = anthropic.Anthropic()
TOOLS = [{"name": "web_search", "description": "Search for RE news",
           "input_schema": {"type": "object",
                            "properties": {"query": {"type": "string"}},
                            "required": ["query"]}}]

class PipelineState(TypedDict):
    topic: str
    research: list[dict]    # [{"title": str, "content": str, "url": str}]
    trends: list[dict]
    content_briefs: list[dict]
    creative_drafts: list[dict]
    platform_posts: list[dict]

def mock_web_search(query: str) -> list[dict]:
    return [{"title": f"Result: {query}", "content": "Mumbai prices up 8% YoY", "url": "https://example.com"}]

def researcher_node(state: PipelineState) -> dict:
    messages = [{"role": "user", "content": f"Research: {state['topic']}"}]
    while True:
        resp = client.messages.create(model="claude-sonnet-4-6", max_tokens=1024,
                                      tools=TOOLS, messages=messages)
        if resp.stop_reason == "end_turn":
            results = json.loads(resp.content[-1].text)
            return {"research": results}
        tool = next(b for b in resp.content if b.type == "tool_use")
        result = mock_web_search(tool.input["query"])
        messages += [{"role": "assistant", "content": resp.content},
                     {"role": "user", "content": [{"type": "tool_result",
                      "tool_use_id": tool.id, "content": json.dumps(result)}]}]

def planner_node(state: PipelineState) -> dict:
    # stub — full planner added in Module 6
    return {"content_briefs": [{"topic": state["topic"], "draft_type": "social"}]}

if __name__ == "__main__":
    state: PipelineState = {"topic": "Mumbai real estate 2025", "research": [],
                             "trends": [], "content_briefs": [],
                             "creative_drafts": [], "platform_posts": []}
    state.update(researcher_node(state))
    state.update(planner_node(state))
    print(state["content_briefs"])
`

export const PIPELINE_V3 = `# pipeline.py — v3: LangGraph StateGraph
import anthropic, json
from typing import TypedDict
from langgraph.graph import StateGraph, START, END

client = anthropic.Anthropic()
TOOLS = [{"name": "web_search", "description": "Search for RE news",
           "input_schema": {"type": "object",
                            "properties": {"query": {"type": "string"}},
                            "required": ["query"]}}]

class PipelineState(TypedDict):
    topic: str
    research: list[dict]
    trends: list[dict]
    content_briefs: list[dict]
    creative_drafts: list[dict]
    platform_posts: list[dict]

def mock_web_search(query: str) -> list[dict]:
    return [{"title": f"Result: {query}", "content": "Mumbai prices up 8% YoY", "url": "https://example.com"}]

def researcher_node(state: PipelineState) -> dict:
    messages = [{"role": "user", "content": f"Research: {state['topic']}"}]
    while True:
        resp = client.messages.create(model="claude-sonnet-4-6", max_tokens=1024,
                                      tools=TOOLS, messages=messages)
        if resp.stop_reason == "end_turn":
            return {"research": json.loads(resp.content[-1].text)}
        tool = next(b for b in resp.content if b.type == "tool_use")
        result = mock_web_search(tool.input["query"])
        messages += [{"role": "assistant", "content": resp.content},
                     {"role": "user", "content": [{"type": "tool_result",
                      "tool_use_id": tool.id, "content": json.dumps(result)}]}]

def planner_node(state: PipelineState) -> dict:
    return {"content_briefs": [{"topic": state["topic"], "draft_type": "social"}]}

# Build the graph
builder = StateGraph(PipelineState)
builder.add_node("researcher", researcher_node)
builder.add_node("planner", planner_node)

builder.add_edge(START, "researcher")
builder.add_edge("researcher", "planner")
builder.add_edge("planner", END)

graph = builder.compile()

if __name__ == "__main__":
    result = graph.invoke({"topic": "Mumbai real estate 2025", "research": [],
                           "trends": [], "content_briefs": [],
                           "creative_drafts": [], "platform_posts": []})
    print(result["content_briefs"])
`

export const PIPELINE_V4 = `# pipeline.py — v4: Parallel agents + operator.add
import anthropic, json, asyncio
from typing import TypedDict, Annotated
import operator
from langgraph.graph import StateGraph, START, END

client = anthropic.Anthropic()
TOOLS = [{"name": "web_search", "description": "Search for RE news",
           "input_schema": {"type": "object",
                            "properties": {"query": {"type": "string"}},
                            "required": ["query"]}}]

class PipelineState(TypedDict):
    topic: str
    research: list[dict]
    trends: list[dict]
    content_briefs: list[dict]
    # operator.add = parallel writes MERGE instead of overwrite
    creative_drafts: Annotated[list[dict], operator.add]
    platform_posts: Annotated[list[dict], operator.add]

def mock_web_search(query: str) -> list[dict]:
    return [{"title": f"Result: {query}", "content": "Mumbai prices up 8% YoY", "url": "https://example.com"}]

def researcher_node(state: PipelineState) -> dict:
    messages = [{"role": "user", "content": f"Research: {state['topic']}"}]
    while True:
        resp = client.messages.create(model="claude-sonnet-4-6", max_tokens=1024,
                                      tools=TOOLS, messages=messages)
        if resp.stop_reason == "end_turn":
            return {"research": json.loads(resp.content[-1].text)}
        tool = next(b for b in resp.content if b.type == "tool_use")
        result = mock_web_search(tool.input["query"])
        messages += [{"role": "assistant", "content": resp.content},
                     {"role": "user", "content": [{"type": "tool_result",
                      "tool_use_id": tool.id, "content": json.dumps(result)}]}]

def trend_researcher_node(state: PipelineState) -> dict:
    # Runs in parallel with researcher_node
    return {"trends": [{"hashtag": "#MumbaiRealEstate", "platform": "twitter",
                         "volume": "15K", "context": "stamp duty cut discussion"}]}

def planner_node(state: PipelineState) -> dict:
    return {"content_briefs": [{"topic": state["topic"], "draft_type": "social",
                                  "source": f"{len(state['research'])} articles, {len(state['trends'])} trends"}]}

# Build the graph — researcher AND trend_researcher run simultaneously
builder = StateGraph(PipelineState)
builder.add_node("researcher", researcher_node)
builder.add_node("trend_researcher", trend_researcher_node)
builder.add_node("planner", planner_node)

builder.add_edge(START, "researcher")
builder.add_edge(START, "trend_researcher")   # parallel fan-out
builder.add_edge("researcher", "planner")      # fan-in: planner waits for BOTH
builder.add_edge("trend_researcher", "planner")
builder.add_edge("planner", END)

graph = builder.compile()

if __name__ == "__main__":
    import asyncio
    result = asyncio.run(graph.ainvoke({"topic": "Mumbai real estate 2025", "research": [],
                                         "trends": [], "content_briefs": [],
                                         "creative_drafts": [], "platform_posts": []}))
    print(result["content_briefs"])
`

export const PIPELINE_V5 = `# pipeline.py — v5: Real planner with quality gate
import anthropic, json, asyncio
from typing import TypedDict, Annotated
import operator
from langgraph.graph import StateGraph, START, END

client = anthropic.Anthropic()
TOOLS = [{"name": "web_search", "description": "Search for RE news",
           "input_schema": {"type": "object",
                            "properties": {"query": {"type": "string"}},
                            "required": ["query"]}}]

PLANNER_SYSTEM = """You are a content strategist for Housing.com.
Given research articles and trending topics, create content briefs.

CRITICAL: OMIT any topic with no genuine housing/real-estate angle.
Entertainment, sports, politics with no property connection → OMIT entirely.
The Zomato concert example: omit it unless the venue is in a housing locality we cover.

Classify each worthy topic:
- draft_type: "social" or "news"
- target_platforms: list from [twitter, instagram, youtube, housing_news, linkedin]
- tone: "hinglish_viral", "formal_seo", or "educational"
- urgency: "breaking", "trending", "evergreen"

Output JSON array of ContentBrief objects. Maximum 5 social + 3 news."""

class PipelineState(TypedDict):
    topic: str
    research: list[dict]
    trends: list[dict]
    content_briefs: list[dict]
    creative_drafts: Annotated[list[dict], operator.add]
    platform_posts: Annotated[list[dict], operator.add]

def mock_web_search(query):
    return [{"title": f"Result: {query}", "content": "Mumbai prices up 8% YoY", "url": "https://example.com"}]

def researcher_node(state):
    messages = [{"role": "user", "content": f"Research: {state['topic']}"}]
    while True:
        resp = client.messages.create(model="claude-sonnet-4-6", max_tokens=1024,
                                      tools=TOOLS, messages=messages)
        if resp.stop_reason == "end_turn":
            return {"research": json.loads(resp.content[-1].text)}
        tool = next(b for b in resp.content if b.type == "tool_use")
        messages += [{"role": "assistant", "content": resp.content},
                     {"role": "user", "content": [{"type": "tool_result",
                      "tool_use_id": tool.id, "content": json.dumps(mock_web_search(tool.input["query"]))}]}]

def trend_researcher_node(state):
    return {"trends": [{"hashtag": "#MumbaiRealEstate", "platform": "twitter", "volume": "15K"}]}

def planner_node(state):
    prompt = f"""Research: {json.dumps(state['research'][:3])}
Trends: {json.dumps(state['trends'][:5])}
Topic hint: {state['topic']}
Create content briefs. OMIT anything not housing-related."""
    resp = client.messages.create(
        model="claude-haiku-4-5-20251001",  # fast-tier: classification not creation
        max_tokens=2048,
        system=PLANNER_SYSTEM,
        messages=[{"role": "user", "content": prompt}]
    )
    try:
        briefs = json.loads(resp.content[0].text)
    except:
        briefs = [{"topic": state["topic"], "draft_type": "social", "tone": "hinglish_viral"}]
    return {"content_briefs": briefs}

builder = StateGraph(PipelineState)
builder.add_node("researcher", researcher_node)
builder.add_node("trend_researcher", trend_researcher_node)
builder.add_node("planner", planner_node)
builder.add_edge(START, "researcher")
builder.add_edge(START, "trend_researcher")
builder.add_edge("researcher", "planner")
builder.add_edge("trend_researcher", "planner")
builder.add_edge("planner", END)
graph = builder.compile()

if __name__ == "__main__":
    result = asyncio.run(graph.ainvoke(
        {"topic": "Mumbai stamp duty cut", "research": [], "trends": [],
         "content_briefs": [], "creative_drafts": [], "platform_posts": []}
    ))
    print(json.dumps(result["content_briefs"], indent=2))
`

export const PIPELINE_V6 = `# pipeline.py — v6: Creative agents with few-shot hooks
import anthropic, json, asyncio
from typing import TypedDict, Annotated
import operator
from langgraph.graph import StateGraph, START, END

client = anthropic.Anthropic()
TOOLS = [{"name": "web_search", "input_schema": {"type": "object",
           "properties": {"query": {"type": "string"}}, "required": ["query"]}}]

SOCIAL_CREATIVE_SYSTEM = """You write social media content for Housing.com — Zomato's wit meets real estate.
Identity: Witty brand that trend-jacks viral moments with a housing punchline.
Style: Hinglish, max 2 emojis, city mentions embed SRP URL mentally.
Rule: Trend = HERO. Housing = PUNCHLINE. Never the other way.
First hashtag MUST be the trending tag (Twitter discovery).
Output JSON: {main_tweet, thread_tweets, hashtags, instagram_caption, trend_used}"""

NEWS_CREATIVE_SYSTEM = """You write SEO-optimised news articles for Housing.com.
Length: 700–1000 words. Structure: H1 → H2 → bullet stats → expert quote → CTA.
SEO: keyword in first 100 chars of body, natural density 1–2%.
Output JSON: {headline, subheadline, body_markdown, seo_keywords, meta_description}"""

HOOKS_EXAMPLES = """WRITE LIKE THESE:
- "Ye stadium nahi, ghar hai. Book a flat near BKC — Mumbai's next big locality 🏠"
- "IPL ka season hai, ghar dekhne ka bhi 🏏 Andheri East mein flats starting ₹85L"
- "Work from home is cancelled? Upgrade to work from YOUR home 🏡 WFH-ready flats in Pune"
NEVER WRITE:
- "Real estate market shows promising trends..." (too corporate)
- "Find your dream home today!" (generic, no trend hook)"""

class PipelineState(TypedDict):
    topic: str
    research: list[dict]
    trends: list[dict]
    content_briefs: list[dict]
    creative_drafts: Annotated[list[dict], operator.add]
    platform_posts: Annotated[list[dict], operator.add]

def researcher_node(state):
    return {"research": [{"title": "Mumbai prices rise 8%", "content": "...", "url": "https://example.com"}]}

def trend_researcher_node(state):
    return {"trends": [{"hashtag": "#IPL2025", "platform": "twitter", "volume": "500K", "context": "cricket finals"}]}

def planner_node(state):
    return {"content_briefs": [
        {"topic": state["topic"], "draft_type": "social", "tone": "hinglish_viral",
         "target_platforms": ["twitter", "instagram"], "trend_hashtag": "#IPL2025"},
        {"topic": state["topic"], "draft_type": "news", "tone": "formal_seo",
         "target_platforms": ["housing_news"], "seo_keywords": ["mumbai real estate 2025"]}
    ]}

def social_creative_node(state):
    social_briefs = [b for b in state["content_briefs"] if b.get("draft_type") == "social"]
    drafts = []
    for brief in social_briefs:
        resp = client.messages.create(
            model="claude-opus-4-7",  # best creative model
            max_tokens=1024,
            system=SOCIAL_CREATIVE_SYSTEM,
            messages=[{"role": "user", "content": f"{HOOKS_EXAMPLES}\\n\\nBrief: {json.dumps(brief)}"}]
        )
        draft = json.loads(resp.content[0].text)
        draft["draft_type"] = "social"
        drafts.append(draft)
    return {"creative_drafts": drafts}

def news_creative_node(state):
    news_briefs = [b for b in state["content_briefs"] if b.get("draft_type") == "news"]
    drafts = []
    for brief in news_briefs:
        resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=NEWS_CREATIVE_SYSTEM,
            messages=[{"role": "user", "content": f"Brief: {json.dumps(brief)}"}]
        )
        draft = json.loads(resp.content[0].text)
        draft["draft_type"] = "news"
        drafts.append(draft)
    return {"creative_drafts": drafts}

def qa_stub_node(state):
    return {}  # full QA added in Module 9

builder = StateGraph(PipelineState)
builder.add_node("researcher", researcher_node)
builder.add_node("trend_researcher", trend_researcher_node)
builder.add_node("planner", planner_node)
builder.add_node("social_creative", social_creative_node)
builder.add_node("news_creative", news_creative_node)
builder.add_node("qa", qa_stub_node)

builder.add_edge(START, "researcher")
builder.add_edge(START, "trend_researcher")
builder.add_edge("researcher", "planner")
builder.add_edge("trend_researcher", "planner")
builder.add_edge("planner", "social_creative")
builder.add_edge("planner", "news_creative")
builder.add_edge("social_creative", "qa")
builder.add_edge("news_creative", "qa")
builder.add_edge("qa", END)
graph = builder.compile()
`

export const PIPELINE_V7 = `# pipeline.py — v7: Platform agents with structured output
import anthropic, json, asyncio
from typing import TypedDict, Annotated
import operator
from langgraph.graph import StateGraph, START, END

client = anthropic.Anthropic()

TWITTER_SYSTEM = """Format a creative draft for Twitter.
Constraints:
- main_tweet ≤ 280 characters (HARD limit — Twitter API rejects otherwise)
- 2–4 hashtags maximum
- thread: 3–5 follow-up tweets if content warrants
If main_tweet > 280 chars, set needs_revision=true with specific cut instructions.
Output JSON: {main_tweet, thread_tweets, hashtags, char_count, needs_revision, revision_note}"""

INSTAGRAM_SYSTEM = """Format a creative draft for Instagram.
Constraints:
- caption: 150 chars for above-fold, full caption 2200 max
- hashtags: 15–20 (Instagram algorithm benefit)
- First line must be a hook — Instagram shows only first 1–2 lines
Output JSON: {caption_hook, full_caption, hashtags, media_suggestion}"""

class PipelineState(TypedDict):
    topic: str
    research: list[dict]
    trends: list[dict]
    content_briefs: list[dict]
    creative_drafts: Annotated[list[dict], operator.add]
    platform_posts: Annotated[list[dict], operator.add]

async def twitter_agent(draft: dict) -> list[dict]:
    resp = client.messages.create(
        model="claude-sonnet-4-6", max_tokens=1024,
        system=TWITTER_SYSTEM,
        messages=[{"role": "user", "content": f"Format this draft: {json.dumps(draft)}"}]
    )
    post = json.loads(resp.content[0].text)
    post["platform"] = "twitter"
    post["source_draft_id"] = draft.get("id", "unknown")
    return [post]

async def instagram_agent(draft: dict) -> list[dict]:
    resp = client.messages.create(
        model="claude-sonnet-4-6", max_tokens=1024,
        system=INSTAGRAM_SYSTEM,
        messages=[{"role": "user", "content": f"Format this draft: {json.dumps(draft)}"}]
    )
    post = json.loads(resp.content[0].text)
    post["platform"] = "instagram"
    return [post]

PLATFORM_AGENTS = {"twitter": twitter_agent, "instagram": instagram_agent}

async def platform_orchestrator_node(state: PipelineState) -> dict:
    tasks = [PLATFORM_AGENTS[p](d)
             for d in state["creative_drafts"]
             for p in d.get("target_platforms", [])
             if p in PLATFORM_AGENTS]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    posts, errors = [], []
    for r in results:
        if isinstance(r, Exception):
            errors.append(str(r))
        else:
            posts.extend(r)

    if errors:
        print(f"Platform errors (non-fatal): {errors}")
    return {"platform_posts": posts}

def researcher_node(state): return {"research": [{"title": "RE news", "content": "prices up 8%"}]}
def trend_researcher_node(state): return {"trends": [{"hashtag": "#IPL2025", "volume": "500K"}]}
def planner_node(state): return {"content_briefs": [{"topic": state["topic"], "draft_type": "social",
    "target_platforms": ["twitter", "instagram"], "tone": "hinglish_viral"}]}
def social_creative_node(state): return {"creative_drafts": [{"main_tweet": "IPL fever hits Mumbai homes 🏏",
    "draft_type": "social", "target_platforms": ["twitter", "instagram"],
    "trend_hashtag": "#IPL2025", "id": "d1"}]}
def qa_stub_node(state): return {}

builder = StateGraph(PipelineState)
for name, fn in [("researcher", researcher_node), ("trend_researcher", trend_researcher_node),
                  ("planner", planner_node), ("social_creative", social_creative_node),
                  ("platform_orchestrator", platform_orchestrator_node), ("qa", qa_stub_node)]:
    builder.add_node(name, fn)

builder.add_edge(START, "researcher")
builder.add_edge(START, "trend_researcher")
builder.add_edge("researcher", "planner")
builder.add_edge("trend_researcher", "planner")
builder.add_edge("planner", "social_creative")
builder.add_edge("social_creative", "platform_orchestrator")
builder.add_edge("platform_orchestrator", "qa")
builder.add_edge("qa", END)
graph = builder.compile()
`

export const PIPELINE_V8 = `# pipeline.py — v8: 3-pass QA + revision loop
import anthropic, json, asyncio
from typing import TypedDict, Annotated
import operator
from langgraph.graph import StateGraph, START, END

client = anthropic.Anthropic()

SAFETY_SYSTEM = """Review this post for Housing.com brand safety.

HARD BLOCKS (reject immediately):
- Religious, caste, or communal content
- Political PARTY names or election campaigning
- Forward-looking price guarantees with numbers ("will rise 40%")
- Named politicians as individuals

EXCEPTION — these are ALLOWED (government housing policy, not politics):
- PMAY, RERA, PM Awas Yojana, Pradhan Mantri Awas Yojana
- Swachh Bharat, Smart Cities Mission
- RBI rate decisions, repo rate changes
- Any government SCHEME or REGULATION (not party)

Output ONLY JSON: {"passed": bool, "violations": [], "categories": []}"""

QUALITY_SYSTEM = """Score this social post for Housing.com quality.
Dimensions (0.0–1.0 each):
- re_relevance: genuine real estate angle, not just keyword mention
- brand_voice: Hinglish wit, trend-jacked, Housing.com personality
- platform_fit: format correct for platform (char count, hashtag count)
- engagement_potential: would a Mumbai millennial stop scrolling?

Decision logic:
- All dims ≥ 0.7 AND no platform violations → "publish"
- Any fixable issue (char count, hashtag count) → "revise" with specific instructions
- re_relevance < 0.5 OR brand_voice < 0.4 → "reject"

Output JSON: {"scores": {}, "overall": float, "decision": "publish"|"revise"|"reject",
              "revision_instructions": str, "locked_elements": [str]}"""

class PipelineState(TypedDict):
    topic: str
    research: list[dict]
    trends: list[dict]
    content_briefs: list[dict]
    creative_drafts: Annotated[list[dict], operator.add]
    platform_posts: Annotated[list[dict], operator.add]
    approved_posts: list[dict]

async def qa_node(state: PipelineState) -> dict:
    approved = []
    for post in state["platform_posts"]:
        qa_attempt = post.get("qa_attempt", 0)

        # Pass 1: Safety gate (fast model, binary)
        safety_resp = client.messages.create(
            model="claude-haiku-4-5-20251001", max_tokens=256, system=SAFETY_SYSTEM,
            messages=[{"role": "user", "content": json.dumps(post)}]
        )
        safety = json.loads(safety_resp.content[0].text)
        if not safety["passed"]:
            print(f"Safety BLOCK: {safety['violations']}")
            continue

        # Pass 2: Quality scoring (Sonnet — nuanced judgment)
        quality_resp = client.messages.create(
            model="claude-sonnet-4-6", max_tokens=512, system=QUALITY_SYSTEM,
            messages=[{"role": "user", "content": json.dumps(post)}]
        )
        quality = json.loads(quality_resp.content[0].text)

        if quality["decision"] == "publish":
            post["qa_overall"] = quality["overall"]
            approved.append(post)
        elif quality["decision"] == "revise" and qa_attempt < 2:
            # Re-run platform agent with revision instructions
            revised_post = dict(post)
            revised_post["revision_instructions"] = quality["revision_instructions"]
            revised_post["locked_elements"] = quality.get("locked_elements", [])
            revised_post["qa_attempt"] = qa_attempt + 1
            # In real pipeline: re-call platform agent here
            # For spine demo: just re-queue
            state["platform_posts"].append(revised_post)
        else:
            print(f"Reject after {qa_attempt} attempts: overall={quality['overall']:.2f}")

    return {"approved_posts": approved}

# (researcher, trend_researcher, planner, creative, platform nodes same as v7)
def placeholder_nodes(state): return {}
`

export const PIPELINE_V9 = `# pipeline.py — v9: Production patterns (retry + checkpointing + routing)
import anthropic, json, asyncio
from typing import TypedDict, Annotated
import operator
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.aiosqlite import AsyncSqliteSaver
from langgraph.pregel import RetryPolicy

client = anthropic.Anthropic()

# Model routing — cost optimisation
def llm_router(tier: str) -> dict:
    """Returns {model, provider} based on task tier."""
    if tier == "fast":
        return {"model": "claude-haiku-4-5-20251001"}   # ~53% cheaper than Sonnet
    elif tier == "creative":
        return {"model": "claude-opus-4-7"}             # best for social drafts
    else:
        return {"model": "claude-sonnet-4-6"}           # balanced default

class PipelineState(TypedDict):
    topic: str
    research: list[dict]
    trends: list[dict]
    content_briefs: list[dict]
    creative_drafts: Annotated[list[dict], operator.add]
    platform_posts: Annotated[list[dict], operator.add]
    approved_posts: list[dict]
    run_id: str

# Retry policy for non-idempotent-sensitive nodes
_retry = RetryPolicy(max_attempts=3, initial_interval=1.0, backoff_factor=2.0)
# Note: publisher gets NO retry — retrying a successful post = duplicate live post

async def get_graph(run_id: str):
    """Returns compiled graph with checkpointing wired in."""
    checkpointer = AsyncSqliteSaver.from_conn_string("checkpoints.db")

    builder = StateGraph(PipelineState)

    # All nodes with retry except publisher
    builder.add_node("researcher",         researcher_node,  retry=_retry)
    builder.add_node("trend_researcher",   trend_researcher_node, retry=_retry)
    builder.add_node("planner",            planner_node,     retry=_retry)
    builder.add_node("social_creative",    social_creative_node, retry=_retry)
    builder.add_node("news_creative",      news_creative_node,   retry=_retry)
    builder.add_node("platform_orchestrator", platform_orchestrator_node, retry=_retry)
    builder.add_node("qa",                 qa_node,          retry=_retry)
    builder.add_node("publisher",          publisher_node)   # no retry — idempotency risk

    # Edges same as v8
    builder.add_edge(START, "researcher")
    builder.add_edge(START, "trend_researcher")
    builder.add_edge("researcher", "planner")
    builder.add_edge("trend_researcher", "planner")
    builder.add_edge("planner", "social_creative")
    builder.add_edge("planner", "news_creative")
    builder.add_edge("social_creative", "platform_orchestrator")
    builder.add_edge("news_creative", "platform_orchestrator")
    builder.add_edge("platform_orchestrator", "qa")
    builder.add_edge("qa", "publisher")
    builder.add_edge("publisher", END)

    return builder.compile(checkpointer=checkpointer)

async def run_pipeline(topic: str, run_id: str):
    graph = await get_graph(run_id)
    initial_state = {"topic": topic, "research": [], "trends": [], "content_briefs": [],
                     "creative_drafts": [], "platform_posts": [], "approved_posts": [], "run_id": run_id}

    # thread_id = run_id → if crash + restart with same run_id, resumes from checkpoint
    result = await graph.ainvoke(
        initial_state,
        config={"configurable": {"thread_id": run_id}}
    )
    return result

def researcher_node(state): return {"research": [{"title": "RE news", "url": "https://example.com"}]}
def trend_researcher_node(state): return {"trends": []}
def planner_node(state): return {"content_briefs": []}
def social_creative_node(state): return {"creative_drafts": []}
def news_creative_node(state): return {"creative_drafts": []}
async def platform_orchestrator_node(state): return {"platform_posts": []}
async def qa_node(state): return {"approved_posts": []}
async def publisher_node(state): return {}
`

export const PIPELINE_V10 = `# pipeline.py — v10: Observability + feedback loop
import anthropic, json, asyncio, sqlite3, time
from typing import TypedDict, Annotated
import operator
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.aiosqlite import AsyncSqliteSaver
from langgraph.pregel import RetryPolicy

client = anthropic.Anthropic()
_retry = RetryPolicy(max_attempts=3, initial_interval=1.0, backoff_factor=2.0)

def log_llm_call(agent: str, model: str, input_tokens: int, output_tokens: int) -> None:
    """Every LLM call logs cost — visible in summary.json and terminal."""
    cost_per_mtok = {"claude-opus-4-7": (15.0, 75.0),
                     "claude-sonnet-4-6": (3.0, 15.0),
                     "claude-haiku-4-5-20251001": (0.25, 1.25)}
    inp_rate, out_rate = cost_per_mtok.get(model, (3.0, 15.0))
    cost = (input_tokens / 1e6 * inp_rate) + (output_tokens / 1e6 * out_rate)
    print(f"[{agent}] {model} — {input_tokens}↑ {output_tokens}↓ tokens — \${cost:.4f}")

def get_performance_history() -> str:
    """Reads top/bottom performers from DB to inject into creative prompt."""
    try:
        conn = sqlite3.connect("housing_content.db")
        top = conn.execute(
            "SELECT content, platform, actual_engagement_7d FROM posts "
            "WHERE actual_engagement_7d IS NOT NULL ORDER BY actual_engagement_7d DESC LIMIT 3"
        ).fetchall()
        bottom = conn.execute(
            "SELECT content, platform, actual_engagement_7d FROM posts "
            "WHERE actual_engagement_7d IS NOT NULL ORDER BY actual_engagement_7d ASC LIMIT 2"
        ).fetchall()
        conn.close()
        if not top:
            return ""  # first week — no history yet
        top_txt = "\\n".join(f"[{p}] ER={er:.2%}: {c[:80]}" for c, p, er in top)
        bot_txt = "\\n".join(f"[{p}] ER={er:.2%}: {c[:80]}" for c, p, er in bottom)
        return f"\\n\\nTOP PERFORMING PAST POSTS (learn from these):\\n{top_txt}\\n\\nAVOID THIS STYLE:\\n{bot_txt}"
    except:
        return ""

class PipelineState(TypedDict):
    topic: str
    research: list[dict]
    trends: list[dict]
    content_briefs: list[dict]
    creative_drafts: Annotated[list[dict], operator.add]
    platform_posts: Annotated[list[dict], operator.add]
    approved_posts: list[dict]
    run_id: str
    llm_costs: Annotated[list[dict], operator.add]   # accumulates per-call costs

def social_creative_node(state: PipelineState) -> dict:
    social_briefs = [b for b in state["content_briefs"] if b.get("draft_type") == "social"]
    drafts, costs = [], []

    # Feedback loop: fetch real performance history INSIDE the node (must be fresh)
    performance_context = get_performance_history()

    for brief in social_briefs:
        resp = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=1024,
            system=f"You write Housing.com social content. Trend=HERO, Housing=PUNCHLINE.{performance_context}",
            messages=[{"role": "user", "content": f"Brief: {json.dumps(brief)}"}]
        )
        log_llm_call("social_creative", "claude-opus-4-7",
                     resp.usage.input_tokens, resp.usage.output_tokens)
        costs.append({"agent": "social_creative", "model": "claude-opus-4-7",
                       "input": resp.usage.input_tokens, "output": resp.usage.output_tokens})
        drafts.append(json.loads(resp.content[0].text))

    return {"creative_drafts": drafts, "llm_costs": costs}

# All other nodes follow same pattern: log_llm_call after every LLM call
# publisher writes summary.json with aggregated costs at end of run
`
