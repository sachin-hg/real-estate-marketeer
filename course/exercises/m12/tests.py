"""
Module 12 Tests — Capstone (Food Delivery Pipeline)
Run: pytest tests.py -v
"""

import asyncio
import importlib.util
import sys
import os
from typing import get_type_hints
from unittest.mock import AsyncMock, patch

import pytest


def _load_solution():
    """Load solution.py from this directory with a unique module name."""
    here = os.path.dirname(os.path.abspath(__file__))
    mod_name = "m12_solution"
    spec = importlib.util.spec_from_file_location(
        mod_name, os.path.join(here, "solution.py")
    )
    mod = importlib.util.module_from_spec(spec)
    # Register in sys.modules so get_type_hints() can resolve forward refs
    sys.modules[mod_name] = mod
    spec.loader.exec_module(mod)
    return mod


solution = _load_solution()


# ─── Helper ──────────────────────────────────────────────────────────────────

def run(coro):
    """Convenience wrapper for running coroutines in sync tests."""
    return asyncio.run(coro)


# ─── Test 1: WorkflowState has >= 6 fields ───────────────────────────────────

def test_state_has_required_fields():
    """
    WorkflowState must define at least 6 typed fields.
    The capstone checklist requires: run_id, topic, search_results,
    briefs, raw_posts, approved_posts (and ideally rejected_posts, cost_estimate).
    """
    hints = get_type_hints(solution.WorkflowState)
    field_count = len(hints)

    assert field_count >= 6, (
        f"WorkflowState should have >= 6 fields for the capstone, "
        f"but only {field_count} found: {list(hints.keys())}"
    )

    required = {"run_id", "topic", "briefs", "approved_posts"}
    missing  = required - set(hints.keys())
    assert not missing, (
        f"WorkflowState is missing required fields: {missing}"
    )


# ─── Test 2: planner filters off-topic trends ────────────────────────────────

def test_planner_filters_off_topic():
    """
    planner_agent must skip search results that are off-topic (elections,
    politics, etc.) and produce zero briefs for those results.
    """
    off_topic_results = [
        "Off-topic: National election results announced today",
        "BJP wins state election in Maharashtra",
        "Congress responds to political controversy",
    ]
    food_results = [
        "Trend: Biryani delivery up 40% in Bengaluru",
    ]

    async def _run():
        state = {
            "run_id":         "test-001",
            "topic":          "test",
            "search_results": off_topic_results + food_results,
            "briefs":         [],
            "raw_posts":      [],
            "approved_posts": [],
            "rejected_posts": [],
            "cost_estimate":  0.0,
        }
        return await solution.planner_agent(state)

    result = run(_run())
    briefs = result.get("briefs", [])

    # Off-topic results must generate 0 briefs
    off_topic_in_briefs = [
        b for b in briefs
        if any(kw in b.get("topic", "").lower()
               for kw in ["election", "bjp", "congress", "off-topic"])
    ]
    assert len(off_topic_in_briefs) == 0, (
        f"planner_agent should filter off-topic trends, but these slipped through: "
        f"{off_topic_in_briefs}"
    )

    # Food result must generate exactly 1 brief
    food_briefs = [b for b in briefs if "biryani" in b.get("topic", "").lower()]
    assert len(food_briefs) == 1, (
        f"planner_agent should generate 1 brief for the food trend, got {len(food_briefs)}"
    )


# ─── Test 3: platform_orchestrator handles one failure gracefully ─────────────

