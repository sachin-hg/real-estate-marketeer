"""
Module 11 Tests — Observability & Feedback Loops
Run: pytest tests.py -v
"""

import importlib.util
import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest


def _load_solution():
    """Load solution.py from this directory with a unique module name."""
    here = os.path.dirname(os.path.abspath(__file__))
    spec = importlib.util.spec_from_file_location(
        "m11_solution", os.path.join(here, "solution.py")
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


solution = _load_solution()


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def fresh_db(tmp_path):
    """Give each test its own SQLite DB so they don't interfere."""
    db_file = str(tmp_path / "test.db")
    solution._setup_db(db_file)
    yield db_file
    # cleanup handled by tmp_path fixture


@pytest.fixture()
def seeded_db(fresh_db):
    """A DB pre-populated with sample historical posts."""
    import sqlite3
    from datetime import datetime
    conn = sqlite3.connect(fresh_db)
    sample = [
        ("instagram", "Monsoon sale — 3 BHK at ₹80 L", 4.8, "seed-1"),
        ("twitter",   "Data: prices up 12% YoY",       4.2, "seed-2"),
        ("linkedin",  "Boring generic ad",              0.9, "seed-3"),
        ("instagram", "Festival offer 2 BHK",           3.5, "seed-4"),
        ("twitter",   "Generic price list",             0.5, "seed-5"),
    ]
    for platform, snippet, eng, rid in sample:
        conn.execute(
            "INSERT INTO posts (ts, platform, content_snippet, engagement, run_id) VALUES (?,?,?,?,?)",
            (datetime.utcnow().isoformat(), platform, snippet, eng, rid),
        )
    conn.commit()
    conn.close()
    return fresh_db


# ─── Helper: make a minimal state ────────────────────────────────────────────

def _make_state(briefs=None) -> dict:
    return {
        "run_id": "test-run-001",
        "topic":  "test topic",
        "briefs": briefs or ["2 BHK in Powai"],
        "posts":  [],
    }


# ─── Test 1: performance_context called inside the node ──────────────────────

def test_performance_context_called_inside_node(fresh_db):
    """
    social_creative_node() must call get_performance_history() internally.
    We patch it and confirm it was called when we invoke the node.
    """
    with patch.object(solution, "get_performance_history", return_value="") as mock_hist:
        solution.social_creative_node(_make_state())
        mock_hist.assert_called_once(), (
            "get_performance_history() was not called inside social_creative_node(). "
            "Did you fill in the TODO?"
        )


# ─── Test 2: performance_context appears in the creative prompt ───────────────

def test_performance_context_not_empty_string(seeded_db):
    """
    When the DB has post history, get_performance_history() returns a
    non-empty string and it should appear in the generated post prompt.
    """
    # Confirm get_performance_history returns non-empty for seeded DB
    history = solution.get_performance_history()
    assert history, (
        "get_performance_history() returned empty string even though DB has posts"
    )
    assert "TOP PERFORMERS" in history, (
        f"Expected 'TOP PERFORMERS' in history output, got: {history!r}"
    )

    # Run the node and verify the prompt includes the history
    result = solution.social_creative_node(_make_state())
    posts  = result["posts"]
    assert posts, "social_creative_node() returned no posts"

    # had_history flag should be True when DB has content
    assert posts[0]["had_history"], (
        "Post should have had_history=True when DB contains performance data"
    )

    # The prompt should contain the history text
    prompt = posts[0].get("prompt", "")
    assert "TOP PERFORMERS" in prompt or "PERFORMANCE HISTORY" in prompt, (
        f"The creative prompt should include performance history. Got prompt: {prompt!r}"
    )


# ─── Test 3: log_llm_call returns a positive cost ────────────────────────────

def test_log_llm_call_returns_cost(fresh_db):
    """
    log_llm_call("test", "sonnet_4_6", 1000, 200) should return a positive float.
    For Sonnet: cost = 1000/1M * $3 + 200/1M * $15 = $0.003 + $0.003 = $0.006
    """
    cost = solution.log_llm_call("test_node", "sonnet_4_6", 1000, 200)

    assert isinstance(cost, float), (
        f"log_llm_call() should return a float, got {type(cost).__name__}"
    )
    assert cost > 0, (
        f"log_llm_call() should return a positive cost, got {cost}"
    )

    # Rough sanity check: should be around $0.003–$0.01 for these token counts
    assert 0.001 <= cost <= 0.05, (
        f"Cost {cost} is outside expected range for 1000 input + 200 output Sonnet tokens"
    )


# ─── Test 4: write_summary_json creates the file ─────────────────────────────

def test_write_summary_json_creates_file(tmp_path, monkeypatch):
    """
    write_summary_json("test-run-001", {"total_cost": 0.85}) must create
    output/test-run-001/summary.json with the correct content.
    """
    # Run from tmp_path so "output/" doesn't pollute the repo
    monkeypatch.chdir(tmp_path)

    run_id = "test-run-001"
    stats  = {"total_cost": 0.85, "posts_approved": 3}

    result_path = solution.write_summary_json(run_id, stats)

    # File must exist
    assert result_path.exists(), (
        f"write_summary_json() should create {result_path}, but the file was not found"
    )

    # Content must be valid JSON with the expected fields
    data = json.loads(result_path.read_text())
    assert data["run_id"] == run_id, (
        f"summary.json should contain run_id={run_id!r}, got {data.get('run_id')!r}"
    )
    assert data["total_cost"] == pytest.approx(0.85), (
        f"summary.json should contain total_cost=0.85, got {data.get('total_cost')}"
    )
    assert "ts" in data, "summary.json should contain a 'ts' timestamp field"

    # Path structure must be output/{run_id}/summary.json
    assert result_path.parent.name == run_id, (
        f"File should be inside a directory named '{run_id}', "
        f"got parent dir: {result_path.parent.name!r}"
    )
    assert result_path.name == "summary.json", (
        f"File should be named 'summary.json', got {result_path.name!r}"
    )
