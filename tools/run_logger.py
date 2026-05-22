"""
Per-run logging — file handler + DB persistence.

Sets up a DEBUG-level FileHandler at output/<run_id>/run.log so that every
LLM call, tool invocation, and agent decision is captured verbatim.

Every LLM call and external API call is also persisted to the DB (llm_calls
and api_calls tables) with full prompts and responses — no truncation.

Helpers
-------
log_llm_call()  — structured block for an LLM API request/response
log_api_call()  — structured block for an external API call (Tavily, SerpAPI, etc.)
log_tool_call() — legacy block kept for backward compat
log_agent_io()  — structured block for a LangGraph node's input/output
"""
from __future__ import annotations

import json
import logging
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_SEPARATOR = "=" * 80

# Kept so callers can close/flush if needed
_file_handler: logging.FileHandler | None = None

# Cost table ($/M tokens) — mirrors llm_router._COST
_MODEL_RATES: dict[str, tuple[float, float]] = {
    "claude-haiku-4-5-20251001": (1.00,  5.00),
    "claude-sonnet-4-6":         (3.00, 15.00),
    "claude-opus-4-7":           (5.00, 25.00),
    "gemini-2.5-flash":          (0.30,  2.50),
    "gemini-2.5-pro":            (1.25,  5.00),
}


# ─── Setup ────────────────────────────────────────────────────────────────────

def setup_run_logging(run_id: str, output_root: Path = Path("output")) -> Path | None:
    """
    Attach a per-run FileHandler to the root logger.
    File: DEBUG level (everything). Console: unchanged.
    Returns the path to the created log file, or None if file outputs are disabled.
    """
    try:
        from config import get_settings
        if not get_settings().enable_file_outputs:
            logging.getLogger(__name__).debug("File logging disabled (ENABLE_FILE_OUTPUTS=false)")
            return None
    except Exception:
        pass

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
    for lib in ("httpx", "httpcore", "urllib3", "tweepy", "openai",
                "apify_client", "apify_shared", "langgraph", "anthropic"):
        logging.getLogger(lib).setLevel(logging.WARNING)

    global _file_handler
    _file_handler = fh

    fh.stream.write(f"\n{_SEPARATOR}\n")
    fh.stream.write(f"  RUN ID : {run_id}\n")
    fh.stream.write(f"  LOG    : {log_path}\n")
    fh.stream.write(f"{_SEPARATOR}\n\n")
    fh.stream.flush()

    logging.getLogger(__name__).debug("File logging initialised → %s", log_path)
    return log_path


# ─── DB persistence helpers (non-blocking daemon threads) ─────────────────────

def _db_write(fn, *args, **kwargs) -> None:
    """Run a DB write in a daemon thread — never blocks the pipeline."""
    def _target():
        try:
            fn(*args, **kwargs)
        except Exception:
            pass  # logging must never fail the pipeline
    threading.Thread(target=_target, daemon=True).start()


def _persist_llm_call(
    *,
    run_id: str | None,
    agent: str,
    model: str,
    system_prompt: str,
    user_message: str,
    response_text: str,
    stop_reason: str,
    input_tokens: int | None,
    output_tokens: int | None,
    cost_usd: float | None,
    elapsed_ms: float,
) -> None:
    from db.connection import get_db_session
    from db.models import LlmCallRecord
    with get_db_session() as sess:
        sess.add(LlmCallRecord(
            run_id=run_id,
            called_at=datetime.now(timezone.utc),
            agent=agent,
            model=model,
            system_prompt=system_prompt,
            user_message=user_message,
            response_text=response_text,
            stop_reason=stop_reason,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost_usd,
            elapsed_ms=int(elapsed_ms),
        ))
        sess.commit()


def _persist_api_call(
    *,
    run_id: str | None,
    agent: str,
    api_name: str,
    endpoint: str,
    params: Any,
    response: Any,
    result_count: int,
    status: str,
    http_status: int | None,
    error: str | None,
    elapsed_ms: float,
    use_case: str,
) -> None:
    from db.connection import get_db_session
    from db.models import ApiCallRecord

    def _to_json(obj: Any, limit: int = 500_000) -> str:
        try:
            s = json.dumps(obj, ensure_ascii=False, default=str)
        except Exception:
            s = str(obj)
        return s[:limit]

    with get_db_session() as sess:
        sess.add(ApiCallRecord(
            run_id=run_id,
            called_at=datetime.now(timezone.utc),
            agent=agent,
            api_name=api_name,
            endpoint=endpoint,
            params_json=_to_json(params),
            response_json=_to_json(response),
            result_count=result_count,
            status=status,
            http_status=http_status,
            error=error,
            elapsed_ms=int(elapsed_ms),
            use_case=use_case,
        ))
        sess.commit()


