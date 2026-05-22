"""
Module 12 — Capstone Starter
==============================
Domain: Food delivery (Swiggy-style)

Your task: implement the four TODO items below to build a complete
multi-agent pipeline that:
  1. Researches trending food topics
  2. Plans content briefs (with OMIT filter for off-topic trends)
  3. Creates platform-specific creative content (with few-shot hooks)
  4. Runs platform agents in parallel (return_exceptions=True)
  5. QA checks for safety + quality (2-pass)
  6. Outputs approved posts with cost estimate

Capstone checklist (8 requirements):
  [ ] 1. WorkflowState has >= 6 fields
  [ ] 2. planner_agent filters off-topic trends with OMIT instruction
  [ ] 3. planner_agent generates one brief per relevant topic
  [ ] 4. creative_agent injects few-shot examples (hooks bank)
  [ ] 5. platform_orchestrator uses asyncio.gather(return_exceptions=True)
  [ ] 6. qa_agent runs 2-pass QA (safety pass + quality pass)
  [ ] 7. qa_agent blocks posts with political party names
  [ ] 8. run_pipeline() returns state with approved_posts list

Run:
    python starter.py
    pytest tests.py
"""

import asyncio
import json
import uuid
from typing import TypedDict, Optional


# ─── 1. WorkflowState ────────────────────────────────────────────────────────

class WorkflowState(TypedDict):
    run_id:          str
    topic:           str
    search_results:  list[str]
    briefs:          list[dict]
    raw_posts:       list[dict]
    approved_posts:  list[dict]
    rejected_posts:  list[dict]
    cost_estimate:   float


# ─── 2. Mock search tool ─────────────────────────────────────────────────────

def mock_search(query: str) -> list[str]:
    """Simulate a web search — returns trend snippets."""
    results = {
        "swiggy food trends": [
            "Trend: Biryani delivery up 40% in Bengaluru during IPL",
            "Trend: Healthy bowl combos growing 25% month-over-month",
            "Trend: Late-night dessert orders spike on weekends",
            "Off-topic: National election results announced today",
            "Trend: Cloud kitchen partnerships expanding in tier-2 cities",
        ],
        "food delivery marketing": [
            "Hook: '11 PM hunger? We've got you.'",
            "Hook: 'Office lunch sorted in 30 minutes.'",
            "Hook: 'Your cheat day deserves the best biryani.'",
        ],
    }
    return results.get(query, [f"Generic result for: {query}"])


# ─── 3. researcher_agent (pre-filled) ────────────────────────────────────────

async def researcher_agent(state: WorkflowState) -> dict:
    """Search for trending topics related to the pipeline topic."""
    query   = f"swiggy food trends"
    results = mock_search(query)
    return {"search_results": results}


# ─── 4. planner_agent ────────────────────────────────────────────────────────

async def planner_agent(state: WorkflowState) -> dict:
    """
    Convert search results into content briefs.

    TODO A: Add an OMIT instruction + filter off-topic results.
    -----------------------------------------------------------
    Requirement: any search result that is "off-topic" (not about food
    delivery) should produce zero briefs.  Use a simple keyword check
    (e.g. skip results that contain "election", "politics", or party names).

    After filtering, generate one brief dict per remaining result:
        {"id": <int>, "topic": <str>, "platform": <str>, "hook_style": <str>}

    Hint: look at the mock_search results to see which one is off-topic.
    """
    search_results = state.get("search_results", [])
    briefs = []

    # TODO A: Filter off-topic results and generate briefs
    # Replace this placeholder with your implementation
    for i, result in enumerate(search_results):
        # PLACEHOLDER — generates a brief for every result including off-topic ones
        # Fix: skip off-topic results
        brief = {
            "id":         i,
            "topic":      result,
            "platform":   "instagram",
            "hook_style": "emotional",
        }
        briefs.append(brief)

    return {"briefs": briefs}


# ─── 5. creative_agent ───────────────────────────────────────────────────────

async def creative_agent(state: WorkflowState) -> dict:
    """
    Generate platform-specific creative content for each brief.

    TODO B: Inject few-shot examples from the hooks bank.
    -------------------------------------------------------
    The HOOKS_BANK below has example posts by style.
    Each brief has a "hook_style" field.
    Inject the matching few-shot example into the prompt before generating.

    Output: list of dicts with keys: brief_id, platform, content, hook_used
    """
    HOOKS_BANK = {
        "emotional": [
            "11 PM, long day, don't cook. We deliver happiness.",
            "Missing home food? Let us bring it to you.",
        ],
        "data": [
            "40% of Bengaluru ordered biryani last weekend. Join them.",
            "Avg delivery time: 28 min. Your lunch break is safe.",
        ],
        "urgency": [
            "Last chance: 50% off ends at midnight.",
            "Only 3 slots left for tomorrow's breakfast delivery.",
        ],
    }

    briefs    = state.get("briefs", [])
    raw_posts = []

    for brief in briefs:
        hook_style   = brief.get("hook_style", "emotional")
        # TODO B: Fetch few-shot examples from HOOKS_BANK and include in prompt
        few_shot     = ""   # ← replace with actual hooks from HOOKS_BANK

        prompt = f"Brief: {brief['topic']}\nStyle: {hook_style}\n{few_shot}"

        # Mock LLM output
        content = f"[{brief['platform'].upper()}] {brief['topic'][:50]} — order now! 🛵"

        raw_posts.append({
            "brief_id":  brief["id"],
            "platform":  brief["platform"],
            "content":   content,
            "hook_used": few_shot[:40] if few_shot else "none",
        })

    return {"raw_posts": raw_posts}


