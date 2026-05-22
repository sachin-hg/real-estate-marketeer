"""
Module 6 Exercise — The Planner Pattern
Your task: Complete the planner so it OMITS off-topic content.
"""
import json
import anthropic

client = anthropic.Anthropic()

# The system prompt is missing one critical instruction.
# Without it the planner passes EVERY trend through — including
# "Coldplay concert" and "IPL 2025" — and the creative agents
# have to write forced, nonsensical housing content.
PLANNER_SYSTEM = """
You are a content strategist for Housing.com.
Given research articles and trending topics, create content briefs.

Classify each worthy topic:
- draft_type: "social" or "news"
- target_platforms: ["twitter","instagram"] for social; ["housing_news"] for news
- tone: "hinglish_viral", "formal_seo", or "educational"
- urgency: "breaking" | "trending" | "evergreen"

# TODO: Add the OMIT instruction here.
# Without it the planner generates briefs for entertainment gossip and sports
# scores that have NO genuine housing connection.
# The planner's job is FILTERING — what rule tells it to skip off-topic content?
???

Output ONLY valid JSON: a list of ContentBrief objects.
Maximum 5 social + 3 news briefs.
"""


def planner_node(research: list[dict], trends: list[dict], topic: str) -> list[dict]:
    research_text = "\n".join(f"- {r['title']}: {r.get('content','')[:200]}" for r in research[:5])
    trends_text = "\n".join(
        f"- [{t.get('platform','?')}] {t.get('hashtag','?')}: {t.get('context','')[:150]}"
        for t in trends[:8]
    )

    resp = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2048,
        system=PLANNER_SYSTEM,
        messages=[{
            "role": "user",
            "content": f"Topic: {topic}\n\nRESEARCH:\n{research_text}\n\nTRENDS:\n{trends_text}"
        }]
    )

    text = resp.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return []


# --- Test data ---
RESEARCH = [
    {"title": "Mumbai stamp duty cut to 3%", "content": "Maharashtra reduces stamp duty for first-time buyers below 45L."},
    {"title": "Bengaluru metro Phase 3 announced", "content": "New corridor boosts Whitefield property demand."},
]

TRENDS = [
    {"platform": "twitter", "hashtag": "#ColdplayConcert", "context": "Coldplay sold out Mumbai in 8 minutes"},
    {"platform": "twitter", "hashtag": "#StampDuty", "context": "Maharashtra stamp duty cut for affordable housing"},
    {"platform": "reddit", "hashtag": "#BengaluruMetro", "context": "Phase 3 announcement drives property interest"},
    {"platform": "youtube", "hashtag": "#IPL2025", "context": "IPL season record viewership — no housing link"},
]

if __name__ == "__main__":
    briefs = planner_node(RESEARCH, TRENDS, "affordable housing policies")
    print(f"Briefs generated: {len(briefs)}")
    for b in briefs:
        print(f"  - {b.get('topic','?')} ({b.get('draft_type','?')})")
    # Expected: 2 briefs (StampDuty + BengaluruMetro), NOT 4
    # ColdplayConcert and IPL2025 have no housing angle → OMITTED
