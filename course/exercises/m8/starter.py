"""
Module 8 Exercise — Platform Agents & Structured Output
Your task: Add the argument that prevents one failing agent from
           discarding all other results in asyncio.gather().
"""
import asyncio
import json
import anthropic

client = anthropic.Anthropic()


async def twitter_agent(draft: dict) -> dict:
    """Succeeds and returns a Twitter post."""
    await asyncio.sleep(0.05)
    return {
        "platform": "twitter",
        "main_tweet": f"Test tweet for: {draft.get('topic', 'housing')} 🏠 #HousingCom",
        "hashtags": ["#HousingCom", "#RealEstate"],
    }


async def instagram_agent(draft: dict) -> dict:
    """Simulates an Instagram API failure (rate limit)."""
    await asyncio.sleep(0.05)
    raise RuntimeError("Instagram API rate limit exceeded (HTTP 429)")


async def youtube_agent(draft: dict) -> dict:
    """Succeeds and returns a YouTube short concept."""
    await asyncio.sleep(0.05)
    return {
        "platform": "youtube",
        "shorts_hook": f"Did you know? {draft.get('topic', 'housing news')} explained in 60 seconds",
    }


PLATFORM_AGENTS = {
    "twitter": twitter_agent,
    "instagram": instagram_agent,
    "youtube": youtube_agent,
}


async def platform_orchestrator(drafts: list[dict]) -> dict:
    tasks = []
    labels = []
    for draft in drafts:
        for platform in draft.get("target_platforms", []):
            if platform in PLATFORM_AGENTS:
                tasks.append(PLATFORM_AGENTS[platform](draft))
                labels.append(platform)

    # TODO: Add the argument that prevents Instagram's failure from
    #       discarding the Twitter and YouTube results.
    # Without this argument, asyncio.gather raises on the first exception —
    # all already-completed results are DISCARDED.
    # With it, exceptions are returned as values so you can handle each independently.
    results = await asyncio.gather(
        *tasks,
        ???
    )

    posts, errors = [], []
    for label, r in zip(labels, results):
        if isinstance(r, Exception):
            errors.append({"platform": label, "error": str(r)})
        else:
            posts.append(r)

    return {"posts": posts, "errors": errors}


DRAFT = {
    "topic": "Mumbai stamp duty cut",
    "target_platforms": ["twitter", "instagram", "youtube"],
}

if __name__ == "__main__":
    result = asyncio.run(platform_orchestrator([DRAFT]))
    print(f"Posts saved:  {len(result['posts'])}")
    print(f"Errors:       {len(result['errors'])}")
    for p in result["posts"]:
        print(f"  ✓ {p['platform']}")
    for e in result["errors"]:
        print(f"  ✗ {e['platform']}: {e['error']}")
    # Expected: 2 posts (twitter + youtube), 1 error (instagram)
