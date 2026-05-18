from __future__ import annotations


def safe_signals(draft: dict) -> dict:
    """Return a normalised re_signals dict with all keys guaranteed present."""
    s = draft.get("re_signals") or {}
    return {
        "cities":     s.get("cities") or [],
        "localities": s.get("localities") or [],
        "filters":    s.get("filters") or {},
        "re_intent":  s.get("re_intent", "none"),
        "theme":      s.get("theme", ""),
    }
