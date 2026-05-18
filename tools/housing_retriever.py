"""
Housing.com internal retriever — dummy implementation.

Maps structured content signals to Housing.com SRP and editorial URLs.
Replace stub lookups with real Housing API calls when available.

Signals schema (produced by internal_link_agent):
{
  "cities":     ["Bengaluru", "Mumbai"],
  "localities": ["Koramangala", "Powai"],       # neighbourhood names
  "filters": {
    "bedroom_type":   "2BHK",                   # 1BHK|2BHK|3BHK|4BHK|villa|null
    "max_price":      5000000,                  # INR int, or null
    "min_price":      null,
    "property_type":  "flat"                    # flat|villa|plot|commercial|null
  },
  "re_intent":  "locality_overview",            # locality_overview|rating_review|
                                                #   investment|comparison|general_search
  "theme":      "less_commute"                  # less_commute|luxury|affordable|family|
                                                #   investment|startup_hub|null
}
"""
from __future__ import annotations

import logging
from tools.housing_urls import BASE, resolve_city, CITY_DISPLAY, city_links

logger = logging.getLogger(__name__)

# ─── URL pattern builders ────────────────────────────────────────────────────

_BHK_SLUG: dict[str, str] = {
    "1bhk": "1-bhk",
    "2bhk": "2-bhk",
    "3bhk": "3-bhk",
    "4bhk": "4-bhk",
    "4+bhk": "4-plus-bhk",
    "5bhk": "5-bhk",
}

_PROPERTY_TYPE_SLUG: dict[str, str] = {
    "flat":       "flats-for-sale",
    "apartment":  "flats-for-sale",
    "villa":      "villas-for-sale",
    "plot":       "plots-for-sale",
    "commercial": "commercial-for-sale",
    "penthouse":  "penthouses-for-sale",
    "studio":     "studio-apartments-for-sale",
}

_THEME_PATH: dict[str, str] = {
    "luxury":      "luxury-homes-for-sale",
    "affordable":  "affordable-homes-for-sale",
    "less_commute": "flats-near-metro",
    "startup_hub": "flats-near-it-park",
    "family":      "family-homes-for-sale",
    "investment":  "investment-properties",
}

_RE_INTENT_ANCHOR: dict[str, str] = {
    "locality_overview": "{locality} area overview",
    "rating_review":     "{locality} locality ratings & reviews",
    "investment":        "investment properties in {city}",
    "comparison":        "compare properties in {city}",
    "general_search":    "buy property in {city}",
    "social_brand":      "explore homes in {city}",
}


def _locality_slug(name: str) -> str:
    return name.strip().lower().replace(" ", "-").replace("_", "-")


def _price_label(price: int) -> str:
    if price >= 10_000_000:
        return f"under {price // 10_000_000} cr"
    if price >= 100_000:
        return f"under {price // 100_000} lakh"
    return f"under ₹{price:,}"


def srp_filtered_url(
    city_slug: str,
    bedroom_type: str | None = None,
    property_type: str | None = None,
    locality: str | None = None,
    max_price: int | None = None,
    min_price: int | None = None,
) -> str:
    """Build a filtered SRP URL for Housing.com."""
    parts = [BASE, city_slug]
    if locality:
        parts.append(_locality_slug(locality))

    bhk = _BHK_SLUG.get((bedroom_type or "").lower())
    pt  = _PROPERTY_TYPE_SLUG.get((property_type or "").lower(), "flats-for-sale")

    if bhk:
        parts.append(f"{bhk}-{pt}")
    else:
        parts.append(pt)

    url = "/".join(parts)

    params: list[str] = []
    if max_price:
        params.append(f"budget_max={max_price}")
    if min_price:
        params.append(f"budget_min={min_price}")
    if params:
        url += "?" + "&".join(params)

    return url


def locality_url(city_slug: str, locality: str, re_intent: str = "locality_overview") -> str:
    """Build a locality-level page URL based on re_intent."""
    loc_slug = _locality_slug(locality)
    if re_intent == "rating_review":
        return f"https://housing.com/in/{city_slug}/{loc_slug}/reviews"
    return f"{BASE}/{city_slug}/{loc_slug}"


def theme_url(city_slug: str, theme: str) -> str | None:
    path = _THEME_PATH.get(theme)
    if not path:
        return None
    return f"{BASE}/{city_slug}/{path}"


