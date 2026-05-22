"""
Module 11 Exercise — Observability & Feedback Loops
=====================================================
One TODO:
  Inside social_creative_node(), assign performance_context by calling
  get_performance_history().  The call MUST happen inside the node
  function, not at module level.

Run:
    python starter.py
    pytest tests.py
"""

import json
import os
import sqlite3
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import TypedDict, Optional


# ─── Pricing ─────────────────────────────────────────────────────────────────

_PRICING: dict[str, dict[str, float]] = {
    "claude-opus-4-5":    {"input": 15.00, "output": 75.00},
    "claude-sonnet-4-5":  {"input":  3.00, "output": 15.00},
    "claude-haiku-3-5":   {"input":  0.80, "output":  4.00},
    "opus_4_5":           {"input": 15.00, "output": 75.00},
    "sonnet_4_6":         {"input":  3.00, "output": 15.00},
    "haiku_3_5":          {"input":  0.80, "output":  4.00},
}


# ─── SQLite helpers ──────────────────────────────────────────────────────────

_DB_PATH: Optional[str] = None


def _setup_db(path: str) -> None:
    global _DB_PATH
    _DB_PATH = path
    conn = sqlite3.connect(path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS llm_calls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT, node TEXT, model TEXT,
            input_tok INTEGER, output_tok INTEGER, cost_usd REAL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT, platform TEXT, content_snippet TEXT,
            engagement REAL, run_id TEXT
        )
    """)
    conn.commit()
    conn.close()


def _get_conn() -> sqlite3.Connection:
    if _DB_PATH is None:
        raise RuntimeError("Call _setup_db() before using DB helpers.")
    return sqlite3.connect(_DB_PATH)


# ─── Provided functions (do NOT modify) ──────────────────────────────────────

def log_llm_call(
    node: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> float:
    """
    Compute cost_usd and persist to the observability DB.
    Returns cost_usd (positive float).
    """
    pricing = _PRICING.get(model, _PRICING["claude-sonnet-4-5"])
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


def get_performance_history(limit_top: int = 3, limit_bottom: int = 2) -> str:
    """
    Read historical post engagement from SQLite and return a formatted
    string for injection into a creative prompt.

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
    lines.append("\nTOP PERFORMERS (highest engagement):")
    for platform, snippet, eng in top:
        lines.append(f"  [{platform}] engagement={eng:.2f}  '{snippet}'")

    if bottom:
        lines.append("\nAVOID THESE PATTERNS (lowest engagement):")
        for platform, snippet, eng in bottom:
            lines.append(f"  [{platform}] engagement={eng:.2f}  '{snippet}'")

    return "\n".join(lines)


def write_summary_json(run_id: str, stats: dict) -> Path:
    """
    Write run stats to output/{run_id}/summary.json.
    Returns the path to the written file.
    """
    out_dir = Path("output") / run_id
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "summary.json"
    payload = {"run_id": run_id, "ts": datetime.utcnow().isoformat(), **stats}
    out_file.write_text(json.dumps(payload, indent=2))
    return out_file


# ─── State ────────────────────────────────────────────────────────────────────

class PipelineState(TypedDict):
    run_id:  str
    topic:   str
    briefs:  list
    posts:   list


# ─── Flag for test inspection ─────────────────────────────────────────────────
#
# Tests will inspect this flag to verify that get_performance_history()
# is called INSIDE the node function (not at module level).
#
# Do NOT move this flag or the get_performance_history() call outside
# of social_creative_node().

_history_called_inside_node: bool = False


# ─── TODO: social_creative_node ──────────────────────────────────────────────

def social_creative_node(state: PipelineState) -> dict:
    """
    Creative node that injects performance history into the prompt.

    TODO: Assign performance_context by calling get_performance_history().
    -----------------------------------------------------------------------
    The call MUST happen inside this function — not at module level —
    so every invocation gets the latest data from the DB.

    After you assign performance_context, the node will:
      - Include the history in the prompt when history exists
      - Generate posts without the history section when the DB is empty
    """
    global _history_called_inside_node

    # TODO: replace ??? with the correct function call
    # Hint: look at the function defined above this node
    performance_context = ???   # ← your answer here

    # Mark that get_performance_history was called inside the node
    _history_called_inside_node = True

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

        input_tok  = len(prompt.split())
        output_tok = 80
        cost = log_llm_call("creative", "sonnet_4_6", input_tok, output_tok)

        posts.append({
            "brief":       brief,
            "content":     f"Post for '{brief}' | had_history={'yes' if performance_context else 'no'}",
            "prompt":      prompt,
            "cost":        cost,
            "had_history": bool(performance_context),
        })

    return {"posts": posts}


# ─── Demo ─────────────────────────────────────────────────────────────────────

def _seed_posts() -> None:
    conn = _get_conn()
    sample = [
        ("instagram", "Monsoon sale — 3 BHK at ₹80 L", 4.8, "seed-1"),
        ("twitter",   "Data: prices up 12% YoY",       4.2, "seed-2"),
        ("linkedin",  "Boring generic ad",              0.9, "seed-3"),
    ]
    for platform, snippet, eng, rid in sample:
        conn.execute(
            "INSERT INTO posts (ts, platform, content_snippet, engagement, run_id) VALUES (?,?,?,?,?)",
            (datetime.utcnow().isoformat(), platform, snippet, eng, rid),
        )
    conn.commit()
    conn.close()


if __name__ == "__main__":
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name

    _setup_db(db_path)
    _seed_posts()

    state: PipelineState = {
        "run_id": "demo-001",
        "topic":  "Mumbai real estate",
        "briefs": ["2 BHK in Powai", "Sea-view 3 BHK"],
        "posts":  [],
    }

    result = social_creative_node(state)
    print("Posts generated:")
    for post in result["posts"]:
        print(f"  had_history={post['had_history']}  content={post['content']}")

    os.unlink(db_path)