# ─── Public helpers ───────────────────────────────────────────────────────────

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
    Log one complete LLM round-trip to:
      1. run.log (DEBUG, prompts truncated for readability)
      2. llm_calls DB table (full content, no truncation)
    """
    from tools.run_context import get_run_id
    extra = extra or {}
    input_tokens  = extra.pop("input_tokens",  None)
    output_tokens = extra.pop("output_tokens", None)

    cost_usd: float | None = None
    cost_line = ""
    if input_tokens is not None and output_tokens is not None:
        rates = _MODEL_RATES.get(model, (0.0, 0.0))
        cost_usd = (input_tokens * rates[0] + output_tokens * rates[1]) / 1_000_000
        cost_line = f"  in={input_tokens:,} out={output_tokens:,} cost=${cost_usd:.5f}"

    # ── File log (truncated for readability) ─────────────────────────────────
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
        "│  ── RESPONSE (first 3000 chars) ──────────────────────────────────",
    ]
    for line in response_text[:3000].splitlines():
        lines.append(f"│    {line}")
    lines.append(f"└{'─' * 79}┘")
    logger.debug("\n".join(lines))

    # ── DB persist (full content, non-blocking) ───────────────────────────────
    _db_write(
        _persist_llm_call,
        run_id=get_run_id(),
        agent=agent,
        model=model,
        system_prompt=system_prompt,
        user_message=user_message,
        response_text=response_text,
        stop_reason=stop_reason,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost_usd,
        elapsed_ms=elapsed_ms,
    )


def log_api_call(
    logger: logging.Logger,
    *,
    agent: str,
    api_name: str,
    endpoint: str,
    params: Any,
    response: Any,
    result_count: int = 0,
    status: str = "ok",
    http_status: int | None = None,
    error: str | None = None,
    elapsed_ms: float = 0.0,
    use_case: str = "",
) -> None:
    """
    Log one external API call (Tavily, SerpAPI, YouTube, Reddit, Twitter, etc.) to:
      1. run.log at DEBUG level (brief summary line)
      2. api_calls DB table (full params + full response, no truncation)

    Parameters
    ----------
    agent       : which tool/agent made the call ("web_search", "serpapi_news", ...)
    api_name    : short identifier for the API ("tavily", "serpapi", "youtube_data_v3", ...)
    endpoint    : URL or method name called
    params      : dict of request params (query, filters, keys masked if sensitive)
    response    : full response object (dict/list) — stored in DB without truncation
    result_count: how many items were in the result
    status      : "ok" | "error"
    http_status : HTTP response code if available
    error       : error message if status == "error"
    elapsed_ms  : wall-clock ms for the call
    use_case    : human description e.g. "Tavily: Karnataka RERA quarterly report 2026"
    """
    from tools.run_context import get_run_id

    # ── File log ─────────────────────────────────────────────────────────────
    if status == "ok":
        logger.debug(
            "API [%s] %s → %d results in %dms | %s",
            api_name, endpoint[:80], result_count, elapsed_ms, use_case[:80],
        )
    else:
        logger.warning(
            "API [%s] %s FAILED (%s) in %dms | %s",
            api_name, endpoint[:80], error, elapsed_ms, use_case[:60],
        )

    # ── DB persist (full content, non-blocking) ───────────────────────────────
    _db_write(
        _persist_api_call,
        run_id=get_run_id(),
        agent=agent,
        api_name=api_name,
        endpoint=endpoint,
        params=params,
        response=response,
        result_count=result_count,
        status=status,
        http_status=http_status,
        error=error,
        elapsed_ms=elapsed_ms,
        use_case=use_case,
    )


def log_tool_call(
    logger: logging.Logger,
    *,
    tool_name: str,
    inputs: dict,
    outputs: object,
    elapsed_ms: float = 0.0,
    error: str | None = None,
) -> None:
    """Write a DEBUG block for one tool invocation (legacy helper, kept for compat)."""
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
        lines.append(f"│    {k}: {_preview(v)}")
    lines += ["│  ── OUTPUTS ──────────────────────────────────────────────────────"]
    for k, v in outputs.items():
        lines.append(f"│    {k}: {_preview(v)}")
    lines.append(f"└{'─' * 79}┘")
    logger.debug("\n".join(lines))


# ─── Convenience timer ────────────────────────────────────────────────────────

class Timer:
    """Simple context-manager stopwatch: `with Timer() as t: ...; t.elapsed_ms`."""
    def __enter__(self):
        self._start = time.perf_counter()
        return self

    def __exit__(self, *_):
        self.ms = (time.perf_counter() - self._start) * 1000

    @property
    def elapsed_ms(self) -> float:
        return getattr(self, "ms", 0.0)
