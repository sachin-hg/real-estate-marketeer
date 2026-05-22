"""
Module 12 — Capstone Solution
==============================
Domain: Food delivery (Swiggy-style)

All 8 requirements implemented:
  [x] 1. WorkflowState has >= 6 fields
  [x] 2. planner_agent filters off-topic trends with OMIT instruction
  [x] 3. planner_agent generates one brief per relevant topic
  [x] 4. creative_agent injects few-shot examples (hooks bank)
  [x] 5. platform_orchestrator uses asyncio.gather(return_exceptions=True)
  [x] 6. qa_agent runs 2-pass QA (safety pass + quality pass)
  [x] 7. qa_agent blocks posts with political party names
  [x] 8. run_pipeline() returns state with approved_posts list

RetryPolicy pattern (shown in comments — not wired to asyncio.gather here
since it requires LangGraph, but the config is shown for reference):
    from langgraph.pregel import RetryPolicy
    _retry = RetryPolicy(max_attempts=3, initial_interval=1.0, backoff_factor=2.0)
    # Applied to: researcher, planner, creative, qa
    # NOT applied to: publisher (idempotency constraint)

Run:
    python solution.py
    pytest tests.py
"""

import asyncio
import json
import uuid
from typing import TypedDict, Optional


# ─── RetryPolicy reference (LangGraph pattern) ───────────────────────────────
#
# from langgraph.pregel import RetryPolicy
# _retry = RetryPolicy(max_attempts=3, initial_interval=1.0, backoff_factor=2.0)
#
# graph.add_node("researcher",  researcher_agent,  retry=_retry)
# graph.add_node("planner",     planner_agent,     retry=_retry)
# graph.add_node("creative",    creative_agent,    retry=_retry)
# graph.add_node("qa",          qa_agent,          retry=_retry)
# graph.add_node("publisher",   publisher_agent,   retry=None)   # not idempotent


# ─── 1. WorkflowState (6+ fields) ────────────────────────────────────────────

class WorkflowState(TypedDict):
    run_id:          str           # field 1
    topic:           str           # field 2
    search_results:  list[str]     # field 3
    briefs:          list[dict]    # field 4
    raw_posts:       list[dict]    # field 5
    approved_posts:  list[dict]    # field 6
    rejected_posts:  list[dict]    # field 7
    cost_estimate:   float         # field 8


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


# ─── 3. researcher_agent ─────────────────────────────────────────────────────

async def researcher_agent(state: WorkflowState) -> dict:
    """Search for trending topics related to the pipeline topic."""
    results = mock_search("swiggy food trends")
    return {"search_results": results}


# ─── 4. planner_agent (SOLUTION: OMIT filter) ────────────────────────────────

# Keywords that make a search result off-topic for a food delivery campaign
_OMIT_KEYWORDS = [
    "election", "politics", "bjp", "congress", "aap", "vote",
    "modi", "rahul gandhi", "political party", "parliament",
    "off-topic",
]

# Platform rotation for variety across briefs
_PLATFORMS = ["instagram", "twitter", "linkedin"]

# Hook style rotation
_HOOK_STYLES = ["emotional", "data", "urgency"]


async def planner_agent(state: WorkflowState) -> dict:
    """
    Convert search results into content briefs.

    OMIT instruction (mocked):
        "If a search result is not about food delivery, mark it OMIT and
         do not generate a brief for it."

    In a real implementation this OMIT instruction would appear in the
    system prompt sent to the LLM.  Here we implement the filtering logic
    directly to keep the example runnable without an API key.
    """
    search_results = state.get("search_results", [])
    briefs         = []
    brief_id       = 0

    for result in search_results:
        result_lower = result.lower()

        # OMIT: skip off-topic results
        if any(kw in result_lower for kw in _OMIT_KEYWORDS):
            # In LLM mode the prompt would say:
            #   "If this topic is unrelated to food delivery, output: OMIT"
            # and we would check if the response == "OMIT" before continuing.
            continue

        briefs.append({
            "id":         brief_id,
            "topic":      result,
            "platform":   _PLATFORMS[brief_id % len(_PLATFORMS)],
            "hook_style": _HOOK_STYLES[brief_id % len(_HOOK_STYLES)],
        })
        brief_id += 1

    return {"briefs": briefs}


# ─── 5. creative_agent (SOLUTION: few-shot injection) ────────────────────────

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


