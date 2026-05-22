"""
Module 10 Exercise — Production Patterns
=========================================
Two TODOs:
  1. What retry policy should publisher_node use?
  2. What value should thread_id be for checkpointing?

Run:
    python starter.py

Learning goals:
  - Understand WHY publisher_node is special (idempotency)
  - Understand the thread_id=run_id checkpoint pattern
  - Calculate cost savings from model routing
"""

import asyncio
import uuid
from dataclasses import dataclass
from typing import TypedDict, Optional


# ─── RetryPolicy ─────────────────────────────────────────────────────────────

@dataclass
class RetryPolicy:
    """Mirrors the LangGraph RetryPolicy API."""
    max_attempts: int   = 3
    initial_interval: float = 1.0
    backoff_factor: float   = 2.0

    def intervals(self) -> list[float]:
        return [
            self.initial_interval * (self.backoff_factor ** i)
            for i in range(self.max_attempts - 1)
        ]


# Shared retry policy used by most nodes
_retry = RetryPolicy(max_attempts=3, initial_interval=1.0, backoff_factor=2.0)


# ─── State ────────────────────────────────────────────────────────────────────

class PipelineState(TypedDict):
    run_id:         str
    topic:          str
    research:       Optional[str]
    briefs:         Optional[list]
    posts:          Optional[list]
    approved_posts: Optional[list]
    published:      bool


# ─── Node configs ─────────────────────────────────────────────────────────────
#
# In LangGraph you pass `retry=` when calling graph.add_node():
#
#   graph.add_node("researcher", researcher_node, retry=_retry)
#
# We represent the same concept here as a plain dict so the exercise
# runs without langgraph installed.

def get_node_config() -> dict:
    """
    Return a dict describing the retry policy for each node.

    TODO 1: What should publisher_node's retry value be?
    -------------------------------------------------------
    Think about it: if publisher_node runs twice after a transient error,
    what happens on social media?

    Hint: the answer is a Python keyword, not a RetryPolicy instance.
    """
    return {
        "researcher": {"retry": _retry},
        "planner":    {"retry": _retry},
        "creative":   {"retry": _retry},
        "qa":         {"retry": _retry},

        # TODO 1: Replace ??? with the correct retry value for publisher_node
        # Hint: publishing is NOT idempotent — running twice creates duplicate posts.
        "publisher":  {"retry": ???},   # ← your answer here
    }


# ─── Simulated ainvoke call ───────────────────────────────────────────────────

async def run_pipeline(topic: str) -> PipelineState:
    """
    Simulate a pipeline run with checkpointing.

    TODO 2: Replace ??? with the correct value for thread_id.
    ----------------------------------------------------------
    The checkpoint system needs a stable, unique key per pipeline run.
    We already have such a value in the state.

    Hint: which field in PipelineState uniquely identifies this run?
    """
    run_id = str(uuid.uuid4())

    initial_state: PipelineState = {
        "run_id":         run_id,
        "topic":          topic,
        "research":       None,
        "briefs":         None,
        "posts":          None,
        "approved_posts": None,
        "published":      False,
    }

    # Simulated ainvoke call (real version uses graph.ainvoke)
    invoke_config = {
        "configurable": {
            # TODO 2: Replace ??? with the correct value
            # Hint: use the run_id variable defined above
            "thread_id": ???,   # ← your answer here
        }
    }

    print(f"Would invoke pipeline with thread_id = {invoke_config['configurable']['thread_id']}")
    return {**initial_state, "published": True}


# ─── Cost comparison helper ───────────────────────────────────────────────────

def calculate_monthly_cost(config: dict, runs_per_day: int = 2, days: int = 30) -> dict:
    """
    Calculate monthly LLM cost for a given model configuration.

    Args:
        config: dict mapping node names to their model tier cost.
                Keys: "researcher", "planner", "creative", "qa", "publisher"
                Values: dict with "input_per_1m" and "output_per_1m" prices

        runs_per_day: how many pipeline runs per day (default 2)
        days:         how many days in the month (default 30)

    Returns:
        dict with keys: cost_per_run, monthly_cost, total_runs

    Example usage:
        all_opus = {node: {"input_per_1m": 15.0, "output_per_1m": 75.0}
                    for node in ["researcher","planner","creative","qa","publisher"]}
        result = calculate_monthly_cost(all_opus)
        print(f"All-Opus monthly: ${result['monthly_cost']:.2f}")
    """
    # Approximate token usage per node per run
    usage = {
        "researcher": {"input_k": 4.0,  "output_k": 0.5},
        "planner":    {"input_k": 2.0,  "output_k": 0.8},
        "creative":   {"input_k": 3.0,  "output_k": 1.5},
        "qa":         {"input_k": 2.5,  "output_k": 0.6},
        "publisher":  {"input_k": 0.5,  "output_k": 0.1},
    }

    cost_per_run = 0.0
    for node, tok in usage.items():
        node_cfg = config.get(node, {"input_per_1m": 3.0, "output_per_1m": 15.0})
        cost_per_run += (
            tok["input_k"]  / 1000 * node_cfg["input_per_1m"]
            + tok["output_k"] / 1000 * node_cfg["output_per_1m"]
        )

    total_runs   = runs_per_day * days
    monthly_cost = cost_per_run * total_runs
    return {
        "cost_per_run": cost_per_run,
        "monthly_cost": monthly_cost,
        "total_runs":   total_runs,
    }


# ─── Demo ─────────────────────────────────────────────────────────────────────

def demo_cost_comparison():
    """Run this to see how much routing saves vs all-Opus."""

    all_opus = {node: {"input_per_1m": 15.0, "output_per_1m": 75.0}
                for node in ["researcher", "planner", "creative", "qa", "publisher"]}

    routed = {
        "researcher": {"input_per_1m": 0.80,  "output_per_1m":  4.00},  # Haiku
        "planner":    {"input_per_1m": 3.00,  "output_per_1m": 15.00},  # Sonnet
        "creative":   {"input_per_1m": 15.00, "output_per_1m": 75.00},  # Opus
        "qa":         {"input_per_1m": 3.00,  "output_per_1m": 15.00},  # Sonnet
        "publisher":  {"input_per_1m": 0.80,  "output_per_1m":  4.00},  # Haiku
    }

    r_opus   = calculate_monthly_cost(all_opus)
    r_routed = calculate_monthly_cost(routed)

    print(f"All-Opus   — per run: ${r_opus['cost_per_run']:.4f}  "
          f"monthly (60 runs): ${r_opus['monthly_cost']:.2f}")
    print(f"Routed     — per run: ${r_routed['cost_per_run']:.4f}  "
          f"monthly (60 runs): ${r_routed['monthly_cost']:.2f}")
    savings = (1 - r_routed["monthly_cost"] / r_opus["monthly_cost"]) * 100
    print(f"Savings: {savings:.0f}%")


if __name__ == "__main__":
    print("Module 10 Exercise — fill in the two ??? before running the tests.\n")

    # Cost comparison works even before the TODOs are filled in
    print("Cost comparison (no API key needed):")
    demo_cost_comparison()

    # Uncomment after filling in the TODOs:
    # asyncio.run(run_pipeline("Mumbai real estate 2025"))
