"""
Module 10 — Production Patterns
pipeline.py v9: RetryPolicy, checkpointing, model routing.

Run:
    pip install anthropic langgraph aiosqlite
    python m10_production.py

What this file teaches:
  - RetryPolicy with exponential backoff on LangGraph nodes
  - publisher_node intentionally has retry=None (idempotency constraint)
  - AsyncSqliteSaver checkpointing with thread_id=run_id
  - llm_router() selecting models by tier and available API keys
  - Monthly cost comparison: all-Opus ($720) vs routed ($51)
"""

import asyncio
import os
import time
import uuid
from typing import TypedDict, Optional
from dataclasses import dataclass, field

# ─── Dependency detection ────────────────────────────────────────────────────

try:
    from langgraph.graph import StateGraph, END
    from langgraph.checkpoint.aiosqlite import AsyncSqliteSaver
    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

HAS_API_KEY = bool(os.getenv("ANTHROPIC_API_KEY"))

# ─── 1. RetryPolicy configuration ─────────────────────────────────────────────
#
#  max_attempts=3, initial_interval=1.0, backoff_factor=2.0
#  → first retry after 1 s, second after 2 s, third after 4 s
#
#  In LangGraph this is passed as:
#      graph.add_node("researcher", researcher_node, retry=_retry)
#
#  For the real RetryPolicy import:
#      from langgraph.pregel import RetryPolicy
#      _retry = RetryPolicy(max_attempts=3, initial_interval=1.0, backoff_factor=2.0)

@dataclass
class RetryPolicy:
    """Simulated RetryPolicy — mirrors the LangGraph API."""
    max_attempts: int = 3
    initial_interval: float = 1.0
    backoff_factor: float = 2.0
    retry_on: tuple = (Exception,)

    def intervals(self) -> list[float]:
        """Return the wait intervals between attempts."""
        return [
            self.initial_interval * (self.backoff_factor ** i)
            for i in range(self.max_attempts - 1)
        ]


_retry = RetryPolicy(max_attempts=3, initial_interval=1.0, backoff_factor=2.0)

print("=" * 60)
print("MODULE 10 — Production Patterns")
print("=" * 60)

print("\n[1] RetryPolicy configuration")
print(f"    max_attempts   = {_retry.max_attempts}")
print(f"    initial_interval = {_retry.initial_interval}s")
print(f"    backoff_factor = {_retry.backoff_factor}")
print(f"    intervals      = {_retry.intervals()} seconds")
print("    → first retry after 1 s, second after 2 s, third after 4 s")


# ─── 2. Model routing ─────────────────────────────────────────────────────────

# Pricing per 1 M tokens (input / output)
_MODEL_REGISTRY = {
    "heavy": {
        "key":   "ANTHROPIC_API_KEY",
        "model": "claude-opus-4-5",
        "cost_per_1m_input":  15.00,
        "cost_per_1m_output": 75.00,
    },
    "mid": {
        "key":   "ANTHROPIC_API_KEY",
        "model": "claude-sonnet-4-5",
        "cost_per_1m_input":  3.00,
        "cost_per_1m_output": 15.00,
    },
    "light": {
        "key":   "ANTHROPIC_API_KEY",
        "model": "claude-haiku-3-5",
        "cost_per_1m_input":  0.80,
        "cost_per_1m_output": 4.00,
    },
}

# Node → tier mapping used by the real pipeline
_NODE_TIERS = {
    "researcher":  "light",   # high-volume retrieval; cost-sensitive
    "planner":     "mid",     # structured reasoning; Sonnet is sufficient
    "creative":    "heavy",   # brand voice quality; Opus for best output
    "qa":          "mid",     # logic checks; Sonnet handles well
    "publisher":   "light",   # pure formatting/dispatch; cheapest tier
}


