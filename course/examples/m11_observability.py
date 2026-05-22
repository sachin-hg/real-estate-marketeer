"""
Module 11 — Observability & Feedback Loops
pipeline.py v10: Cost logging + performance history injection.

Run:
    pip install anthropic
    python m11_observability.py

What this file teaches:
  - log_llm_call() computes cost_usd and persists to SQLite
  - get_performance_history() reads DB and formats top/bottom performers
  - Performance context is injected INSIDE social_creative_node (not at module level)
  - Feedback loop: run #1 has no history; by run #5 history improves the prompt
  - write_summary_json() saves per-run stats to output/{run_id}/summary.json
"""

import asyncio
import json
import os
import sqlite3
import tempfile
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, TypedDict

# ─── Token pricing (per 1 M tokens) ─────────────────────────────────────────

_PRICING: dict[str, dict[str, float]] = {
    "claude-opus-4-5":    {"input": 15.00, "output": 75.00},
    "claude-sonnet-4-5":  {"input":  3.00, "output": 15.00},
    "claude-haiku-3-5":   {"input":  0.80, "output":  4.00},
    # Friendly aliases used throughout the course
    "opus_4_5":   {"input": 15.00, "output": 75.00},
    "sonnet_4_6": {"input":  3.00, "output": 15.00},
    "haiku_3_5":  {"input":  0.80, "output":  4.00},
}

# ─── SQLite helpers ──────────────────────────────────────────────────────────

_DB_PATH: Optional[str] = None   # set by _setup_db()


