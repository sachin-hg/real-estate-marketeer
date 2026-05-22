"""
Module 9 Tests — QA: Agents Evaluating Agents
Run: pytest tests.py -v
"""
import pytest
import json
from unittest.mock import patch, MagicMock
import sys, os
sys.path.insert(0, os.path.dirname(__file__))


def make_mock_message(content: str):
    msg = MagicMock()
    msg.content = [MagicMock()]
    msg.content[0].text = content
    return msg


class TestSafetyGateExceptions:
    """PMAY and RERA government policy content must be explicitly ALLOWED."""

    def test_safety_system_contains_pmay_exception(self):
        from solution import SAFETY_SYSTEM
        assert "PMAY" in SAFETY_SYSTEM, (
            "SAFETY_SYSTEM must explicitly mention PMAY as an ALLOWED exception"
        )

    def test_safety_system_contains_rera_exception(self):
        from solution import SAFETY_SYSTEM
        assert "RERA" in SAFETY_SYSTEM, (
            "SAFETY_SYSTEM must mention RERA as an allowed policy topic"
        )

    def test_safety_system_contains_rbi_exception(self):
        from solution import SAFETY_SYSTEM
        assert "RBI" in SAFETY_SYSTEM, (
            "SAFETY_SYSTEM must mention RBI repo rate as allowed (affects home loan EMIs)"
        )

    def test_exception_block_is_distinct_from_hard_blocks(self):
        from solution import SAFETY_SYSTEM
        # Exception must appear as a positive carve-out, not mixed into the hard blocks
        exception_pos = SAFETY_SYSTEM.upper().find("EXCEPTION")
        block_pos = SAFETY_SYSTEM.upper().find("HARD BLOCK")
        assert exception_pos > block_pos, (
            "EXCEPTION section should appear AFTER the HARD BLOCKS section"
        )


class TestSafetyGateFunction:
    """safety_gate() must correctly pass/block based on content."""

    @patch("solution.client")
    def test_political_post_fails(self, mock_client):
        mock_client.messages.create.return_value = make_mock_message(
            '{"passed": false, "violations": ["named politician: BJP"], "categories": ["political"]}'
        )
        from solution import safety_gate
        result = safety_gate({"main_tweet": "BJP policy great!", "hashtags": []})
        assert result["passed"] is False

    @patch("solution.client")
    def test_pmay_post_passes(self, mock_client):
        mock_client.messages.create.return_value = make_mock_message(
            '{"passed": true, "violations": [], "categories": ["government_policy"]}'
        )
        from solution import safety_gate
        result = safety_gate({"main_tweet": "PMAY application open #PMAY", "hashtags": []})
        assert result["passed"] is True

    @patch("solution.client")
    def test_uses_fast_model(self, mock_client):
        mock_client.messages.create.return_value = make_mock_message(
            '{"passed": true, "violations": [], "categories": []}'
        )
        from solution import safety_gate
        safety_gate({"main_tweet": "test"})
        model = mock_client.messages.create.call_args[1].get("model", "")
        assert "haiku" in model or "flash" in model, (
            f"Safety gate must use a fast/cheap model (binary pass/fail), got: {model}"
        )


class TestRevisionLoop:
    """When quality decision is 'revise', the post must be re-run — not discarded."""

    @patch("solution.revise_post")
    @patch("solution.quality_scorer")
    @patch("solution.safety_gate")
    def test_revise_calls_revise_post(self, mock_safety, mock_quality, mock_revise):
        mock_safety.return_value = {"passed": True, "violations": []}
        # First call: revise; second call: publish
        mock_quality.side_effect = [
            {"overall": 0.55, "decision": "revise",
             "locked_elements": ["hook"], "revision_instructions": "tighten to 280 chars"},
            {"overall": 0.80, "decision": "publish"},
        ]
        mock_revise.return_value = {"platform": "twitter", "main_tweet": "revised tweet"}

        from solution import qa_pipeline
        result = qa_pipeline({"platform": "twitter", "main_tweet": "original tweet"})

        assert mock_revise.called, (
            "When quality decision is 'revise', revise_post() must be called "
            "to re-run the platform agent with specific instructions"
        )
        assert result["qa_decision"] == "publish"

    @patch("solution.revise_post")
    @patch("solution.quality_scorer")
    @patch("solution.safety_gate")
    def test_max_revisions_respected(self, mock_safety, mock_quality, mock_revise):
        mock_safety.return_value = {"passed": True, "violations": []}
        mock_quality.return_value = {
            "overall": 0.50, "decision": "revise",
            "locked_elements": [], "revision_instructions": "fix"
        }
        mock_revise.return_value = {"platform": "twitter", "main_tweet": "revised"}

        from solution import qa_pipeline
        result = qa_pipeline(
            {"platform": "twitter", "main_tweet": "bad post"},
            max_revisions=2,
        )

        assert result["qa_decision"] == "reject", (
            "After max_revisions attempts, post should be rejected, not stuck in infinite loop"
        )
        assert mock_revise.call_count <= 2

    @patch("solution.revise_post")
    @patch("solution.quality_scorer")
    @patch("solution.safety_gate")
    def test_publish_on_first_attempt_skips_revision(self, mock_safety, mock_quality, mock_revise):
        mock_safety.return_value = {"passed": True, "violations": []}
        mock_quality.return_value = {"overall": 0.85, "decision": "publish"}

        from solution import qa_pipeline
        result = qa_pipeline({"platform": "twitter", "main_tweet": "great post"})

        assert not mock_revise.called, "Should not revise a post that already passes quality"
        assert result["qa_decision"] == "publish"