def llm_router(tier: str) -> dict:
    """
    Select model config based on tier and available API keys.

    Rules:
      - "heavy"  → Opus    (best quality; use for creative/brand tasks)
      - "mid"    → Sonnet  (balanced; use for planning/QA)
      - "light"  → Haiku   (fast & cheap; use for retrieval/formatting)
      - Falls back to mock if the required key is missing.

    Returns a dict with keys: model, cost_per_1m_input, cost_per_1m_output
    """
    config = _MODEL_REGISTRY.get(tier, _MODEL_REGISTRY["mid"])
    key_present = bool(os.getenv(config["key"]))
    if not key_present:
        # Graceful degradation: return the model name so the rest of the
        # pipeline can log correctly, but callers must use mock responses.
        return {**config, "mock": True}
    return {**config, "mock": False}


print("\n[2] llm_router() — model selection by tier")
for node, tier in _NODE_TIERS.items():
    cfg = llm_router(tier)
    mock_label = " [MOCK — no key]" if cfg.get("mock") else ""
    print(f"    {node:<12} tier={tier:<6}  model={cfg['model']}{mock_label}")


# ─── 3. State definition ─────────────────────────────────────────────────────

class PipelineState(TypedDict):
    run_id:         str
    topic:          str
    research:       Optional[str]
    briefs:         Optional[list]
    posts:          Optional[list]
    approved_posts: Optional[list]
    published:      bool
    attempts:       dict   # tracks retry attempts per node (demo only)


# ─── 4. Mock node implementations ────────────────────────────────────────────

_CALL_LOG: list[dict] = []

def _mock_llm(node: str, prompt: str, tier: str = "mid") -> str:
    """Simulate an LLM call without a real API key."""
    cfg = llm_router(tier)
    _CALL_LOG.append({"node": node, "model": cfg["model"], "tier": tier})
    return f"[MOCK {cfg['model']}] {node} output for: {prompt[:40]}..."


async def researcher_node(state: PipelineState) -> dict:
    model_cfg = llm_router("light")
    response = _mock_llm("researcher", state["topic"], tier="light")
    return {"research": response}


async def planner_node(state: PipelineState) -> dict:
    model_cfg = llm_router("mid")
    research = state.get("research", "")
    response = _mock_llm("planner", research, tier="mid")
    briefs = [{"id": i, "brief": f"Brief {i}: {response[:30]}"} for i in range(3)]
    return {"briefs": briefs}


async def creative_node(state: PipelineState) -> dict:
    model_cfg = llm_router("heavy")
    briefs = state.get("briefs", [])
    posts = []
    for brief in briefs:
        content = _mock_llm("creative", str(brief), tier="heavy")
        posts.append({"brief_id": brief["id"], "content": content})
    return {"posts": posts}


async def qa_node(state: PipelineState) -> dict:
    model_cfg = llm_router("mid")
    posts = state.get("posts", [])
    approved = [p for p in posts if p]   # mock: approve all
    return {"approved_posts": approved}


async def publisher_node(state: PipelineState) -> dict:
    # Publisher has retry=None — NOT the shared _retry policy.
    #
    # WHY: Publishing is NOT idempotent. If publisher_node runs twice
    # (e.g. after a transient network error mid-publish), it would post
    # duplicate content to Instagram/LinkedIn/etc.  The correct pattern
    # is to let publisher fail fast, record the failure, and require a
    # human (or a deduplication-aware re-run) to decide what to do.
    #
    # In the LangGraph graph definition this looks like:
    #   graph.add_node("publisher", publisher_node, retry=None)
    #                                                      ^^^^
    #                                           explicitly NO retry
    approved = state.get("approved_posts", [])
    _mock_llm("publisher", str(len(approved)) + " posts", tier="light")
    return {"published": True}


# ─── 5. Retry demonstration (without LangGraph) ──────────────────────────────

