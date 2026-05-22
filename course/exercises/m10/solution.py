"""
Module 10 Exercise — Production Patterns (SOLUTION)
=====================================================
Both TODOs filled in:
  1. publisher_node → retry=None
  2. thread_id      → run_id

Run:
    python solution.py
    pytest tests.py
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

def get_node_config() -> dict:
    """
    Return the retry policy for each node.

    TODO 1 — ANSWER: publisher_node gets retry=None
    ------------------------------------------------
    Publishing is NOT idempotent. If publisher_node ran twice (e.g. the
    first attempt succeeded but the ack was lost), the same post would
    appear twice on Instagram/LinkedIn/Twitter.

    The correct pattern: let publisher fail fast.  A human or a
    deduplication-aware re-run can decide whether re-publishing is safe.

    In LangGraph syntax:
        graph.add_node("publisher", publisher_node, retry=None)
    """
    return {
        "researcher": {"retry": _retry},
        "planner":    {"retry": _retry},
        "creative":   {"retry": _retry},
        "qa":         {"retry": _retry},

        # SOLUTION: retry=None — publisher is not idempotent
        # Running twice = duplicate posts on social media platforms
        "publisher":  {"retry": None},
    }


# ─── Simulated ainvoke call ───────────────────────────────────────────────────

# Module-level storage so tests can inspect the last invoke config
_last_invoke_config: dict = {}


async def run_pipeline(topic: str) -> PipelineState:
    """
    Simulate a pipeline run with checkpointing.

    TODO 2 — ANSWER: thread_id = run_id
    ------------------------------------
    Each pipeline run needs its own checkpoint namespace so that:
      - Crashes can be resumed exactly where they stopped
      - Two concurrent runs don't overwrite each other's checkpoints
      - run_id is already unique (UUID4) and already in the state

    In LangGraph:
        await graph.ainvoke(state, config={"configurable": {"thread_id": run_id}})
    """
    global _last_invoke_config

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

    # SOLUTION: thread_id = run_id
    invoke_config = {
        "configurable": {
            "thread_id": run_id,   # ← each run gets its own checkpoint namespace
        }
    }

    _last_invoke_config = invoke_config

    print(f"Invoking pipeline  run_id={run_id[:8]}  thread_id={invoke_config['configurable']['thread_id'][:8]}...")
    return {**initial_state, "published": True}


# ─── Cost comparison helper ───────────────────────────────────────────────────

def calculate_monthly_cost(config: dict, runs_per_day: int = 2, days: int = 30) -> dict:
    """
    Calculate monthly LLM cost for a given model configuration.

    Args:
        config: dict mapping node names to their model tier cost.
        runs_per_day: pipeline runs per day (default 2)
        days:         days in the month (default 30)

    Returns:
        dict with keys: cost_per_run, monthly_cost, total_runs
    """
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
    all_opus = {node: {"input_per_1m": 15.0, "output_per_1m": 75.0}
                for node in ["researcher", "planner", "creative", "qa", "publisher"]}

    routed = {
        "researcher": {"input_per_1m": 0.80,  "output_per_1m":  4.00},
        "planner":    {"input_per_1m": 3.00,  "output_per_1m": 15.00},
        "creative":   {"input_per_1m": 15.00, "output_per_1m": 75.00},
        "qa":         {"input_per_1m": 3.00,  "output_per_1m": 15.00},
        "publisher":  {"input_per_1m": 0.80,  "output_per_1m":  4.00},
    }

    r_opus   = calculate_monthly_cost(all_opus)
    r_routed = calculate_monthly_cost(routed)

    print(f"All-Opus   — per run: ${r_opus['cost_per_run']:.4f}  "
          f"monthly (60 runs): ${r_opus['monthly_cost']:.2f}")
    print(f"Routed     — per run: ${r_routed['cost_per_run']:.4f}  "
          f"monthly (60 runs): ${r_routed['monthly_cost']:.2f}")
    savings = (1 - r_routed["monthly_cost"] / r_opus["monthly_cost"]) * 100
    print(f"Savings: {savings:.0f}%  (Opus only where brand voice quality matters: creative node)")


if __name__ == "__main__":
    print("Module 10 Exercise — Solution\n")

    cfg = get_node_config()
    print("Node retry policies:")
    for node, conf in cfg.items():
        policy = conf["retry"]
        if policy is None:
            label = "None  ← publisher: fail fast, not idempotent"
        else:
            label = f"RetryPolicy(max_attempts={policy.max_attempts}, backoff_factor={policy.backoff_factor})"
        print(f"  {node:<12} retry={label}")

    print()
    demo_cost_comparison()

    print()
    asyncio.run(run_pipeline("Mumbai real estate 2025"))
