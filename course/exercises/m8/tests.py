"""
Module 8 Tests — Platform Agents & Structured Output
Run: pytest tests.py -v
"""
import asyncio
import pytest
import sys, os
sys.path.insert(0, os.path.dirname(__file__))


class TestReturnExceptions:
    """asyncio.gather must use return_exceptions=True."""

    def test_partial_failure_preserves_successful_results(self):
        """When Instagram fails, Twitter and YouTube posts must be preserved."""
        from solution import platform_orchestrator
        draft = {"topic": "test", "target_platforms": ["twitter", "instagram", "youtube"]}
        result = asyncio.run(platform_orchestrator([draft]))
        assert len(result["posts"]) == 2, (
            f"Expected 2 successful posts (twitter + youtube), got {len(result['posts'])}. "
            "Without return_exceptions=True, asyncio.gather raises on the first exception "
            "and all other results are discarded."
        )
        assert len(result["errors"]) == 1

    def test_failing_agent_recorded_as_error(self):
        """The Instagram failure must be captured, not silently swallowed."""
        from solution import platform_orchestrator
        draft = {"topic": "test", "target_platforms": ["instagram"]}
        result = asyncio.run(platform_orchestrator([draft]))
        assert len(result["errors"]) == 1
        assert result["errors"][0]["platform"] == "instagram"
        assert "rate limit" in result["errors"][0]["error"].lower() or "429" in result["errors"][0]["error"]

    def test_all_successful_agents_return_posts(self):
        """When no agent fails, all posts should be in results."""
        from solution import platform_orchestrator
        draft = {"topic": "test", "target_platforms": ["twitter", "youtube"]}
        result = asyncio.run(platform_orchestrator([draft]))
        assert len(result["posts"]) == 2
        assert len(result["errors"]) == 0

    def test_post_has_platform_field(self):
        """Each returned post must identify which platform it's for."""
        from solution import platform_orchestrator
        draft = {"topic": "test", "target_platforms": ["twitter"]}
        result = asyncio.run(platform_orchestrator([draft]))
        assert len(result["posts"]) == 1
        assert result["posts"][0].get("platform") == "twitter", (
            "Post dict must include a 'platform' field for downstream routing"
        )

    def test_empty_drafts_returns_empty_results(self):
        from solution import platform_orchestrator
        result = asyncio.run(platform_orchestrator([]))
        assert result["posts"] == []
        assert result["errors"] == []