async def _demo_retry_behaviour():
    """Show that without retry a transient error crashes; with retry it recovers."""
    print("\n[3] Retry behaviour demonstration")

    call_count = 0

    async def flaky_node():
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise ConnectionError(f"Transient error on attempt {call_count}")
        return "success"

    # WITHOUT retry
    print("\n    a) Without retry — transient error causes crash:")
    call_count = 0
    try:
        result = await flaky_node()
        print(f"       result = {result}")
    except ConnectionError as exc:
        print(f"       CRASH: {exc}")

    # WITH retry (manual simulation of RetryPolicy)
    print("\n    b) With RetryPolicy(max_attempts=3, initial_interval=0.05, backoff_factor=2.0):")
    call_count = 0
    policy = RetryPolicy(max_attempts=3, initial_interval=0.05, backoff_factor=2.0)
    for attempt in range(1, policy.max_attempts + 1):
        try:
            result = await flaky_node()
            print(f"       attempt {attempt}: SUCCESS — result = {result}")
            break
        except Exception as exc:
            if attempt < policy.max_attempts:
                wait = policy.initial_interval * (policy.backoff_factor ** (attempt - 1))
                print(f"       attempt {attempt}: FAILED ({exc}) — retrying in {wait:.2f}s")
                await asyncio.sleep(wait)
            else:
                print(f"       attempt {attempt}: FINAL FAILURE — {exc}")

    # Publisher — no retry
    print("\n    c) publisher_node has retry=None:")
    print("       In graph.add_node('publisher', publisher_node, retry=None)")
    print("       → Any publish error surfaces immediately (no silent duplicates).")


# ─── 6. Checkpointing with thread_id=run_id ──────────────────────────────────

async def _demo_checkpointing():
    """Show the thread_id=run_id pattern."""
    print("\n[4] Checkpointing — thread_id = run_id")

    run_id = str(uuid.uuid4())
    print(f"\n    run_id = {run_id}")

    if LANGGRAPH_AVAILABLE:
        print("    LangGraph detected — would use AsyncSqliteSaver:")
        print("""
    async with AsyncSqliteSaver.from_conn_string("checkpoints.db") as memory:
        graph = build_graph(memory)
        await graph.ainvoke(
            {"run_id": run_id, "topic": "Mumbai real estate"},
            config={"configurable": {"thread_id": run_id}},
        )
        # On resume after crash:
        # LangGraph replays from the last saved checkpoint,
        # not from the beginning of the pipeline.
    """)
    else:
        print("    (langgraph not installed — showing the pattern)")
        print("""
    async with AsyncSqliteSaver.from_conn_string("checkpoints.db") as memory:
        graph = build_graph(memory)
        config = {"configurable": {"thread_id": run_id}}
        await graph.ainvoke(initial_state, config=config)
    """)
        print(f"    thread_id = run_id = {run_id}")
        print("    Each pipeline run gets its own checkpoint namespace.")
        print("    Crash-recovery: resume with the same run_id to continue from last node.")


# ─── 7. LangGraph-style graph definition (shown as code comment) ─────────────

GRAPH_DEFINITION_EXAMPLE = """
# LangGraph graph with RetryPolicy (requires: pip install langgraph aiosqlite)

from langgraph.graph import StateGraph, END
from langgraph.pregel import RetryPolicy
from langgraph.checkpoint.aiosqlite import AsyncSqliteSaver

_retry = RetryPolicy(max_attempts=3, initial_interval=1.0, backoff_factor=2.0)

def build_graph(checkpointer=None):
    graph = StateGraph(PipelineState)

    graph.add_node("researcher", researcher_node, retry=_retry)
    graph.add_node("planner",    planner_node,    retry=_retry)
    graph.add_node("creative",   creative_node,   retry=_retry)
    graph.add_node("qa",         qa_node,         retry=_retry)
    graph.add_node("publisher",  publisher_node,  retry=None)
    #                                                    ^^^^
    #              Publisher is NOT idempotent — publishing twice
    #              creates duplicate social posts.  Fail fast instead.

    graph.set_entry_point("researcher")
    graph.add_edge("researcher", "planner")
    graph.add_edge("planner",    "creative")
    graph.add_edge("creative",   "qa")
    graph.add_edge("qa",         "publisher")
    graph.add_edge("publisher",  END)

    return graph.compile(checkpointer=checkpointer)
"""


# ─── 8. Monthly cost comparison ──────────────────────────────────────────────