# ─── Main retriever ──────────────────────────────────────────────────────────

def fetch_links_for_signals(signals: dict) -> list[dict]:
    """
    Maps extracted content signals to relevant Housing.com internal links.
    Returns up to 5 link dicts with url, anchor_text, page_type, placement.

    This is the dummy implementation — all URLs are constructed from patterns.
    Replace with real Housing API lookup when available.
    """
    links: list[dict] = []
    seen_urls: set[str] = set()

    def _add(link: dict) -> None:
        if link["url"] not in seen_urls:
            seen_urls.add(link["url"])
            links.append(link)

    cities    = signals.get("cities", [])
    localities = signals.get("localities", [])
    filters   = signals.get("filters", {}) or {}
    re_intent = signals.get("re_intent") or "general_search"
    theme     = signals.get("theme")

    bedroom_type  = filters.get("bedroom_type")
    max_price     = filters.get("max_price")
    min_price     = filters.get("min_price")
    property_type = filters.get("property_type")

    resolved_cities: list[str] = []
    for city_name in cities:
        slug = resolve_city(city_name)
        if slug:
            resolved_cities.append(slug)

    # 1a. Social/brand: just city SRP(s) — don't over-link on trend posts
    if re_intent == "social_brand":
        for city_slug in resolved_cities[:2]:
            base_links = city_links(city_slug)
            for lnk in base_links[:1]:
                _add({**lnk, "placement": "in the CTA"})
        if not links:
            for slug in ["mumbai", "bengaluru", "new-delhi"]:
                _add({**city_links(slug)[0], "placement": "in the CTA"})
        return links[:2]

    # 1. Locality-level links (most specific — go first)
    for city_slug in resolved_cities[:2]:
        display = CITY_DISPLAY.get(city_slug, city_slug.replace("-", " ").title())
        for locality in localities[:2]:
            if re_intent in ("locality_overview", "rating_review"):
                url = locality_url(city_slug, locality, re_intent)
                anchor_tmpl = _RE_INTENT_ANCHOR.get(re_intent, "properties in {locality}")
                anchor = anchor_tmpl.format(locality=locality, city=display)
                page_type = "locality_review" if re_intent == "rating_review" else "locality_overview"
                _add({"url": url, "anchor_text": anchor, "page_type": page_type,
                      "placement": "where locality is first mentioned"})

    # 2. Filtered SRP (city + filters combo)
    for city_slug in resolved_cities[:2]:
        display = CITY_DISPLAY.get(city_slug, city_slug.replace("-", " ").title())
        if bedroom_type or max_price or property_type:
            url = srp_filtered_url(city_slug, bedroom_type, property_type,
                                   max_price=max_price, min_price=min_price)
            # Build readable anchor
            parts = []
            if bedroom_type:
                parts.append(bedroom_type)
            pt_display = (property_type or "flats").title()
            parts.append(f"{pt_display}s in {display}")
            if max_price:
                parts.append(_price_label(max_price))
            anchor = " ".join(parts)
            _add({"url": url, "anchor_text": anchor, "page_type": "city_srp_filtered",
                  "placement": "in the call-to-action or conclusion"})

    # 3. Theme-specific URL
    for city_slug in resolved_cities[:1]:
        if theme:
            url = theme_url(city_slug, theme)
            if url:
                display = CITY_DISPLAY.get(city_slug, city_slug.replace("-", " ").title())
                theme_label = theme.replace("_", " ").title()
                _add({"url": url, "anchor_text": f"{theme_label} homes in {display}",
                      "page_type": "theme_srp",
                      "placement": "in the conclusion or call-to-action"})

    # 4. Generic city SRP (always useful as fallback)
    for city_slug in resolved_cities[:2]:
        base_links = city_links(city_slug)
        for lnk in base_links[:1]:  # just homepage, not both
            _add({**lnk, "placement": "in the conclusion"})

    # 5. Fallback: top metros if no signals resolved
    if not links:
        for slug in ["mumbai", "bengaluru", "new-delhi", "hyderabad"]:
            base_links = city_links(slug)
            _add({**base_links[0], "placement": "in the conclusion"})

    logger.debug("housing_retriever: %d links from signals=%s", len(links), signals)
    return links[:5]
