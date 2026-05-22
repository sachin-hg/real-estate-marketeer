from __future__ import annotations

import json
import logging
import uuid

import anthropic

from config import get_settings
from models.state import CreativeDraft, PlatformPost

logger = logging.getLogger(__name__)

SYSTEM = """You are a senior content writer for housing.com/news — India's leading \
real estate news platform. Write SEO-optimised, authoritative, and slightly sparkly articles.

Article requirements:
- Length: 700-1000 words
- Structure: H1 → hook para → H2 sections → data → conclusion with CTA
- SEO: naturally include the target keywords 2-3× each; use H2 subheadings
- Internal links: weave housing.com links naturally into the prose (not a list at the end)
- Tone: authoritative, helpful, slightly aspirational — NOT salesy
- Include: 1 pull quote, 1 data callout box (described in text), CTA paragraph at end
- Disclaimer if needed: "Prices mentioned are indicative and subject to change."

SPARKLY RULES:
- Headline: curiosity-gap hook, NOT just keyword-stuffed.
  BAD: "Pune Real Estate Market 2025 Update"
  GOOD: "The City Nobody Expected to Beat Mumbai — Pune's Quiet Property Surge in 2025"
- Opening sentence: conversational and surprising BEFORE going formal.
  BAD: "The Indian real estate market has seen significant changes in 2025."
  GOOD: "If you'd told a Mumbai developer two years ago that Pune would outsell them, they'd have laughed."
- Pull quote: must be independently shareable — a stat or insight that works as a standalone tweet.

Return JSON:
{
  "seo_title": "...",
  "meta_description": "...(150 chars max)",
  "slug": "url-friendly-slug",
  "article_body": "full markdown article...",
  "pull_quote": "...",
  "reading_time_minutes": 4,
  "primary_keyword": "...",
  "secondary_keywords": ["...", "..."],
  "schema_type": "NewsArticle|HowTo|FAQ"
}

CREATIVE ANGLE INTEGRITY:
The draft's `angle` field is the creative director's instruction. Your role is to
EXPRESS that angle in platform-appropriate format — not replace or dilute it.
If the angle says "Hyderabad metro expansion makes 3 localities the new hotspots",
every line of output should reinforce that framing. Never drift into generic
real estate copy unrelated to the angle."""


async def run_housing_news_agent(draft: CreativeDraft, settings) -> PlatformPost:
    from tools.run_logger import Timer, log_llm_call, log_agent_io
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    links = draft.get("internal_links", [])
    links_text = "\n".join(
        f"  - [{l.get('anchor_text', l['url'])}]({l['url']}) — use near content about {l.get('placement', 'related topic')}"
        for l in links
    )

    pull_quote_hint = draft.get("pull_quote", "")
    meta_hint = draft.get("meta_description", "")
    slug_hint = draft.get("slug", "")

    user_message = f"""
Angle: {draft['angle']}
Headline: {draft['headline']}
Hook: {draft['hook']}
Full body draft: {draft['body']}
Meme / data callout: {draft.get('meme_concept', '')}
SEO keywords: {', '.join(draft.get('seo_keywords', []))}
Urgency context: {draft.get('urgency_hook', '')}
{f'Suggested pull quote: {pull_quote_hint}' if pull_quote_hint else ''}
{f'Suggested meta description: {meta_hint}' if meta_hint else ''}
{f'Suggested slug: {slug_hint}' if slug_hint else ''}

INTERNAL LINKS TO WEAVE IN (mandatory):
{links_text if links_text else '  - https://housing.com (general CTA)'}

Expand the body to 700-1000 words if needed, weave in the internal links naturally,
and produce the final JSON with all fields."""

    logger.info("Housing News agent: draft='%s' | internal_links=%d",
                draft.get("headline", "")[:60], len(links))

    from tools.llm_router import acall_message
    with Timer() as t:
        resp = await acall_message(
            client, settings.model_balanced, SYSTEM,
            [{"role": "user", "content": user_message}], 3500,
        )
    raw_response = resp.content[0].text
    log_llm_call(
        logger,
        agent="housing_news_agent",
        model=settings.model_balanced,
        system_prompt=SYSTEM,
        user_message=user_message,
        response_text=raw_response,
        stop_reason=resp.stop_reason,
        elapsed_ms=t.elapsed_ms,
        extra={"draft_headline": draft.get("headline", "")[:60],
               "links_count": len(links),
               "input_tokens": resp.usage.input_tokens,
               "output_tokens": resp.usage.output_tokens},
    )

    data = _parse(raw_response)
    article_body = data.get("article_body", draft["body"])

    # Embed city name hyperlinks in the article body (housing.com/news renders markdown)
    from tools.link_embedder import embed_city_links
    article_body = embed_city_links(article_body, "housing_news", links)

    post = {
        "id": str(uuid.uuid4()),
        "draft_id": draft["id"],
        "platform": "housing_news",
        "content": article_body,
        "hashtags": draft.get("hashtags", [])[:10],
        "media_urls": [],
        "image_prompt": f"Hero image for article: {draft['headline']}. Photorealistic, Indian real estate, no text.",
        "internal_links": links,
        "extra": {
            "seo_title": data.get("seo_title", draft["headline"]),
            "meta_description": data.get("meta_description", ""),
            "slug": data.get("slug", ""),
            "pull_quote": data.get("pull_quote", ""),
            "reading_time_minutes": data.get("reading_time_minutes", 5),
            "primary_keyword": data.get("primary_keyword", ""),
            "secondary_keywords": data.get("secondary_keywords", []),
            "schema_type": data.get("schema_type", "NewsArticle"),
        },
        "status": "draft",
    }
    logger.info("Housing News agent: done | article_chars=%d | slug='%s' | read_time=%s min",
                len(article_body), data.get("slug", ""), data.get("reading_time_minutes", "?"))
    log_agent_io(
        logger,
        agent="housing_news_agent",
        inputs={"headline": draft.get("headline", ""), "angle": draft.get("angle", ""),
                "seo_keywords": draft.get("seo_keywords", [])},
        outputs={"seo_title": data.get("seo_title", ""), "slug": data.get("slug", ""),
                 "meta_description": data.get("meta_description", ""),
                 "article_chars": len(article_body),
                 "primary_keyword": data.get("primary_keyword", "")},
    )
    return post


def _parse(raw: str) -> dict:
    from tools.json_utils import extract_json
    data = extract_json(raw)
    # Model sometimes returns the article as raw markdown rather than JSON
    return data if isinstance(data, dict) else {"article_body": raw}