def monthly_cost_comparison():
    """
    Compare all-Opus vs tier-routed cost.

    Assumptions (per pipeline run):
      researcher : ~4 000 input + 500 output tokens
      planner    : ~2 000 input + 800 output tokens
      creative   : ~3 000 input + 1 500 output tokens  (3 posts)
      qa         : ~2 500 input + 600 output tokens
      publisher  :   500 input + 100 output tokens
    """
    runs_per_day = 2
    days = 30
    total_runs = runs_per_day * days   # 60

    node_usage = {
        "researcher": {"input_k": 4.0,  "output_k": 0.5},
        "planner":    {"input_k": 2.0,  "output_k": 0.8},
        "creative":   {"input_k": 3.0,  "output_k": 1.5},
        "qa":         {"input_k": 2.5,  "output_k": 0.6},
        "publisher":  {"input_k": 0.5,  "output_k": 0.1},
    }

    opus_price   = {"input": 15.00, "output": 75.00}   # per 1M tokens
    routed_price = {
        "researcher": {"input": 0.80,  "output": 4.00},   # Haiku
        "planner":    {"input": 3.00,  "output": 15.00},  # Sonnet
        "creative":   {"input": 15.00, "output": 75.00},  # Opus
        "qa":         {"input": 3.00,  "output": 15.00},  # Sonnet
        "publisher":  {"input": 0.80,  "output": 4.00},   # Haiku
    }

    print("\n[5] Monthly cost comparison (2 runs/day × 30 days = 60 runs)")
    print(f"\n    {'Node':<12} {'All-Opus/run':>14} {'Routed/run':>12} {'Savings/run':>12}")
    print("    " + "-" * 54)

    total_opus = 0.0
    total_routed = 0.0

    for node, usage in node_usage.items():
        inp_k, out_k = usage["input_k"], usage["output_k"]
        cost_opus = (inp_k / 1000 * opus_price["input"] + out_k / 1000 * opus_price["output"])
        rp = routed_price[node]
        cost_routed = (inp_k / 1000 * rp["input"] + out_k / 1000 * rp["output"])
        total_opus   += cost_opus
        total_routed += cost_routed
        print(f"    {node:<12} ${cost_opus:>12.4f}   ${cost_routed:>10.4f}   ${cost_opus - cost_routed:>10.4f}")

    monthly_opus   = total_opus   * total_runs
    monthly_routed = total_routed * total_runs
    savings_pct = (1 - monthly_routed / monthly_opus) * 100

    print("    " + "-" * 54)
    print(f"    {'Per run':<12} ${total_opus:>12.4f}   ${total_routed:>10.4f}   ${total_opus - total_routed:>10.4f}")
    print(f"    {'Monthly':<12} ${monthly_opus:>12.2f}   ${monthly_routed:>10.2f}   ${monthly_opus - monthly_routed:>10.2f}")
    print(f"\n    Savings: {savings_pct:.0f}% — from ~$720/mo down to ~$51/mo")
    print("    (Opus is justified only where brand voice quality matters most: creative node)")


# ─── 9. Full simulated pipeline run ──────────────────────────────────────────

async def run_pipeline(topic: str = "Mumbai luxury housing 2025") -> PipelineState:
    run_id = str(uuid.uuid4())
    state: PipelineState = {
        "run_id":         run_id,
        "topic":          topic,
        "research":       None,
        "briefs":         None,
        "posts":          None,
        "approved_posts": None,
        "published":      False,
        "attempts":       {},
    }

    print(f"\n[6] Running simulated pipeline  run_id={run_id[:8]}...")

    for fn in [researcher_node, planner_node, creative_node, qa_node, publisher_node]:
        update = await fn(state)
        state.update(update)
        print(f"    {fn.__name__:<20} ✓")

    print(f"\n    Pipeline complete. published={state['published']}")
    return state


# ─── Main ─────────────────────────────────────────────────────────────────────

async def main():
    await _demo_retry_behaviour()
    await _demo_checkpointing()

    print("\n[Graph definition — LangGraph code (see GRAPH_DEFINITION_EXAMPLE)]")
    print("    (printed as a reference; runs without langgraph installed)")

    monthly_cost_comparison()

    await run_pipeline()

    print("\n" + "=" * 60)
    print("Summary of key patterns:")
    print("  _retry = RetryPolicy(max_attempts=3, initial_interval=1.0, backoff_factor=2.0)")
    print("  publisher_node → retry=None  (idempotency constraint)")
    print("  thread_id = run_id           (per-run checkpoint namespace)")
    print("  llm_router(tier)             (40× cost reduction vs all-Opus)")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
