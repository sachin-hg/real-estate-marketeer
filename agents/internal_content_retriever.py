"""
Internal content retriever agent.

Uses Claude to extract city/builder/project mentions from creative content,
then maps them to the correct housing.com URLs using housing_urls.py.

The actual search/lookup against Housing's backend is stubbed — replace
fetch_builder_slug() and fetch_project_slug() with real API calls when ready.
"""

import json
import logging
import anthropic
from config import get_settings
from tools.housing_urls import (
    CITIES,
    CITY_DISPLAY,
    resolve_city,
    city_links,
    builder_link,
    project_link,
)

logger = logging.getLogger(__name__)


def _get_client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=get_settings().anthropic_api_key)

# ---------------------------------------------------------------------------
# Stubs — swap these for real Housing API calls in the actual implementation
# ---------------------------------------------------------------------------

def fetch_builder_slug(builder_name: str, city_slug: str | None = None) -> str | None:
    """
    TODO: query Housing's builder index to get the canonical builder slug.
    Returns None if builder is not in Housing's database.
    Stub: return a sanitised version of the name as a best-effort slug.
    """
    return builder_name.strip().lower().replace(" ", "-")


def fetch_project_slug(
    project_name: str, builder_name: str | None = None, city_slug: str | None = None
) -> str | None:
    """
    TODO: query Housing's project index to get the canonical project slug.
    Returns None if project is not found.
    Stub: return a sanitised version of the name.
    """
    return project_name.strip().lower().replace(" ", "-")


# ---------------------------------------------------------------------------
# Extraction prompt
# ---------------------------------------------------------------------------

EXTRACTION_PROMPT = """
You are helping build internal links for a Housing.com article.

Extract every city, builder, and project name mentioned in the content below.
Only include entities that are plausibly searchable on a real estate platform.

For cities, use ONLY names from this list (these are Housing.com's primary markets):
{city_list}

Respond with JSON only — no prose, no markdown fences:
{{
  "cities": ["<city name as mentioned>", ...],
  "builders": [
    {{"name": "<builder name>", "city": "<primary city if clear, else null>"}}
  ],
  "projects": [
    {{"name": "<project name>", "builder": "<builder if known, else null>", "city": "<city if clear, else null>"}}
  ]
}}

If nothing is found for a category return an empty list.

CONTENT:
{content}
"""

LINK_SELECTION_PROMPT = """
You are an SEO strategist for Housing.com.

Given this content and these candidate internal links, select the 3-5 most relevant
links and suggest where in the content to place them (natural anchor text, not dumped at end).

CONTENT HEADLINE: {headline}
CONTENT EXCERPT: {excerpt}

CANDIDATE LINKS:
{candidates}

Return JSON only:
[
  {{
    "url": "...",
    "anchor_text": "...",
    "page_type": "...",
    "placement": "after paragraph mentioning X / in the intro / in the conclusion"
  }},
  ...
]
"""


# ---------------------------------------------------------------------------
# Main retriever
# ---------------------------------------------------------------------------

def run_internal_retriever(state: dict) -> dict:
    """
    For each creative content piece, extract entity mentions and attach
    relevant housing.com internal links.
    """
    enriched_drafts = []

    for draft in state.get("creative_drafts", []):
        links = build_links_for_draft(draft)
        enriched_drafts.append({**draft, "internal_links": links})

    return {"creative_drafts": enriched_drafts}


def build_links_for_draft(draft: dict) -> list[dict]:
    content_text = f"{draft.get('headline', '')}\n\n{draft.get('body', '')}"

    # Step 1: extract entities from content
    entities = extract_entities(content_text)

    # Step 2: build candidate link pool
    candidates = build_candidate_links(entities)

    if not candidates:
        # Fallback: link to the top metro markets generically
        candidates = _fallback_links()

    # Step 3: ask Claude to pick the best 3-5 and suggest placement
    selected = select_best_links(draft, candidates)
    return selected


def extract_entities(content: str) -> dict:
    city_list = "\n".join(
        f"  - {slug} ({CITY_DISPLAY[slug]})" for slug in CITIES
    )
    prompt = EXTRACTION_PROMPT.format(city_list=city_list, content=content[:3000])

    response = _get_client().messages.create(
        model=get_settings().model_fast,
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    try:
        raw = response.content[0].text.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"cities": [], "builders": [], "projects": []}


def build_candidate_links(entities: dict) -> list[dict]:
    candidates: list[dict] = []

    # City links
    for city_name in entities.get("cities", []):
        slug = resolve_city(city_name)
        if slug:
            candidates.extend(city_links(slug))

    # Builder links
    for builder in entities.get("builders", []):
        city_slug = resolve_city(builder["city"]) if builder.get("city") else None
        slug = fetch_builder_slug(builder["name"], city_slug)
        if slug:
            candidates.append(builder_link(builder["name"], slug))

    # Project links
    for project in entities.get("projects", []):
        city_slug = resolve_city(project["city"]) if project.get("city") else None
        slug = fetch_project_slug(
            project["name"],
            builder_name=project.get("builder"),
            city_slug=city_slug,
        )
        if slug:
            candidates.append(
                project_link(project["name"], slug, city_slug)
            )

    # Deduplicate by URL
    seen: set[str] = set()
    unique: list[dict] = []
    for link in candidates:
        if link["url"] not in seen:
            seen.add(link["url"])
            unique.append(link)

    return unique


def select_best_links(draft: dict, candidates: list[dict]) -> list[dict]:
    if len(candidates) <= 3:
        return candidates  # no need to call the model

    prompt = LINK_SELECTION_PROMPT.format(
        headline=draft.get("headline", ""),
        excerpt=draft.get("body", "")[:800],
        candidates=json.dumps(candidates, indent=2),
    )

    response = _get_client().messages.create(
        model=get_settings().model_fast,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    try:
        raw = response.content[0].text.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        return json.loads(raw)
    except json.JSONDecodeError:
        return candidates[:5]


def _fallback_links() -> list[dict]:
    """
    When content mentions no specific city, return homepage links for the
    top 4 metros as generic anchor links.
    """
    top_metros = ["mumbai", "bengaluru", "new-delhi", "hyderabad"]
    links = []
    for slug in top_metros:
        links.append(city_links(slug)[0])  # homepage link only
    return links