def test_platform_orchestrator_handles_failure():
    """
    If one platform agent raises an exception, the others should still
    complete successfully.  return_exceptions=True is the key pattern.
    """
    good_post  = {"brief_id": 0, "platform": "instagram", "content": "Great biryani deal!"}
    error_post = {"brief_id": 1, "platform": "twitter",   "content": "Test post"}

    async def _run():
        state = {
            "run_id":         "test-002",
            "topic":          "test",
            "search_results": [],
            "briefs":         [],
            "raw_posts":      [good_post, error_post],
            "approved_posts": [],
            "rejected_posts": [],
            "cost_estimate":  0.0,
        }
        # Patch twitter_agent to raise
        with patch.object(solution, "twitter_agent",
                          new=AsyncMock(side_effect=RuntimeError("Twitter API down"))):
            return await solution.platform_orchestrator(state)

    result        = run(_run())
    formatted     = result.get("raw_posts", [])

    # Instagram post should still succeed
    assert len(formatted) >= 1, (
        "platform_orchestrator should return successful results even when one agent fails"
    )
    platforms = [p.get("platform") for p in formatted]
    assert "instagram" in platforms, (
        f"Instagram post should succeed even when Twitter agent fails. Got: {platforms}"
    )


# ─── Test 4: qa_agent rejects unsafe content ─────────────────────────────────

def test_qa_rejects_unsafe_content():
    """
    qa_agent must reject posts containing political party names.
    Blocked keywords include: bjp, congress, aap, election, modi, etc.
    """
    unsafe_posts = [
        {"brief_id": 0, "platform": "instagram",
         "content": "BJP endorses our biryani — order now!"},
        {"brief_id": 1, "platform": "twitter",
         "content": "Election special: 50% off on all orders"},
    ]
    safe_post = {
        "brief_id": 2, "platform": "linkedin",
        "content": "Fresh cloud kitchen partnerships in Bengaluru — order today!",
    }

    async def _run():
        state = {
            "run_id":         "test-003",
            "topic":          "test",
            "search_results": [],
            "briefs":         [],
            "raw_posts":      unsafe_posts + [safe_post],
            "approved_posts": [],
            "rejected_posts": [],
            "cost_estimate":  0.0,
        }
        return await solution.qa_agent(state)

    result   = run(_run())
    approved = result.get("approved_posts", [])
    rejected = result.get("rejected_posts", [])

    # Unsafe posts must be rejected
    assert len(rejected) >= 2, (
        f"qa_agent should reject at least 2 unsafe posts, "
        f"but only {len(rejected)} were rejected"
    )

    rejected_reasons = [r.get("reason") for r in rejected]
    assert "safety_fail" in rejected_reasons, (
        f"Rejected posts should have reason='safety_fail', got: {rejected_reasons}"
    )

    # Safe post must be approved
    approved_contents = [p.get("content", "") for p in approved]
    assert any("cloud kitchen" in c.lower() for c in approved_contents), (
        f"Safe post should be approved; approved posts: {approved_contents}"
    )


# ─── Test 5: end-to-end pipeline returns approved posts ──────────────────────

def test_pipeline_end_to_end():
    """
    run_pipeline("test topic") should return a state dict with:
      - approved_posts being a non-empty list
      - all required WorkflowState fields present
    """
    result = run(solution.run_pipeline("IPL food delivery campaign"))

    # Must return a dict (WorkflowState)
    assert isinstance(result, dict), (
        f"run_pipeline() should return a dict, got {type(result).__name__}"
    )

    # Must have required fields
    for field in ["run_id", "topic", "briefs", "approved_posts", "rejected_posts"]:
        assert field in result, (
            f"Pipeline result missing field: '{field}'"
        )

    # Must produce at least 1 approved post (the mock search has 4 food trends)
    approved = result.get("approved_posts", [])
    assert len(approved) > 0, (
        f"run_pipeline() should return at least 1 approved post, "
        f"but approved_posts is empty.\n"
        f"  briefs={len(result.get('briefs',[]))}  "
        f"  raw_posts might have all been rejected: {result.get('rejected_posts', [])}"
    )

    # Cost estimate must be positive when we have approved posts
    cost = result.get("cost_estimate", 0.0)
    assert isinstance(cost, float), "cost_estimate should be a float"
    assert cost >= 0, "cost_estimate should be non-negative"
