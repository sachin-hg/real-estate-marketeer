"""
Tag-based example retriever for the social creative agent.

Loads hooks_bank.json once, indexes by tag, and returns the most relevant
examples for a given set of trend tags — keeping the LLM context window lean.

Usage:
    from tools.example_retriever import get_relevant_examples
    snippet = get_relevant_examples(["cricket", "bengaluru", "sports"], top_n=6)
    # Returns a markdown snippet ready to paste into a system/user prompt
"""
from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

# Canonical tag taxonomy — used to validate / normalise tags from the LLM
TAG_TAXONOMY: set[str] = {
    # Sports
    "cricket", "sports", "ipl",
    # Entertainment
    "bollywood", "music", "comedy", "entertainment",
    # Celebrity / Social
    "celebrity", "influencer", "lifestyle", "social", "viral", "viral-trend",
    "humor", "drama", "reels",
    # Politics / Government
    "politics", "elections", "india", "national-pride",
    # Finance
    "finance", "ipo", "startup", "investment", "homeloan", "banking", "emi",
    "fintech", "rbi", "tax", "budget", "savings", "middle-class",
    # Commodities
    "gold", "petrol", "lpg", "commodities",
    # Tech / AI
    "tech", "ai", "jobs", "layoffs", "instability",
    # Weather / Environment
    "weather", "rain", "monsoon", "flooding", "heatwave", "summer",
    "cyclone", "storm", "aqi", "pollution", "green-living",
    # Infrastructure / Commute
    "infrastructure", "civic", "commute", "traffic", "transport",
    "safety", "construction",
    # Lifestyle
    "luxury", "antilla", "travel", "hills", "festival", "celebration",
    "wedding", "food", "consumer", "news", "media",
    # Education
    "education", "youth", "protests",
    # Festivals
    "diwali", "holi", "eid",
    # Cities (also valid tags)
    "delhi", "mumbai", "bengaluru", "noida", "gurgaon", "pune", "hyderabad",
    "chennai", "kolkata", "mumbai", "bareilly", "up", "shift", "comeback",
    "social-media", "dhurandhar",
}

# Tag aliases: LLM sometimes uses different spellings → normalise to canonical
TAG_ALIASES: dict[str, str] = {
    "bangalore": "bengaluru",
    "bombay": "mumbai",
    "ncr": "delhi",
    "repo-rate": "rbi",
    "repo rate": "rbi",
    "artificial intelligence": "ai",
    "machine learning": "ai",
    "ipl": "cricket",
    "weather-event": "weather",
    "flood": "flooding",
    "monsoon-flooding": "flooding",
    "inflation": "commodities",
    "economy": "finance",
    "gdp": "national-pride",
    "ambani": "celebrity",
    "bollywood-celebs": "bollywood",
    "reels": "viral-trend",
    "trending": "viral",
    "meme": "humor",
}


@lru_cache(maxsize=1)
def _load_bank() -> list[dict]:
    path = Path("prompts/hooks_bank.json")
    if not path.exists():
        logger.warning("hooks_bank.json not found at %s", path.resolve())
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    logger.info("Example retriever: loaded %d examples from hooks_bank.json", len(data))
    return data


def _normalise_tags(tags: list[str]) -> set[str]:
    """Lowercase, alias-resolve, and filter to known taxonomy."""
    result: set[str] = set()
    for raw in tags:
        t = raw.strip().lower().lstrip("#")
        t = TAG_ALIASES.get(t, t)
        if t in TAG_TAXONOMY:
            result.add(t)
        else:
            # Still include if it looks like a city or proper noun — let overlap scoring handle it
            result.add(t)
    return result


def get_relevant_examples(
    trend_tags: list[str],
    top_n: int = 14,
    fallback_n: int = 6,
) -> str:
    """
    Return a formatted markdown snippet of the most relevant hook examples.

    Scoring: each example gets +1 point per overlapping tag with trend_tags.
    Diversity weighting: at most 2 examples sharing the same dominant tag cluster.
    If no matches, returns fallback_n highest-diversity examples.

    Args:
        trend_tags: tags from the current trend batch (from social_trend_researcher)
        top_n: max examples to return when matches found
        fallback_n: examples to return when no tag overlap (diverse fallback)
    """
    bank = _load_bank()
    if not bank:
        return ""

    query = _normalise_tags(trend_tags)

    scored: list[tuple[int, dict]] = []
    for ex in bank:
        ex_tags = _normalise_tags(ex.get("tags", []))
        overlap = len(query & ex_tags)
        if overlap > 0:
            scored.append((overlap, ex))

    scored.sort(key=lambda x: x[0], reverse=True)

    # Diversity weighting: max 2 examples per dominant tag to avoid clustering
    selected: list[dict] = []
    tag_cluster_count: dict[str, int] = {}
    for score, ex in scored:
        ex_tags = _normalise_tags(ex.get("tags", []))
        dominant = next(iter(ex_tags & query), None) if ex_tags & query else None
        if dominant and tag_cluster_count.get(dominant, 0) >= 2:
            continue
        selected.append(ex)
        if dominant:
            tag_cluster_count[dominant] = tag_cluster_count.get(dominant, 0) + 1
        if len(selected) >= top_n:
            break

    if not selected:
        # No tag overlap — return a diverse fallback spread across different categories
        seen_tags: set[str] = set()
        for ex in bank:
            ex_tags = set(ex.get("tags", []))
            if not ex_tags & seen_tags:
                selected.append(ex)
                seen_tags |= ex_tags
            if len(selected) >= fallback_n:
                break

    logger.info(
        "Example retriever: query_tags=%s → %d/%d examples selected (top overlap=%d)",
        sorted(query)[:6],
        len(selected),
        len(bank),
        scored[0][0] if scored else 0,
    )

    return _format_examples(selected)


_WHAT_NOT_TO_DO = """
WHAT NOT TO DO (avoid these failure patterns):
❌ "Ghar dhundho, Housing.com pe jao" — too generic, no tie to the trend
❌ "Pakistan ke match ke baad, Housing.com pe apna ghar dhundho" — bolted-on CTA, no real connection
❌ Formal English: "Find your dream home at Housing.com" — wrong tone for social
❌ Paragraph-length cards — card text must be 2-3 lines max, scrollstopper punchy
❌ Missing trend_hashtag — the original trending hashtag MUST be first in hashtags list"""


def _format_examples(examples: list[dict]) -> str:
    """Format examples as a compact markdown block for prompt injection."""
    if not examples:
        return ""

    lines = ["APPROVED HOOK EXAMPLES (match this style, tone, and media_format decisions):"]
    for ex in examples:
        city_hint = ex.get("city_hint")
        city_note = f" [City: {city_hint}]" if city_hint else ""
        fmt = ex.get("media_format", "branded_card")
        concept = ex.get("meme_concept", "")
        lines.append(f"\n[{', '.join(ex.get('tags', [])[:3])}]{city_note} | media_format: {fmt}")
        lines.append(f"CARD/OVERLAY TEXT: {ex['card']}")
        lines.append(f"CAPTION: {ex['caption']}")
        if concept:
            lines.append(f"MEME CONCEPT: {concept[:120]}")
        if ex.get("hashtags"):
            lines.append(f"HASHTAGS: {' '.join(ex['hashtags'])}")

    lines.append(_WHAT_NOT_TO_DO)
    return "\n".join(lines)


def get_all_tags() -> list[str]:
    """Return all unique tags in the bank — useful for prompt/UI tooling."""
    bank = _load_bank()
    tags: set[str] = set()
    for ex in bank:
        tags.update(ex.get("tags", []))
    return sorted(tags)
