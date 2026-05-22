"""
Run-scoped context variable — propagates the current run_id to tools and
utilities that don't receive it as a parameter (web_search, serpapi_utils, etc.).

Set once at run start (main.py / api/server.py), then readable from any tool
running within that coroutine tree without passing the ID explicitly.
"""
from __future__ import annotations

from contextvars import ContextVar, Token

_run_id_var: ContextVar[str | None] = ContextVar("run_id", default=None)


def set_run_id(run_id: str) -> Token:
    """Set the active run_id. Returns the Token so the caller can reset later."""
    return _run_id_var.set(run_id)


def get_run_id() -> str | None:
    """Return the active run_id, or None if not inside a run."""
    return _run_id_var.get()


def reset_run_id(token: Token) -> None:
    """Reset to the previous value (clean up after the run)."""
    _run_id_var.reset(token)
