"""
Per-run file logging.

Sets up a DEBUG-level FileHandler at output/<run_id>/run.log so that every
LLM call, tool invocation, and agent decision is captured verbatim, while the
console remains at INFO.

Usage
-----
Call `setup_run_logging(run_id)` once in main.py **before** the graph starts.
All subsequent `logger.debug(...)` calls anywhere in the package are then
written to the file automatically.

Helpers
-------
log_llm_call()  — structured block for an LLM API request/response
log_tool_call() — structured block for a tool / external API call
log_agent_io()  — structured block for a LangGraph node's input and output
"""
from __future__ import annotations

import json
import logging
import time
from pathlib import Path

_SEPARATOR = "=" * 80
_BOX_TOP   = "┌" + "─" * 78 + "┐"
_BOX_MID   = "├" + "─" * 78 + "┤"
_BOX_BOT   = "└" + "─" * 78 + "┘"

# Kept so callers can close/flush if needed
_file_handler: logging.FileHandler | None = None


def setup_run_logging(run_id: str, output_root: Path = Path("output")) -> Path:
    """
    Attach a per-run FileHandler to the root logger.

    - File:    DEBUG level  (everything)
    - Console: unchanged    (set earlier by _setup_logging in main.py)

    Returns the path to the created log file.
    """
    run_dir = output_root / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    log_path = run_dir / "run.log"

    fmt = logging.Formatter(
        fmt="%(asctime)s.%(msecs)03d [%(levelname)-7s] %(name)-38s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    fh = logging.FileHandler(log_path, mode="w", encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(fmt)

    root = logging.getLogger()
    root.addHandler(fh)
    # Root is already at DEBUG (set by _setup_logging in main.py); keep it there.
    # Keep noisy SDK loggers quiet in the file too.
    for lib in ("httpx", "httpcore", "urllib3", "tweepy", "openai",
                "apify_client", "apify_shared", "langgraph", "anthropic"):
        logging.getLogger(lib).setLevel(logging.WARNING)

    global _file_handler
    _file_handler = fh

    # Write a human-readable header
    fh.stream.write(f"\n{_SEPARATOR}\n")
    fh.stream.write(f"  RUN ID : {run_id}\n")
    fh.stream.write(f"  LOG    : {log_path}\n")
    fh.stream.write(f"{_SEPARATOR}\n\n")
    fh.stream.flush()

    logging.getLogger(__name__).debug("File logging initialised → %s", log_path)
    return log_path


# ─── Structured log helpers ───────────────────────────────────────────────────

# Cost table ($/M tokens, May 2026) — mirrors llm_router._COST
_MODEL_RATES: dict[str, tuple[float, float]] = {
    "claude-haiku-4-5-20251001": (1.00,  5.00),
    "claude-sonnet-4-6":         (3.00, 15.00),
    "claude-opus-4-7":           (5.00, 25.00),
    "gemini-2.5-flash":          (0.30,  2.50),
    "gemini-2.5-pro":            (1.25,  5.00),
}


def log_llm_call(
    logger: logging.Logger,
    *,
    agent: str,
    model: str,
    system_prompt: str,
    user_message: str,
    response_text: str,
    stop_reason: str = "",
    elapsed_ms: float = 0.0,
    extra: dict | None = None,
) -> None:
    """
    Write a DEBUG block documenting one complete LLM API round-trip.
    Shown at DEBUG level, so it lands in the file but not on the console.
    """
    extra = extra or {}
    input_tokens  = extra.pop("input_tokens",  None)
    output_tokens = extra.pop("output_tokens", None)

    # Estimate cost if token counts provided
    cost_line = ""
    if input_tokens is not None and output_tokens is not None:
        rates = _MODEL_RATES.get(model, (0, 0))
        cost_usd = (input_tokens * rates[0] + output_tokens * rates[1]) / 1_000_000
        cost_line = f"  in={input_tokens:,} out={output_tokens:,} cost=${cost_usd:.5f}"

    header = f" LLM CALL — {agent} "
    lines = [
        "",
        f"┌─{header:─<77}┐",
        f"│  model        : {model}",
        f"│  stop_reason  : {stop_reason}",
        f"│  elapsed_ms   : {elapsed_ms:.0f}",
        f"│  system chars : {len(system_prompt):,}",
        f"│  input chars  : {len(user_message):,}",
        f"│  output chars : {len(response_text):,}",
    ]
    if cost_line:
        lines.append(f"│  tokens       :{cost_line}")
    if extra:
        for k, v in extra.items():
            lines.append(f"│  {k:<13}: {v}")
    lines += [
        "│",
        "│  ── SYSTEM PROMPT (first 500 chars) ──────────────────────────────",
    ]
    for line in system_prompt[:500].splitlines():
        lines.append(f"│    {line}")
    lines += [
        "│",
        "│  ── USER MESSAGE (first 800 chars) ───────────────────────────────",
    ]
    for line in user_message[:800].splitlines():
        lines.append(f"│    {line}")
    lines += [
        "│",
        "│  ── RESPONSE (first 1200 chars) ──────────────────────────────────",
    ]
    for line in response_text[:1200].splitlines():
        lines.append(f"│    {line}")
    lines.append(f"└{'─' * 79}┘")
    logger.debug("\n".join(lines))


def log_tool_call(
    logger: logging.Logger,
    *,
    tool_name: str,
    inputs: dict,
    outputs: object,
    elapsed_ms: float = 0.0,
    error: str | None = None,
) -> None:
    """Write a DEBUG block for one tool / external-API invocation."""
    header = f" TOOL CALL — {tool_name} "
    try:
        out_str = json.dumps(outputs, ensure_ascii=False, default=str)
    except Exception:
        out_str = str(outputs)

    lines = [
        "",
        f"┌─{header:─<77}┐",
        f"│  elapsed_ms : {elapsed_ms:.0f}",
        f"│  inputs     : {json.dumps(inputs, ensure_ascii=False, default=str)[:300]}",
    ]
    if error:
        lines.append(f"│  ERROR      : {error}")
    else:
        lines.append(f"│  output len : {len(out_str)} chars")
        for line in out_str[:600].splitlines():
            lines.append(f"│    {line}")
    lines.append(f"└{'─' * 79}┘")
    logger.debug("\n".join(lines))


def log_agent_io(
    logger: logging.Logger,
    *,
    agent: str,
    inputs: dict,
    outputs: dict,
) -> None:
    """Write a DEBUG block summarising a LangGraph node's inputs and outputs."""

    def _preview(obj: object, max_chars: int = 600) -> str:
        try:
            s = json.dumps(obj, ensure_ascii=False, default=str)
        except Exception:
            s = str(obj)
        return s[:max_chars] + ("…" if len(s) > max_chars else "")

    header = f" AGENT I/O — {agent} "
    lines = [
        "",
        f"┌─{header:─<77}┐",
        "│  ── INPUTS ───────────────────────────────────────────────────────",
    ]
    for k, v in inputs.items():
        preview = _preview(v)
        lines.append(f"│    {k}: {preview}")
    lines += [
        "│  ── OUTPUTS ──────────────────────────────────────────────────────",
    ]
    for k, v in outputs.items():
        preview = _preview(v)
        lines.append(f"│    {k}: {preview}")
    lines.append(f"└{'─' * 79}┘")
    logger.debug("\n".join(lines))


# ─── Convenience timer ────────────────────────────────────────────────────────

class Timer:
    """Simple context-manager stopwatch: `with Timer() as t: ...; t.ms`."""
    def __enter__(self):
        self._start = time.perf_counter()
        return self

    def __exit__(self, *_):
        self.ms = (time.perf_counter() - self._start) * 1000

    @property
    def elapsed_ms(self) -> float:
        return getattr(self, "ms", 0.0)
