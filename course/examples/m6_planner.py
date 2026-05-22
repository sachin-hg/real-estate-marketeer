"""
Module 6 — The Planner Pattern
pipeline.py v5: Planner makes a real LLM call and OMITS off-topic content.

Run:
    pip install anthropic
    ANTHROPIC_API_KEY=sk-... python m6_planner.py
"""
import json
import anthropic

client = anthropic.Anthropic()

# --- v4 state shape (carried forward) ---
from typing import TypedDict, Annotated
import operator


class ContentBrief(TypedDict):
    topic: str
    angle: str
    draft_type: str           # "social" | "news"
    target_platforms: list[str]
    tone: str                 # "hinglish_viral" | "formal_seo" | "educational"
    urgency: str
    source_summary: str
    city_hint: str
    seo_keywords: list[str]


class PipelineState(TypedDict):
    topic: str
    research: list[dict]
    trends: list[dict]
    content_briefs: list[ContentBrief]
    creative_drafts: Annotated[list[dict], operator.add]


# --- Planner system prompt with OMIT instruction ---
PLANNER_SYSTEM = """
You are a content strategist for Housing.com.
Given research articles and trending topics, create content briefs.

Classify each worthy topic:
- draft_type: "social" or "news"
- target_platforms: ["twitter","instagram"] for social; ["housing_news"] for news
- tone: "hinglish_viral", "formal_seo", or "educational"
- urgency: "breaking" | "trending" | "evergreen"

CRITICAL FILTER — OMIT topics with NO genuine housing angle:
- Entertainment gossip → OMIT
- Cricket/sports scores with no home-buying relevance → OMIT
- Political news without a direct property policy link → OMIT
Only include a topic if you can write a clear, non-forced connection to
buying, renting, investing in, or improving a home.

Output ONLY valid JSON: a list of ContentBrief objects.
Maximum 5 social + 3 news briefs total.
"""


def planner_node(state: PipelineState) -> dict:
    research_summary = "\n".join(
        f"- {r['title']}: {r.get('content', '')[:200]}"
        for r in state["research"][:5]
    )
    trends_summary = "\n".join(
        f"- [{t.get('platform','?')}] {t.get('hashtag', t.get('title','?'))}: {t.get('context','')[:150]}"
        for t in state["trends"][:8]
    )

    resp = client.messages.create(
        model="claude-haiku-4-5-20251001",   # fast tier — classification not creation
        max_tokens=2048,
        system=PLANNER_SYSTEM,
        messages=[{
            "role": "user",
            "content": f"""Topic focus: {state['topic']}

RESEARCH:
{research_summary}

TRENDING TOPICS:
{trends_summary}

Generate content briefs. Remember: OMIT anything without a genuine housing angle."""
        }]
    )

    text = resp.content[0].text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    try:
        briefs = json.loads(text)
    except json.JSONDecodeError:
        briefs = []

    print(f"\n  Planner produced {len(briefs)} brief(s)")
    return {"content_briefs": briefs}


# --- Demo ---

MOCK_RESEARCH = [
    {"title": "Mumbai stamp duty cut to 3%", "content": "Maharashtra reduces stamp duty for first-time buyers below 45L."},
    {"title": "RBI holds repo rate at 6.5%", "content": "EMIs remain stable, positive for home loan affordability."},
    {"title": "Bengaluru metro Phase 3 announced", "content": "New corridor connects Whitefield to Electronic City, boosting micro-market prices."},
]

MOCK_TRENDS = [
    {"platform": "twitter", "hashtag": "#ColdplayConcert", "context": "Coldplay sold out Mumbai in 8 minutes", "city_hint": "Mumbai"},
    {"platform": "twitter", "hashtag": "#StampDuty", "context": "Maharashtra stamp duty reduced for affordable housing buyers", "city_hint": "Mumbai"},
    {"platform": "reddit", "hashtag": "#BengaluruMetro", "context": "Phase 3 announcement triggers property interest in Whitefield", "city_hint": "Bengaluru"},
    {"platform": "youtube", "hashtag": "#IPL2025", "context": "IPL season viewership records shattered", "city_hint": None},
]

if __name__ == "__main__":
    state: PipelineState = {
        "topic": "affordable housing policies",
        "research": MOCK_RESEARCH,
        "trends": MOCK_TRENDS,
        "content_briefs": [],
        "creative_drafts": [],
    }

    print("Running planner...")
    print("\nInput trends (mix of housing + off-topic):")
    for t in MOCK_TRENDS:
        print(f"  {t['hashtag']} — {t['context'][:60]}")

    result = planner_node(state)
    briefs = result["content_briefs"]

    print(f"\n{'='*60}")
    print(f"PLANNER OUTPUT: {len(briefs)} content brief(s)")
    print(f"{'='*60}")

    off_topic = [t["hashtag"] for t in MOCK_TRENDS
                 if t["hashtag"] in ("#ColdplayConcert", "#IPL2025")]
    print(f"\nOMITTED off-topic trends: {off_topic}")
    print("\nGenerated briefs:")
    for i, b in enumerate(briefs, 1):
        print(f"\n  Brief {i}:")
        print(f"    topic:     {b.get('topic', '?')}")
        print(f"    angle:     {b.get('angle', '?')}")
        print(f"    type:      {b.get('draft_type', '?')}")
        print(f"    platforms: {b.get('target_platforms', [])}")
        print(f"    tone:      {b.get('tone', '?')}")
