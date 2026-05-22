"""
Module 10 Tests — Production Patterns
Run: pytest tests.py -v
"""

import asyncio
import importlib.util
import pytest
import sys
import os


def _load_solution():
    """Load solution.py from this directory with a unique module name."""
    here = os.path.dirname(os.path.abspath(__file__))
    spec = importlib.util.spec_from_file_location(
        "m10_solution", os.path.join(here, "solution.py")
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


solution = _load_solution()


# ─── Test 1: publisher has no retry ──────────────────────────────────────────

def test_publisher_has_no_retry():
    """
    publisher_node config must have retry=None (or a falsy value).
    Publishing is not idempotent; retrying would create duplicate posts.
    """
    cfg = solution.get_node_config()
    assert "publisher" in cfg, "publisher key missing from get_node_config()"
    publisher_retry = cfg["publisher"].get("retry")
    assert not publisher_retry, (
        f"publisher_node should have retry=None to prevent duplicate posts, "
        f"but got: {publisher_retry!r}"
    )


# ─── Test 2: other nodes have a retry policy ─────────────────────────────────

def test_other_nodes_have_retry():
    """
    researcher, planner, creative, and qa nodes must each have a RetryPolicy
    with max_attempts >= 2 so transient errors are handled automatically.
    """
    cfg = solution.get_node_config()
    nodes_requiring_retry = ["researcher", "planner", "creative", "qa"]

    for node in nodes_requiring_retry:
        assert node in cfg, f"'{node}' key missing from get_node_config()"
        policy = cfg[node].get("retry")
        assert policy is not None, (
            f"'{node}' should have a RetryPolicy, but retry=None"
        )
        assert hasattr(policy, "max_attempts"), (
            f"'{node}' retry should be a RetryPolicy with max_attempts attribute"
        )
        assert policy.max_attempts >= 2, (
            f"'{node}' RetryPolicy.max_attempts should be >= 2, got {policy.max_attempts}"
        )


# ─── Test 3: thread_id equals run_id ─────────────────────────────────────────

def test_thread_id_is_run_id():
    """
    The ainvoke config must use run_id as thread_id so each pipeline run
    gets its own checkpoint namespace in AsyncSqliteSaver.
    """
    async def _run():
        state = await solution.run_pipeline("test topic")
        return state

    state = asyncio.run(_run())

    invoke_cfg = solution._last_invoke_config
    assert invoke_cfg, "run_pipeline() did not populate _last_invoke_config"

    configurable = invoke_cfg.get("configurable", {})
    thread_id    = configurable.get("thread_id")

    assert thread_id is not None, (
        "invoke_config['configurable']['thread_id'] is None — "
        "did you fill in TODO 2?"
    )
    assert thread_id == state["run_id"], (
        f"thread_id ({thread_id!r}) should equal state['run_id'] ({state['run_id']!r})"
    )


# ─── Test 4: retry policy uses exponential backoff ───────────────────────────

def test_retry_policy_exponential_backoff():
    """
    The shared _retry policy must use backoff_factor > 1.0 so retry intervals
    grow exponentially (1s, 2s, 4s) rather than being fixed.
    """
    policy = solution._retry

    assert hasattr(policy, "backoff_factor"), (
        "_retry must have a backoff_factor attribute"
    )
    assert policy.backoff_factor > 1.0, (
        f"backoff_factor must be > 1.0 for exponential backoff, "
        f"got {policy.backoff_factor} (that would be fixed-interval retries)"
    )

    # Verify intervals are strictly increasing
    intervals = policy.intervals()
    assert len(intervals) >= 1, "RetryPolicy must produce at least one retry interval"
    for i in range(1, len(intervals)):
        assert intervals[i] > intervals[i - 1], (
            f"Intervals should be strictly increasing (exponential), "
            f"but got {intervals}"
        )
