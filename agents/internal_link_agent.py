"""
Internal Link Agent.

Uses Claude to extract structured real-estate signals from post content,
then calls the Housing internal retriever to get relevant internal links.

Signals extracted:
  cities      — city names mentioned or implied
  localities  — neighbourhood/area names (Koramangala, Powai, Bandra, etc.)
  filters     — bedroom_type (2BHK), max_price (5000000), property_type (flat)
  re_intent   — locality_overview | rating_review | investment | comparison | general_search | social_brand
  theme       — less_commute | luxury | affordable | family | investment | startup_hub | null
"""
from __future__ import annotations

import logging

from config import get_settings
from tools.housing_retriever import fetch_links_for_signals
from tools.housing_urls import CITIES

logger = logging.getLogger(__name__)

EXTRACTION_SYSTEM = """You extract real estate signals from marketing content.

Given post content (social caption, tweet, news headline, or article body), return a JSON object with these fields:

{
  "cities": ["<city name>"],
  "localities": ["<neighbourhood/area name>"],
  "filters": {
    "bedroom_type": "2BHK" | "3BHK" | "1BHK" | "4BHK" | "villa" | null,
    "max_price": <int INR or null>,
    "min_price": <int INR or null>,
    "property_type": "flat" | "villa" | "plot" | "commercial" | null
  },
  "re_intent": "locality_overview" | "rating_review" | "investment" | "comparison" | "general_search" | "social_brand",
  "theme": "less_commute" | "luxury" | "affordable" | "family" | "investment" | "startup_hub" | null
}

PRICE PARSING:
- "under 50 lakh" → max_price: 5000000
- "under 1 crore" / "under 1 cr" → max_price: 10000000
- "under 5 cr" → max_price: 50000000
- "2 cr budget" → max_price: 20000000
- "50L" / "50 lacs" → max_price: 5000000

RE_INTENT GUIDE:
- locality_overview → post discusses what a neighbourhood is like
- rating_review → post asks or discusses "is X area good?", livability ratings
- investment → post discusses buying for returns, price appreciation, rental yield
- comparison → post compares two areas or options
- general_search → default when just looking for a home to live in
- social_brand → Zomato-style social content with a light RE reference; use when the post is primarily about a trend/event and housing is just the CTA angle

THEME GUIDE:
- less_commute → near office, metro connectivity, WFH, IT parks
- luxury → premium, high-end, penthouses, 4BHK+, sea-facing
- affordable → budget homes, first home buyers, EMI affordability
- family → schools nearby, gated society, playgrounds
- startup_hub → young professionals, co-working, Bengaluru/Pune/Hyderabad IT belt
- investment → rental income, capital appreciation angle

Cities must be real Indian cities. Localities are sub-city areas.
If the content has no real estate signals, return empty lists and null values.
Return ONLY valid JSON — no prose, no markdown fences."""


def _extract_signals(content: str) -> dict:
    """Call LLM (Gemini Flash if configured, else Haiku) to extract RE signals from content."""
    from tools.llm_router import call_json_sync

    city_hint = ", ".join(CITIES[:20])
    user_msg = f"Known Housing.com cities (use these spellings): {city_hint}\n\nCONTENT:\n{content[:2000]}"

    signals = call_json_sync(
        tier="fast",
        system=EXTRACTION_SYSTEM,
        user_msg=user_msg,
        max_tokens=512,
        log_label="internal_link_agent/extract_signals",
    )
    if not signals:
        return {"cities": [], "localities": [], "filters": {},
                "re_intent": "general_search", "theme": None}
    signals.setdefault("cities", [])
    signals.setdefault("localities", [])
    signals.setdefault("filters", {})
    signals.setdefault("re_intent", "general_search")
    signals.setdefault("theme", None)
    return signals


def _draft_content(draft: dict) -> str:
    """Assemble a short text representation of the draft for signal extraction."""
    draft_type = draft.get("draft_type", "social")
    parts: list[str] = []
    if draft_type == "social":
        # Social drafts: body/hook are empty — use zomato_hook + caption as primary content
        for field in ("headline", "zomato_hook", "caption", "urgency_hook"):
            val = draft.get(field, "")
            if val:
                parts.append(str(val)[:500])
    else:
        # News drafts: full body + hook available
        for field in ("headline", "hook", "body", "angle"):
            val = draft.get(field, "")
            if val:
                parts.append(str(val)[:500])
    # city_hint is always a strong signal regardless of type
    city_hint = draft.get("city_hint")
    if city_hint:
        parts.append(f"City context: {city_hint}")
    return "\n".join(parts)


def build_links_for_draft(draft: dict) -> tuple[list[dict], dict]:
    """Extract signals from one draft and return (internal_links, re_signals)."""
    content = _draft_content(draft)
    if not content.strip():
        return [], {}

    signals = _extract_signals(content)
    logger.debug(
        "internal_link_agent: draft='%s' | signals=%s",
        draft.get("headline", "")[:50],
        json.dumps(signals),
    )
    links = fetch_links_for_signals(signals)
    logger.info(
        "internal_link_agent: draft='%s' | cities=%s localities=%s filters=%s intent=%s theme=%s → %d links",
        draft.get("headline", draft.get("zomato_hook", ""))[:50],
        signals.get("cities"),
        signals.get("localities"),
        signals.get("filters"),
        signals.get("re_intent"),
        signals.get("theme"),
        len(links),
    )
    return links, signals


def run_internal_link_agent(state: dict) -> dict:
    """LangGraph node: enrich all creative drafts with internal links and RE signals."""
    enriched = []
    for draft in state.get("creative_drafts", []):
        links, signals = build_links_for_draft(draft)
        enriched.append({**draft, "internal_links": links, "re_signals": signals})
    return {"creative_drafts": enriched}