# ─── 6. platform_orchestrator ────────────────────────────────────────────────

async def instagram_agent(post: dict) -> dict:
    """Format a post for Instagram."""
    return {**post, "platform": "instagram", "formatted": True}


async def twitter_agent(post: dict) -> dict:
    """Format a post for Twitter/X (max 280 chars)."""
    content = post["content"][:280]
    return {**post, "platform": "twitter", "content": content, "formatted": True}


async def linkedin_agent(post: dict) -> dict:
    """Format a post for LinkedIn."""
    return {**post, "platform": "linkedin", "formatted": True}


async def platform_orchestrator(state: WorkflowState) -> dict:
    """
    Run all platform agents in parallel.
    return_exceptions=True ensures one failure does not abort others.
    Students should fill in the agent calls inside asyncio.gather().
    """
    raw_posts = state.get("raw_posts", [])
    tasks     = []

    for post in raw_posts:
        platform = post.get("platform", "instagram")
        if platform == "instagram":
            tasks.append(instagram_agent(post))
        elif platform == "twitter":
            tasks.append(twitter_agent(post))
        elif platform == "linkedin":
            tasks.append(linkedin_agent(post))
        else:
            tasks.append(instagram_agent(post))   # default

    # asyncio.gather with return_exceptions=True:
    # If one platform agent raises, the others still complete.
    results = await asyncio.gather(*tasks, return_exceptions=True)

    formatted_posts = [r for r in results if isinstance(r, dict)]
    return {"raw_posts": formatted_posts}


# ─── 7. qa_agent ─────────────────────────────────────────────────────────────

# Political party names / off-topic keywords to block
_BLOCKED_KEYWORDS = [
    "bjp", "congress", "aap", "election", "vote", "modi", "rahul gandhi",
    "political party", "parliament",
]


async def qa_agent(state: WorkflowState) -> dict:
    """
    2-pass QA: safety pass then quality pass.

    TODO C: Implement 2-pass QA.
    ----------------------------
    Pass 1 — Safety:
      Block any post whose content (lowercased) contains a keyword from
      _BLOCKED_KEYWORDS.  Move blocked posts to rejected_posts with
      reason="safety_fail".

    Pass 2 — Quality:
      Approve posts with content length >= 20 chars.
      Reject shorter posts with reason="quality_fail".

    Return {"approved_posts": [...], "rejected_posts": [...]}
    """
    posts          = state.get("raw_posts", [])
    approved_posts = []
    rejected_posts = []

    # TODO C: Implement 2-pass QA
    # PLACEHOLDER — approves everything; fix by adding safety + quality checks
    for post in posts:
        approved_posts.append(post)

    return {"approved_posts": approved_posts, "rejected_posts": rejected_posts}


# ─── 8. run_pipeline ─────────────────────────────────────────────────────────

async def run_pipeline(topic: str = "food delivery trends") -> WorkflowState:
    """
    Orchestrate all agents in sequence and return the final state.
    Already wired — students just need to implement the agents above.
    """
    run_id: str = str(uuid.uuid4())

    state: WorkflowState = {
        "run_id":          run_id,
        "topic":           topic,
        "search_results":  [],
        "briefs":          [],
        "raw_posts":       [],
        "approved_posts":  [],
        "rejected_posts":  [],
        "cost_estimate":   0.0,
    }

    # Sequential pipeline
    for agent_fn in [
        researcher_agent,
        planner_agent,
        creative_agent,
        platform_orchestrator,
        qa_agent,
    ]:
        update = await agent_fn(state)
        state.update(update)

    # Rough cost estimate: $0.003 per post (Sonnet)
    state["cost_estimate"] = len(state.get("approved_posts", [])) * 0.003

    return state


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    result = asyncio.run(run_pipeline("IPL food delivery campaign"))

    print(f"run_id:          {result['run_id'][:8]}...")
    print(f"briefs:          {len(result['briefs'])}")
    print(f"approved_posts:  {len(result['approved_posts'])}")
    print(f"rejected_posts:  {len(result['rejected_posts'])}")
    print(f"cost_estimate:   ${result['cost_estimate']:.4f}")
    print("\nApproved posts:")
    for post in result["approved_posts"]:
        print(f"  [{post.get('platform','?')}] {post.get('content','')[:70]}")
