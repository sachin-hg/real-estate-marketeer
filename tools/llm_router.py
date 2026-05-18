"""
LLM router — unified sync/async interface for Anthropic Claude and Google Gemini.

Provider selection:
  fast tier     → Gemini 2.5 Flash  (if GEMINI_API_KEY set)  — 53% cheaper than Haiku
                  Claude Haiku       (fallback, no extra config)
  balanced tier → Claude Sonnet always
  creative tier → Claude Opus always  (EQ-Bench creative writing leader)

Usage (sync, for use inside sync LangGraph nodes):
    from tools.llm_router import call_json_sync
    data = call_json_sync(tier="fast", system=SYSTEM, user_msg=user_message, max_tokens=512)

Usage (async):
    from tools.llm_router import call_json_async
    data = await call_json_async(tier="fast", system=SYSTEM, user_msg=user_message, max_tokens=512)

Both return a dict (JSON parsed) or {} on failure.
Cost per call is logged at DEBUG level.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

# ── Cost table ($/M tokens, May 2026) ────────────────────────────────────────
# Source: official provider pricing pages
_COST: dict[str, tuple[float, float]] = {
    # model_id: (input $/M, output $/M)
    "claude-haiku-4-5-20251001":  (1.00,  5.00),
    "claude-sonnet-4-6":          (3.00, 15.00),
    "claude-opus-4-7":            (5.00, 25.00),
    "gemini-2.5-flash":           (0.30,  2.50),
    "gemini-2.5-pro":             (1.25,  5.00),
}

GEMINI_FAST_MODEL = "gemini-2.5-flash"


def _log_cost(model: str, input_tokens: int, output_tokens: int, label: str) -> None:
    rates = _COST.get(model, (0, 0))
    cost_usd = (input_tokens * rates[0] + output_tokens * rates[1]) / 1_000_000
    logger.debug(
        "TOKEN USAGE [%s] model=%s in=%d out=%d cost=$%.5f",
        label, model, input_tokens, output_tokens, cost_usd,
    )


# ── Sync interface ────────────────────────────────────────────────────────────

def call_json_sync(
    tier: str,
    system: str,
    user_msg: str,
    max_tokens: int = 512,
    log_label: str = "",
    *,
    temperature: float = 1.0,
) -> dict:
    """Synchronous JSON call — safe to use in sync LangGraph nodes."""
    from config import get_settings
    settings = get_settings()

    if tier == "fast" and settings.gemini_api_key:
        return _gemini_sync(settings.gemini_api_key, GEMINI_FAST_MODEL, system, user_msg,
                            max_tokens, log_label, temperature=temperature)

    model = _model_for_tier(tier, settings)
    return _anthropic_sync(settings.anthropic_api_key, model, system, user_msg,
                           max_tokens, log_label, temperature=temperature)


# ── Async interface ───────────────────────────────────────────────────────────

async def call_json_async(
    tier: str,
    system: str,
    user_msg: str,
    max_tokens: int = 512,
    log_label: str = "",
    *,
    temperature: float = 1.0,
) -> dict:
    """Async JSON call — for use in async agents."""
    from config import get_settings
    settings = get_settings()

    if tier == "fast" and settings.gemini_api_key:
        return await _gemini_async(settings.gemini_api_key, GEMINI_FAST_MODEL, system, user_msg,
                                   max_tokens, log_label, temperature=temperature)

    model = _model_for_tier(tier, settings)
    return await _anthropic_async(settings.anthropic_api_key, model, system, user_msg,
                                  max_tokens, log_label, temperature=temperature)


# ── Gemini ────────────────────────────────────────────────────────────────────

def _gemini_sync(api_key: str, model: str, system: str, user_msg: str, max_tokens: int,
                 label: str, *, temperature: float = 1.0) -> dict:
    from tools.json_utils import extract_json
    try:
        from google import genai
        from google.genai import types as gtypes

        client = genai.Client(api_key=api_key)
        config = gtypes.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            max_output_tokens=max_tokens,
            temperature=temperature,
        )
        response = client.models.generate_content(
            model=model,
            contents=user_msg,
            config=config,
        )
        raw = response.text or ""
        usage = getattr(response, "usage_metadata", None)
        if usage:
            _log_cost(model,
                      getattr(usage, "prompt_token_count", 0),
                      getattr(usage, "candidates_token_count", 0),
                      label)
        data = extract_json(raw)
        return data if isinstance(data, dict) else {}
    except ImportError:
        logger.warning("google-genai not installed — falling back to Anthropic Haiku for %s", label)
        return {}
    except Exception as exc:
        logger.error("Gemini Flash sync failed [%s]: %s", label, exc, exc_info=True)
        return {}


async def _gemini_async(api_key: str, model: str, system: str, user_msg: str, max_tokens: int,
                        label: str, *, temperature: float = 1.0) -> dict:
    from tools.json_utils import extract_json
    try:
        from google import genai
        from google.genai import types as gtypes

        client = genai.Client(api_key=api_key)
        config = gtypes.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            max_output_tokens=max_tokens,
            temperature=temperature,
        )
        response = await client.aio.models.generate_content(
            model=model,
            contents=user_msg,
            config=config,
        )
        raw = response.text or ""
        usage = getattr(response, "usage_metadata", None)
        if usage:
            _log_cost(model,
                      getattr(usage, "prompt_token_count", 0),
                      getattr(usage, "candidates_token_count", 0),
                      label)
        data = extract_json(raw)
        return data if isinstance(data, dict) else {}
    except ImportError:
        logger.warning("google-genai not installed — falling back to Anthropic Haiku for %s", label)
        return {}
    except Exception as exc:
        logger.error("Gemini Flash async failed [%s]: %s", label, exc, exc_info=True)
        return {}


# ── Retry-aware message wrappers (used by platform agents + internal helpers) ──

async def acall_message(
    client: Any,
    model: str,
    system: str,
    messages: list[dict],
    max_tokens: int,
    *,
    retries: int | None = None,
    timeout: float | None = None,
    temperature: float = 1.0,
) -> Any:
    """
    Retry-aware wrapper around AsyncAnthropic.messages.create.
    Returns the full anthropic.types.Message (not JSON-parsed).
    Use this in platform agents and anywhere needing raw response access.
    Raises on exhaustion — callers / LangGraph RetryPolicy handle that.
    """
    import asyncio
    import anthropic as _anthropic
    from config import get_settings
    settings = get_settings()
    n = retries if retries is not None else settings.llm_retries
    t = timeout if timeout is not None else settings.llm_timeout

    last_exc: Exception = RuntimeError("acall_message: no attempts made")
    for attempt in range(n + 1):
        try:
            return await asyncio.wait_for(
                client.messages.create(
                    model=model, max_tokens=max_tokens,
                    system=system, messages=messages,
                    temperature=temperature,
                ),
                timeout=t,
            )
        except (
            _anthropic.RateLimitError, _anthropic.APIStatusError,
            _anthropic.APIConnectionError, asyncio.TimeoutError,
        ) as exc:
            last_exc = exc
            if attempt < n:
                wait = 2.0 ** attempt  # 1 s → 2 s
                logger.warning(
                    "acall_message [%s] attempt %d/%d failed (%s) — retry in %.0fs",
                    model, attempt + 1, n + 1, type(exc).__name__, wait,
                )
                await asyncio.sleep(wait)
            else:
                logger.error("acall_message [%s] all %d retries exhausted: %s", model, n + 1, exc)
    raise last_exc


def call_message(
    client: Any,
    model: str,
    system: str,
    messages: list[dict],
    max_tokens: int,
    *,
    retries: int | None = None,
    temperature: float = 1.0,
) -> Any:
    """
    Synchronous retry-aware wrapper around Anthropic.messages.create.
    Use in sync contexts (researcher, creative in sync mode).
    """
    import time
    import anthropic as _anthropic
    from config import get_settings
    settings = get_settings()
    n = retries if retries is not None else settings.llm_retries

    last_exc: Exception = RuntimeError("call_message: no attempts made")
    for attempt in range(n + 1):
        try:
            return client.messages.create(
                model=model, max_tokens=max_tokens,
                system=system, messages=messages,
                temperature=temperature,
            )
        except (
            _anthropic.RateLimitError, _anthropic.APIStatusError,
            _anthropic.APIConnectionError,
        ) as exc:
            last_exc = exc
            if attempt < n:
                wait = 2.0 ** attempt
                logger.warning(
                    "call_message [%s] attempt %d/%d failed (%s) — retry in %.0fs",
                    model, attempt + 1, n + 1, type(exc).__name__, wait,
                )
                time.sleep(wait)
            else:
                logger.error("call_message [%s] all %d retries exhausted: %s", model, n + 1, exc)
    raise last_exc


# ── Anthropic ─────────────────────────────────────────────────────────────────

def _anthropic_sync(api_key: str, model: str, system: str, user_msg: str, max_tokens: int,
                    label: str, *, temperature: float = 1.0) -> dict:
    import anthropic
    from tools.json_utils import extract_json
    try:
        client = anthropic.Anthropic(api_key=api_key)
        resp = call_message(client, model, system, [{"role": "user", "content": user_msg}],
                            max_tokens, temperature=temperature)
        _log_cost(model, resp.usage.input_tokens, resp.usage.output_tokens, label)
        raw = resp.content[0].text
        data = extract_json(raw)
        return data if isinstance(data, dict) else {}
    except Exception as exc:
        logger.error("Anthropic sync failed [%s]: %s", label, exc, exc_info=True)
        return {}


async def _anthropic_async(api_key: str, model: str, system: str, user_msg: str, max_tokens: int,
                           label: str, *, temperature: float = 1.0) -> dict:
    import anthropic
    from tools.json_utils import extract_json
    try:
        client = anthropic.AsyncAnthropic(api_key=api_key)
        resp = await acall_message(client, model, system, [{"role": "user", "content": user_msg}],
                                   max_tokens, temperature=temperature)
        _log_cost(model, resp.usage.input_tokens, resp.usage.output_tokens, label)
        raw = resp.content[0].text
        data = extract_json(raw)
        return data if isinstance(data, dict) else {}
    except Exception as exc:
        logger.error("Anthropic async failed [%s]: %s", label, exc, exc_info=True)
        return {}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _model_for_tier(tier: str, settings) -> str:
    return {
        "fast":     settings.model_fast,
        "balanced": settings.model_balanced,
        "creative": settings.model_creative,
    }.get(tier, settings.model_balanced)