def _setup_db(path: str) -> None:
    global _DB_PATH
    _DB_PATH = path
    conn = sqlite3.connect(path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS llm_calls (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            ts         TEXT    NOT NULL,
            node       TEXT    NOT NULL,
            model      TEXT    NOT NULL,
            input_tok  INTEGER NOT NULL,
            output_tok INTEGER NOT NULL,
            cost_usd   REAL    NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS posts (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            ts              TEXT    NOT NULL,
            platform        TEXT    NOT NULL,
            content_snippet TEXT    NOT NULL,
            engagement      REAL    NOT NULL,
            run_id          TEXT    NOT NULL
        )
    """)
    conn.commit()
    conn.close()


def _get_conn() -> sqlite3.Connection:
    if _DB_PATH is None:
        raise RuntimeError("Call _setup_db() before using DB helpers.")
    return sqlite3.connect(_DB_PATH)


# ─── 1. log_llm_call ─────────────────────────────────────────────────────────

def log_llm_call(
    node: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> float:
    """
    Compute cost_usd and persist the LLM call to the observability DB.

    Returns cost_usd (positive float).

    Example:
        cost = log_llm_call("creative", "sonnet_4_6", 3000, 1200)
        # → 0.027  ($3/1M input + $15/1M output)
    """
    pricing = _PRICING.get(model)
    if pricing is None:
        # Unknown model — fall back to Sonnet pricing
        pricing = _PRICING["claude-sonnet-4-5"]

    cost_usd = (
        input_tokens  / 1_000_000 * pricing["input"]
        + output_tokens / 1_000_000 * pricing["output"]
    )

    conn = _get_conn()
    conn.execute(
        "INSERT INTO llm_calls (ts, node, model, input_tok, output_tok, cost_usd) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (datetime.utcnow().isoformat(), node, model, input_tokens, output_tokens, cost_usd),
    )
    conn.commit()
    conn.close()
    return cost_usd


# ─── 2. get_performance_history ──────────────────────────────────────────────

def get_performance_history(limit_top: int = 3, limit_bottom: int = 2) -> str:
    """
    Read historical post engagement from SQLite and return a formatted
    string suitable for injecting into a creative prompt.

    Called INSIDE social_creative_node — NOT at module level — so each
    invocation gets fresh data as the DB grows across runs.

    Returns empty string if no history exists yet.
    """
    conn = _get_conn()
    rows = conn.execute(
        "SELECT platform, content_snippet, engagement FROM posts "
        "ORDER BY engagement DESC"
    ).fetchall()
    conn.close()

    if not rows:
        return ""

    top    = rows[:limit_top]
    bottom = rows[-limit_bottom:] if len(rows) > limit_top else []

    lines = ["PERFORMANCE HISTORY (use these patterns):"]
    lines.append(f"\nTOP PERFORMERS (highest engagement):")
    for platform, snippet, eng in top:
        lines.append(f"  [{platform}] engagement={eng:.2f}  '{snippet}'")

    if bottom:
        lines.append(f"\nAVOID THESE PATTERNS (lowest engagement):")
        for platform, snippet, eng in bottom:
            lines.append(f"  [{platform}] engagement={eng:.2f}  '{snippet}'")

    return "\n".join(lines)


# ─── 3. social_creative_node ─────────────────────────────────────────────────

class PipelineState(TypedDict):
    run_id:   str
    topic:    str
    briefs:   list
    posts:    list
    run_num:  int   # for demo: tracks which run we are on


def social_creative_node(state: PipelineState) -> dict:
    """
    Creative node with performance_context injected.

    Key pattern:
        performance_context = get_performance_history()   # ← called INSIDE the node

    This means every invocation reads the latest DB state.
    If called at module level (outside the node), all runs would get
    the same static snapshot captured at import time.
    """
    # ↓ Performance context fetched HERE — inside the node function
    performance_context = get_performance_history()

    briefs = state.get("briefs", [])
    posts  = []

    for brief in briefs:
        if performance_context:
            prompt = (
                f"Create a social post for: {brief}\n\n"
                f"{performance_context}\n\n"
                f"Apply the top-performer patterns above."
            )
        else:
            prompt = f"Create a social post for: {brief}"

        # Mock LLM call — log tokens and cost
        input_tok  = len(prompt.split())
        output_tok = 80
        cost = log_llm_call(
            node="creative",
            model="sonnet_4_6",
            input_tokens=input_tok,
            output_tokens=output_tok,
        )

        content = f"[Run #{state['run_num']}] Post about '{brief}' | history={'yes' if performance_context else 'none'}"
        posts.append({
            "brief":   brief,
            "content": content,
            "cost":    cost,
            "had_history": bool(performance_context),
        })

    return {"posts": posts}


# ─── 4. write_summary_json ───────────────────────────────────────────────────

def write_summary_json(run_id: str, stats: dict) -> Path:
    """
    Write run stats to output/{run_id}/summary.json.
    Creates the directory if it does not exist.
    Returns the path to the written file.
    """
    out_dir = Path("output") / run_id
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "summary.json"
    payload = {"run_id": run_id, "ts": datetime.utcnow().isoformat(), **stats}
    out_file.write_text(json.dumps(payload, indent=2))
    return out_file


# ─── 5. Simulated feedback loop ──────────────────────────────────────────────

def _seed_historical_posts(n: int = 8) -> None:
    """Insert mock historical posts so the DB has something to query."""
    platforms  = ["instagram", "twitter", "linkedin"]
    snippets   = [
        "Monsoon sale — 3 BHK at ₹80 L 🌧️",
        "Data: Mumbai prices up 12% YoY",
        "Your dream home awaits in Powai",
        "New launch: sea-view apartments",
        "Boring stats post with no hook",
        "Generic real estate ad",
        "Festival offer on 2 BHK flats",
        "Interest rates explained (dry)",
    ]
    engagements = [4.8, 4.2, 3.9, 3.7, 1.1, 0.9, 4.5, 0.7]

    conn = _get_conn()
    for i, (snip, eng) in enumerate(zip(snippets, engagements)):
        ts = (datetime.utcnow() - timedelta(days=n - i)).isoformat()
        conn.execute(
            "INSERT INTO posts (ts, platform, content_snippet, engagement, run_id) VALUES (?,?,?,?,?)",
            (ts, platforms[i % 3], snip, eng, f"seed-run-{i:03d}"),
        )
    conn.commit()
    conn.close()


async def run_feedback_loop(num_runs: int = 5) -> None:
    """
    Simulate 5 pipeline runs.
    - Run 1: DB starts empty → no history injected
    - Runs 2–5: DB grows → history is injected and improves prompts
    """
    print("\n[4] Feedback loop over 5 runs")
    print(f"    {'Run':<6} {'Has history?':<15} {'Posts':<8} {'Prompt length (approx)'}")
    print("    " + "-" * 52)

    for run_num in range(1, num_runs + 1):
        run_id = f"demo-run-{run_num:03d}"
        state: PipelineState = {
            "run_id":  run_id,
            "topic":   "Mumbai real estate 2025",
            "briefs":  ["2 BHK in Powai", "Sea-view 3 BHK"],
            "posts":   [],
            "run_num": run_num,
        }

        result = social_creative_node(state)
        posts  = result["posts"]

        has_history = posts[0]["had_history"] if posts else False
        avg_prompt_len = sum(
            len(p["content"]) for p in posts
        ) // max(len(posts), 1)

        print(f"    {run_num:<6} {'yes' if has_history else 'no':<15} {len(posts):<8} ~{avg_prompt_len} chars")

        # After run 1 seed the DB so subsequent runs have history
        if run_num == 1:
            _seed_historical_posts()

    print("\n    Observation: from run 2 onward the creative prompt includes")
    print("    top/bottom performer data, guiding the LLM toward better output.")


# ─── 6. Cost summary ─────────────────────────────────────────────────────────

def print_cost_summary() -> None:
    conn = _get_conn()
    rows = conn.execute(
        "SELECT node, model, SUM(input_tok), SUM(output_tok), SUM(cost_usd), COUNT(*) "
        "FROM llm_calls GROUP BY node, model ORDER BY SUM(cost_usd) DESC"
    ).fetchall()
    conn.close()

    print("\n[5] Cost summary (all runs this session)")
    print(f"\n    {'Node':<14} {'Model':<18} {'In-tok':>8} {'Out-tok':>8} {'Calls':>6} {'Cost $':>9}")
    print("    " + "-" * 68)

    total = 0.0
    for node, model, in_tok, out_tok, cost, calls in rows:
        total += cost
        print(f"    {node:<14} {model:<18} {in_tok:>8,} {out_tok:>8,} {calls:>6} ${cost:>8.5f}")

    print("    " + "-" * 68)
    print(f"    {'TOTAL':<50} ${total:>8.5f}")


# ─── 7. get_performance_history demo ────────────────────────────────────────

def demo_performance_history() -> None:
    print("\n[2] get_performance_history() output (after seeding DB)")
    _seed_historical_posts()
    history = get_performance_history()
    if history:
        for line in history.splitlines():
            print(f"    {line}")
    else:
        print("    (empty — no posts in DB yet)")


# ─── Main ─────────────────────────────────────────────────────────────────────

async def main() -> None:
    print("=" * 60)
    print("MODULE 11 — Observability & Feedback Loops")
    print("=" * 60)

    # Use a temp file so the demo is self-contained
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    _setup_db(db_path)

    print(f"\n[1] SQLite observability DB: {db_path}")

    demo_performance_history()

    # Wipe the seeded posts so the feedback loop starts clean
    conn = _get_conn()
    conn.execute("DELETE FROM posts")
    conn.commit()
    conn.close()

    await run_feedback_loop(num_runs=5)

    print_cost_summary()

    # write_summary_json demo
    run_id   = "demo-run-001"
    stat_path = write_summary_json(run_id, {"total_cost": 0.0042, "posts_approved": 2})
    print(f"\n[6] write_summary_json → {stat_path.resolve()}")
    print(f"    contents: {stat_path.read_text()}")

    print("\n" + "=" * 60)
    print("Key patterns:")
    print("  log_llm_call(node, model, in_tok, out_tok) → cost_usd float")
    print("  get_performance_history()  ← called INSIDE the node (not module level)")
    print("  write_summary_json(run_id, stats) → output/{run_id}/summary.json")
    print("  Feedback loop: run 1 = no history; run 5 = rich history context")
    print("=" * 60)

    # Cleanup temp DB
    os.unlink(db_path)


if __name__ == "__main__":
    asyncio.run(main())
