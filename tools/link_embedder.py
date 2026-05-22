"""
Post-process platform content to embed housing.com city links where possible.

Platform support:
  housing_news — inline [CityName](url) markdown (article renders as HTML)
  youtube      — append 🔗 Links: section (plain URLs auto-link in descriptions)
  linkedin     — append city SRP URL as plain text (auto-links in LinkedIn)
  twitter      — unchanged (Twitter truncates URLs; one primary link is best)
  instagram    — unchanged (no clickable links in captions)
"""
from __future__ import annotations

import re
from functools import lru_cache

from tools.housing_urls import CITY_DISPLAY, CITY_ALIASES, city_srp_url

# ── Name → (slug, display, url) lookup ────────────────────────────────────────

@lru_cache(maxsize=1)
def _build_lookup() -> dict[str, tuple[str, str, str]]:
    """Build every variant (display name + aliases) → (slug, canonical display, url)."""
    result: dict[str, tuple[str, str, str]] = {}
    for slug, display in CITY_DISPLAY.items():
        url = city_srp_url(slug)
        result[display] = (slug, display, url)                       # "Gurgaon"
        result[display.lower()] = (slug, display, url)               # "gurgaon"
    for alias, slug in CITY_ALIASES.items():
        display = CITY_DISPLAY.get(slug, alias.title())
        url = city_srp_url(slug)
        result[alias] = (slug, display, url)                         # "gurugram"
        result[alias.title()] = (slug, display, url)                 # "Gurugram"
    return result


@lru_cache(maxsize=1)
def _sorted_names() -> list[str]:
    """Names sorted by length descending so 'Greater Noida' matches before 'Noida'."""
    return sorted(_build_lookup().keys(), key=len, reverse=True)


# Matches markdown links [text](url) AND bare http(s) URLs — protected from substitution
_PROTECTED = re.compile(
    r'\[(?:[^\]]+)\]\([^)]+\)'   # existing markdown link
    r'|https?://\S+'              # bare URL
)


# ── Public entry point ─────────────────────────────────────────────────────────

def embed_city_links(content: str, platform: str, links: list[dict]) -> str:
    """
    Embed housing.com city links into content, adapting to platform capabilities.
    Returns content unchanged for platforms that don't support links.
    """
    if platform == "housing_news":
        return _embed_markdown(content)
    if platform == "youtube":
        return _append_links_section(content, links)
    if platform == "linkedin":
        return _append_linkedin_city_url(content, links)
    return content  # twitter, instagram — no change


# ── housing_news: inline [CityName](url) markdown ────────────────────────────

def _embed_markdown(content: str) -> str:
    """
    Replace the first occurrence of each city name in plain-text spans
    with [CityName](url) markdown. Already-linked and URL text is protected.
    """
    lookup = _build_lookup()
    names = _sorted_names()
    linked_slugs: set[str] = set()

    # Tokenise into protected spans and plain-text spans
    segments: list[tuple[bool, str]] = []
    last_end = 0
    for m in _PROTECTED.finditer(content):
        if m.start() > last_end:
            segments.append((False, content[last_end:m.start()]))
        segments.append((True, m.group(0)))
        last_end = m.end()
    if last_end < len(content):
        segments.append((False, content[last_end:]))

    result_parts: list[str] = []
    for protected, text in segments:
        if protected:
            result_parts.append(text)
            continue

        for name in names:
            slug, display, url = lookup[name]
            if slug in linked_slugs:
                continue
            # \b works for ASCII city names; IGNORECASE so we capture original casing
            pattern = r'\b' + re.escape(name) + r'\b'
            new_text, n = re.subn(
                pattern,
                lambda m, _url=url: f'[{m.group(0)}]({_url})',
                text,
                count=1,
                flags=re.IGNORECASE,
            )
            if n:
                linked_slugs.add(slug)
                text = new_text

        result_parts.append(text)

    return "".join(result_parts)


# ── youtube: append 🔗 Links: section ────────────────────────────────────────

def _append_links_section(content: str, links: list[dict]) -> str:
    """
    Append a plain-text links block to YouTube content.
    YouTube descriptions auto-link bare URLs.
    """
    city_links = _dedupe_city_links(links)
    if not city_links:
        return content

    lines = ["🔗 City Links:"]
    for link in city_links:
        anchor = link.get("anchor_text") or _slug_to_display(link["url"])
        lines.append(f"{anchor}: {link['url']}")

    return content.rstrip() + "\n\n" + "\n".join(lines)


# ── linkedin: append city SRP URL ─────────────────────────────────────────────

def _append_linkedin_city_url(content: str, links: list[dict]) -> str:
    """
    Append the city SRP URL(s) as plain text after the LinkedIn post.
    LinkedIn auto-links bare URLs, making them clickable.
    """
    city_links = _dedupe_city_links(links)
    if not city_links:
        return content

    parts = [content.rstrip()]
    for link in city_links[:2]:  # max 2 city links for LinkedIn brevity
        anchor = link.get("anchor_text") or _slug_to_display(link["url"])
        parts.append(f"🏠 {anchor}: {link['url']}")

    return "\n".join(parts)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _dedupe_city_links(links: list[dict]) -> list[dict]:
    """Return only housing.com city/project links, deduplicated by URL."""
    seen: set[str] = set()
    result: list[dict] = []
    for link in links:
        url = link.get("url", "")
        if not url or url in seen:
            continue
        if "housing.com" not in url:
            continue
        seen.add(url)
        result.append(link)
    return result


def _slug_to_display(url: str) -> str:
    """Best-effort: extract a human-readable label from a housing.com URL."""
    path = url.rstrip("/").split("/")[-1]
    # Remove suffixes like -bid, -pid
    path = re.sub(r"-(bid|pid)$", "", path)
    # real-estate-gurgaon → Gurgaon
    path = re.sub(r"^real-estate-", "", path)
    return path.replace("-", " ").title()