async def creative_agent(state: WorkflowState) -> dict:
    """
    Generate platform-specific creative content for each brief.
    Injects few-shot examples from HOOKS_BANK into the prompt.
    """
    briefs    = state.get("briefs", [])
    raw_posts = []

    for brief in briefs:
        hook_style  = brief.get("hook_style", "emotional")
        # SOLUTION: fetch few-shot examples from HOOKS_BANK
        examples    = HOOKS_BANK.get(hook_style, HOOKS_BANK["emotional"])
        few_shot    = "\n".join(f"  - {ex}" for ex in examples)

        prompt = (
            f"Brief: {brief['topic']}\n"
            f"Platform: {brief['platform']}\n"
            f"Style: {hook_style}\n"
            f"Few-shot examples:\n{few_shot}\n\n"
            f"Generate a post in the same style."
        )

        # Mock LLM output — in production this would be an API call
        content = (
            f"[{brief['platform'].upper()}] "
            f"{brief['topic'][:40]}... {examples[0][:30]}"
        )

        raw_posts.append({
            "brief_id":  brief["id"],
            "platform":  brief["platform"],
            "content":   content,
            "prompt":    prompt,
            "hook_used": examples[0][:60],
        })

    return {"raw_posts": raw_posts}


# ─── 6. platform agents ──────────────────────────────────────────────────────

async def instagram_agent(post: dict) -> dict:
    return {**post, "platform": "instagram", "formatted": True}


async def twitter_agent(post: dict) -> dict:
    content = post["content"][:280]
    return {**post, "platform": "twitter", "content": content, "formatted": True}


async def linkedin_agent(post: dict) -> dict:
    return {**post, "platform": "linkedin", "formatted": True}


# ─── 7. platform_orchestrator (SOLUTION: return_exceptions=True) ─────────────

async def platform_orchestrator(state: WorkflowState) -> dict:
    """
    Run all platform agents in parallel.

    return_exceptions=True: if one platform agent raises, the result for
    that task is the Exception object instead of propagating.  Other agents
    still complete successfully.
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
            tasks.append(instagram_agent(post))

    # SOLUTION: return_exceptions=True — one failure does not abort all
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Filter out any exceptions; log them in a real pipeline
    formatted_posts = []
    for r in results:
        if isinstance(r, Exception):
            # In production: log the error and continue
            pass
        else:
            formatted_posts.append(r)

    return {"raw_posts": formatted_posts}


# ─── 8. qa_agent (SOLUTION: 2-pass QA) ──────────────────────────────────────

_BLOCKED_KEYWORDS = [
    "bjp", "congress", "aap", "election", "vote", "modi", "rahul gandhi",
    "political party", "parliament",
]


async def qa_agent(state: WorkflowState) -> dict:
    """
    2-pass QA: safety pass then quality pass.

    Pass 1 — Safety:
      Block posts containing political keywords → reason="safety_fail"

    Pass 2 — Quality:
      Require content length >= 20 chars → reason="quality_fail" if shorter
    """
    posts          = state.get("raw_posts", [])
    approved_posts = []
    rejected_posts = []

    for post in posts:
        content = post.get("content", "")
        content_lower = content.lower()

        # PASS 1: Safety — block political content
        if any(kw in content_lower for kw in _BLOCKED_KEYWORDS):
            rejected_posts.append({**post, "reason": "safety_fail"})
            continue

        # PASS 2: Quality — minimum content length
        if len(content) < 20:
            rejected_posts.append({**post, "reason": "quality_fail"})
            continue

        approved_posts.append(post)

    return {
        "approved_posts": approved_posts,
        "rejected_posts": rejected_posts,
    }


# ─── 9. run_pipeline ─────────────────────────────────────────────────────────

async def run_pipeline(topic: str = "food delivery trends") -> WorkflowState:
    """
    Orchestrate all agents in sequence and return the final state.
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

    for agent_fn in [
        researcher_agent,
        planner_agent,
        creative_agent,
        platform_orchestrator,
        qa_agent,
    ]:
        update = await agent_fn(state)
        state.update(update)

    # Cost estimate: Sonnet rates, ~500 tokens per post
    num_briefs          = len(state.get("briefs", []))
    state["cost_estimate"] = num_briefs * (500 / 1_000_000 * 3.0 + 150 / 1_000_000 * 15.0)

    return state


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    result = asyncio.run(run_pipeline("IPL food delivery campaign"))

    print(f"run_id:          {result['run_id'][:8]}...")
    print(f"search results:  {len(result['search_results'])}")
    print(f"briefs:          {len(result['briefs'])} (off-topic filtered out)")
    print(f"approved_posts:  {len(result['approved_posts'])}")
    print(f"rejected_posts:  {len(result['rejected_posts'])}")
    print(f"cost_estimate:   ${result['cost_estimate']:.4f}")

    print("\nApproved posts:")
    for post in result["approved_posts"]:
        print(f"  [{post.get('platform','?')}] {post.get('content','')[:70]}")

    if result["rejected_posts"]:
        print("\nRejected posts:")
        for post in result["rejected_posts"]:
            print(f"  [{post.get('platform','?')}] reason={post.get('reason')}  {post.get('content','')[:50]}")
