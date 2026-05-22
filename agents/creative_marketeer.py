"""
creative_marketeer.py — legacy shim.

creative_node has been split into:
  - agents/social_creative_agent.py  (social_creative_node)
  - agents/news_creative_agent.py    (news_creative_node)

Shared helper functions live in tools/creative_utils.py.
System prompts are preserved here for reference; production code uses the agent files.
"""
from __future__ import annotations

from tools.creative_utils import get_performance_history, normalize_drafts, parse_drafts

# Re-export under legacy names so any external callers are not broken
_get_performance_history = get_performance_history
_parse_drafts = parse_drafts

__all__ = ["get_performance_history", "normalize_drafts", "parse_drafts",
           "_get_performance_history", "_parse_drafts"]
