"""
Module 8 — Platform Agents & Structured Output
pipeline.py v7: Platform orchestrator with asyncio.gather(return_exceptions=True)

Run:
    pip install anthropic
    ANTHROPIC_API_KEY=sk-... python m8_platform.py
"""
import asyncio
import json
import anthropic

client = anthropic.Anthropic()

# --- State shape (carried forward) ---
from typing import TypedDict, Annotated
import operator


class PipelineState(TypedDict):
    topic: str
    research: list[dict]
    trends: list[dict]
    content_briefs: list[dict]
    creative_drafts: list[dict]
    platform_posts: Annotated[list[dict], operator.add]


# --- Platform constraints (hard limits) ---
PLATFORM_CONSTRAINTS = {
    "twitter": {
        "max_chars": 280,
        "max_hashtags": 4,
        "media": "optional",
    },
    "instagram": {
        "max_chars": 2200,
        "max_hashtags": 20,
        "media": "required",
        "min_hashtags": 15,
    },
    "housing_news": {
        "min_words": 700,
        "max_words": 1000,
        "media": "optional",
    },
}

TWITTER_SYSTEM = """
You are the Twitter agent for Housing.com.
Take a creative draft and produce a tweet optimised for Twitter's algorithm.

Hard constraints:
- main_tweet ≤ 280 characters (NOT 281 — Twitter API rejects)
- Exactly 3–4 hashtags: first MUST be the trending tag
- Thread: 2-3 follow-up tweets for context

Output ONLY valid JSON:
{
  "platform": "twitter",
  "main_tweet": "...",
  "thread": ["...", "..."],
  "hashtags": ["#Trending", "#HousingCom", "#City"],
  "char_count": 0,
  "validation": {"passed": true, "issues": []}
}
"""

INSTAGRAM_SYSTEM = """
You are the Instagram agent for Housing.com.
Take a creative draft and produce an Instagram caption.

Hard constraints:
- Caption ≤ 2200 characters
- 15–20 hashtags (Instagram discovery algorithm rewards this range)
- First line must be a hook (stops the scroll)
- CTA in last line

Output ONLY valid JSON:
{
  "platform": "instagram",
  "caption": "...",
  "hashtags": ["#Tag1", "..."],
  "cta": "...",
  "media_prompt": "..."
}
"""


async def twitter_agent(draft: dict) -> dict:
    resp = await asyncio.to_thread(
        client.messages.create,
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=TWITTER_SYSTEM,
        messages=[{"role": "user", "content": f"Draft:\n{json.dumps(draft, indent=2)}"}]
    )
    text = resp.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    post = json.loads(text)
    # Enforce char count validation
    tweet = post.get("main_tweet", "")
    if len(tweet) > 280:
        post["validation"] = {"passed": False, "issues": [f"Tweet is {len(tweet)} chars — exceeds 280 limit"]}
    return post


async def instagram_agent(draft: dict) -> dict:
    resp = await asyncio.to_thread(
        client.messages.create,
        model="claude-sonnet-4-6",
        max_tokens=768,
        system=INSTAGRAM_SYSTEM,
        messages=[{"role": "user", "content": f"Draft:\n{json.dumps(draft, indent=2)}"}]
    )
    text = resp.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text)


async def failing_platform_agent(draft: dict) -> dict:
    """Simulates a rate-limited / broken platform agent."""
    await asyncio.sleep(0.1)
    raise RuntimeError("Instagram API rate limit exceeded (HTTP 429)")


PLATFORM_AGENTS = {
    "twitter": twitter_agent,
    "instagram": instagram_agent,
}


async def platform_orchestrator_node(state: PipelineState, simulate_failure: bool = False) -> dict:
    """
    Run all platform agents in parallel.
    return_exceptions=True prevents ONE failure from discarding ALL results.
    """
    tasks = []
    task_labels = []

    for draft in state["creative_drafts"]:
        for platform in draft.get("target_platforms", []):
            if simulate_failure and platform == "instagram":
                tasks.append(failing_platform_agent(draft))
            elif platform in PLATFORM_AGENTS:
                tasks.append(PLATFORM_AGENTS[platform](draft))
            task_labels.append(f"{platform}")

    results = await asyncio.gather(
        *tasks,
        return_exceptions=True   # ← the key argument
    )

    posts, errors = [], []
    for label, r in zip(task_labels, results):
        if isinstance(r, Exception):
            errors.append({"platform": label, "error": str(r)})
            print(f"  ✗ {label}: {r}")
        else:
            posts.append(r)
            print(f"  ✓ {label}: post generated")

    if errors:
        print(f"\n  {len(errors)} agent(s) failed — but {len(posts)} post(s) saved")

    return {"platform_posts": posts}


# --- Demo ---

SOCIAL_DRAFT = {
    "draft_type": "social",
    "angle": "Coldplay sold out in 8 min but stamp duty savings open all day",
    "hook": "Coldplay ticket ya stamp duty savings — dono ek din mila Mumbai ko",
    "headline": "Mumbai Stamp Duty Cut: 3% for First-Time Buyers",
    "hashtags": ["#StampDuty", "#MumbaiRealEstate", "#HousingCom"],
    "trend_hashtag": "#StampDuty",
    "target_platforms": ["twitter", "instagram"],
    "media_format": "image_card",
}


async def main():
    state: PipelineState = {
        "topic": "Mumbai stamp duty reduction",
        "research": [],
        "trends": [],
        "content_briefs": [],
        "creative_drafts": [SOCIAL_DRAFT],
        "platform_posts": [],
    }

    print("=" * 60)
    print("SCENARIO 1: All agents succeed")
    print("=" * 60)
    result = await platform_orchestrator_node(state, simulate_failure=False)
    print(f"\n→ {len(result['platform_posts'])} post(s) ready for QA")

    print("\n" + "=" * 60)
    print("SCENARIO 2: Instagram agent fails (rate limit)")
    print("  with return_exceptions=True → Twitter post PRESERVED")
    print("=" * 60)
    result_partial = await platform_orchestrator_node(state, simulate_failure=True)
    print(f"\n→ {len(result_partial['platform_posts'])} post(s) saved despite 1 failure")

    print("\n" + "=" * 60)
    print("Twitter post preview:")
    if result["platform_posts"]:
        post = result["platform_posts"][0]
        if post.get("platform") == "twitter":
            tweet = post.get("main_tweet", "")
            print(f"  Tweet ({len(tweet)} chars): {tweet}")
            val = post.get("validation", {})
            print(f"  Validation: {'✓ pass' if val.get('passed', True) else '✗ fail — ' + str(val.get('issues', []))}")


if __name__ == "__main__":
    asyncio.run(main())
