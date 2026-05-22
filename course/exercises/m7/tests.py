"""
Module 7 Tests — Creative Agents & Prompt Engineering
Run: pytest tests.py -v
"""
import pytest
import sys, os
sys.path.insert(0, os.path.dirname(__file__))


class TestGetExamples:
    """get_examples() must include both positive and negative examples."""

    def test_returns_string(self):
        from solution import get_examples
        result = get_examples(["stamp_duty", "mumbai"])
        assert isinstance(result, str)

    def test_includes_write_like_section(self):
        from solution import get_examples
        result = get_examples(["stamp_duty", "mumbai"])
        assert "WRITE LIKE" in result.upper(), (
            "get_examples() must include a 'WRITE LIKE THESE' section with positive examples"
        )

    def test_includes_do_not_write_section(self):
        from solution import get_examples
        result = get_examples(["stamp_duty", "mumbai"])
        assert "DO NOT" in result.upper() or "NOT WRITE" in result.upper(), (
            "get_examples() must include a 'DO NOT WRITE' section with negative examples"
        )

    def test_negative_examples_include_avoid_because(self):
        from solution import get_examples
        result = get_examples(["stamp_duty"])
        assert "avoid because" in result.lower() or "avoid_because" in result.lower(), (
            "Negative examples should include the 'avoid_because' explanation — "
            "the model needs to know WHY, not just what"
        )

    def test_tag_matching_returns_relevant_positive_examples(self):
        from solution import get_examples
        mumbai_result = get_examples(["mumbai", "stamp_duty"])
        bengaluru_result = get_examples(["bengaluru", "metro"])
        # Both should have positive examples since matching tags exist
        assert "Coldplay" in mumbai_result or "stamp" in mumbai_result.lower()
        assert "Whitefield" in bengaluru_result or "metro" in bengaluru_result.lower()

    def test_unmatched_tags_still_returns_negatives(self):
        from solution import get_examples
        # Tags that don't match any positive example
        result = get_examples(["completely_unknown_tag_xyz"])
        assert "DO NOT" in result.upper() or "NOT WRITE" in result.upper(), (
            "Negative examples should appear even when no positive tag matches"
        )

    def test_positive_examples_appear_before_negative(self):
        from solution import get_examples
        result = get_examples(["stamp_duty", "mumbai"])
        write_pos = result.upper().find("WRITE LIKE")
        not_write_pos = result.upper().find("DO NOT")
        if not_write_pos == -1:
            not_write_pos = result.upper().find("NOT WRITE")
        assert write_pos < not_write_pos, (
            "Positive examples (WRITE LIKE) should appear before negative examples (DO NOT WRITE)"
        )
