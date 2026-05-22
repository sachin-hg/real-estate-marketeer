"""
Module 6 Tests — The Planner Pattern
Run: pytest tests.py -v
"""
import pytest
import json
from unittest.mock import patch, MagicMock

# Import from solution for reference tests
import sys, os
sys.path.insert(0, os.path.dirname(__file__))


def make_mock_message(content: str):
    msg = MagicMock()
    msg.content = [MagicMock()]
    msg.content[0].text = content
    return msg


class TestPlannerOmitInstruction:
    """The OMIT instruction must be present in the system prompt."""

    def test_system_prompt_contains_omit(self):
        from solution import PLANNER_SYSTEM
        assert "OMIT" in PLANNER_SYSTEM, (
            "PLANNER_SYSTEM must contain an OMIT instruction that tells the model "
            "to skip topics with no housing angle"
        )

    def test_omit_mentions_housing_angle(self):
        from solution import PLANNER_SYSTEM
        lower = PLANNER_SYSTEM.lower()
        assert "housing" in lower and ("angle" in lower or "connection" in lower), (
            "OMIT instruction should reference the housing angle requirement"
        )

    def test_off_topic_examples_listed(self):
        from solution import PLANNER_SYSTEM
        lower = PLANNER_SYSTEM.lower()
        has_entertainment = "entertainment" in lower or "celebrity" in lower or "gossip" in lower
        has_sports = "sports" in lower or "cricket" in lower or "ipl" in lower
        assert has_entertainment or has_sports, (
            "System prompt should give examples of content types to OMIT"
        )


class TestPlannerNode:
    """planner_node should filter off-topic trends."""

    def _make_filtered_response(self):
        # Only housing-relevant briefs — Coldplay and IPL omitted
        return json.dumps([
            {
                "topic": "Mumbai stamp duty reduced to 3%",
                "angle": "First-time buyer savings",
                "draft_type": "social",
                "target_platforms": ["twitter", "instagram"],
                "tone": "hinglish_viral",
                "urgency": "breaking",
                "source_summary": "Stamp duty cut announced",
                "city_hint": "Mumbai",
                "seo_keywords": ["stamp duty Mumbai"],
            }
        ])

    @patch("solution.client")
    def test_returns_list(self, mock_client):
        mock_client.messages.create.return_value = make_mock_message(
            self._make_filtered_response()
        )
        from solution import planner_node
        result = planner_node(
            [{"title": "Stamp duty cut", "content": "3% for first buyers"}],
            [{"platform": "twitter", "hashtag": "#StampDuty", "context": "Housing related"}],
            "affordable housing",
        )
        assert isinstance(result, list)

    @patch("solution.client")
    def test_brief_has_required_fields(self, mock_client):
        mock_client.messages.create.return_value = make_mock_message(
            self._make_filtered_response()
        )
        from solution import planner_node
        result = planner_node(
            [{"title": "Stamp duty cut", "content": "3% for first buyers"}],
            [{"platform": "twitter", "hashtag": "#StampDuty", "context": "Housing"}],
            "affordable housing",
        )
        assert len(result) > 0
        brief = result[0]
        for field in ("topic", "draft_type", "target_platforms", "tone"):
            assert field in brief, f"ContentBrief missing field: {field}"

    @patch("solution.client")
    def test_uses_fast_model(self, mock_client):
        mock_client.messages.create.return_value = make_mock_message("[]")
        from solution import planner_node
        planner_node([], [], "test")
        call_kwargs = mock_client.messages.create.call_args[1]
        model = call_kwargs.get("model", "")
        assert "haiku" in model or "flash" in model, (
            f"Planner should use a fast/cheap model (haiku or flash), got: {model}"
        )

    @patch("solution.client")
    def test_handles_invalid_json_gracefully(self, mock_client):
        mock_client.messages.create.return_value = make_mock_message("not valid json {{")
        from solution import planner_node
        result = planner_node([], [], "test")
        assert result == [], "Should return empty list on JSON parse failure"
