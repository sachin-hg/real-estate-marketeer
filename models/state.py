from __future__ import annotations

import operator
from typing import Annotated, Any, Optional, TypedDict


class NewsItem(TypedDict):
    headline: str
    source: str
    url: str
    summary: str
    relevance: str        # why this matters for housing.com audience


class TrendItem(TypedDict):
    hashtag: str
    volume: str           # "high" | "medium" | "rising" — qualitative from scraper
    platform: str         # twitter | google | instagram
    context: str          # what the trend is about
    creative_hook: str    # punchy Hinglish Housing.com post idea
    city_hint: Optional[str]    # city name if content is city-specific
    tags: list[str]       # content categories for example retrieval (e.g. ["cricket","bengaluru"])


class InternalLink(TypedDict):
    url: str
    anchor_text: str
    page_type: str        # city_homepage | city_srp | builder | project_microsite
    placement: str        # where in the article/post to insert it


class RESignalsFilters(TypedDict, total=False):
    bedroom_count: Optional[int]
    budget_min: Optional[int]
    budget_max: Optional[int]
    property_type: Optional[str]   # "apartment" | "villa" | "plot" | "commercial"


class RESignals(TypedDict, total=False):
    cities: list[str]
    localities: list[str]
    filters: RESignalsFilters
    re_intent: str    # "buy" | "rent" | "invest" | "none"
    theme: str        # "price_trend" | "infra" | "policy" | "lifestyle" | "viral"


class CreativeDraft(TypedDict):
    id: str               # uuid
    draft_type: str       # "social" | "news"
    angle: str            # the creative connection being made
    headline: str
    hook: str             # opening 2 lines
    body: str             # full content
    meme_concept: str
    hashtags: list[str]
    seo_keywords: list[str]
    target_platforms: list[str]
    urgency_hook: str
    internal_links: list[InternalLink]   # filled in by retriever node
    # social-track fields (used by instagram + twitter agents)
    zomato_hook: str      # punchy 1-2 line image card text (Hinglish)
    caption: str          # short post caption ≤150 chars (Hinglish)
    city_hint: Optional[str]  # city name if content is city-specific (for SRP link)
    # media format for visual posts
    media_format: str     # "branded_card" | "meme_overlay" | "text_only"
    trend_hashtag: str    # the single original trending hashtag driving this post (e.g. "#FA9LA")
    # structured RE signals extracted by internal_link_agent (filled after creative node)
    re_signals: Optional[RESignals]


class PlatformPost(TypedDict):
    id: str               # uuid
    draft_id: str         # which CreativeDraft this came from
    platform: str         # twitter | instagram | youtube | housing_news
    content: str          # final formatted text
    hashtags: list[str]
    media_urls: list[str]      # generated image URLs (empty if dry_run or no key)
    image_prompt: str          # DALL-E prompt used (for audit)
    internal_links: list[InternalLink]
    extra: dict[str, Any]      # platform-specific fields (thread parts, video script, etc.)
    status: str                # draft | approved | rejected | published


class QAResult(TypedDict):
    post_id: str
    platform: str
    safety_passed: bool
    safety_violations: list[str]
    re_relevance_score: float
    backlink_score: float
    brand_voice_score: float
    factual_score: float
    overall_quality_score: float
    quality_issues: list[str]
    pred_impressions: int
    pred_likes: int
    pred_shares: int
    pred_comments: int
    pred_ctr: float
    pred_engagement_rate: float
    pred_confidence: float
    engagement_reasoning: str
    top_element: str
    weak_element: str
    decision: str              # publish | revise | reject
    revision_notes: str
    # Structured critique (populated on revise decisions for the retry loop)
    critique: str
    revision_instructions: list[str]
    qa_attempt: int            # which attempt produced this result (1-indexed)
    quality_scores: dict       # raw per-dimension scores from quality LLM pass {dim: float}


class PublishedPost(TypedDict):
    post_id: str
    platform: str
    platform_post_id: str      # ID returned by platform API
    url: str                   # live URL of the published post
    output_path: str           # local file path (dry_run mode)


class ContentBrief(TypedDict):
    topic: str
    angle: str
    draft_type: str           # "social" | "news"
    target_platforms: list[str]
    tone: str                 # "hinglish_viral" | "formal_seo" | "educational"
    city_hint: Optional[str]
    urgency: str
    seo_keywords: list[str]   # news only; [] for social
    source_summary: str       # 1-2 sentence context injected into creative prompt


class WorkflowState(TypedDict):
    # ── Inputs ────────────────────────────────────────────────────────────────
    run_id: str
    triggered_at: str
    dry_run: bool
    topic_hint: Optional[str]          # optional focus area from CLI
    slack_topic: Optional[str]         # raw topic/URL from Slack bot (direct pipeline only)
    target_platforms: list[str]

    # ── Research phase (written once; researcher + trend_researcher are parallel) ─
    research: list[NewsItem]
    trends: list[TrendItem]

    # ── Content phase ─────────────────────────────────────────────────────────
    content_briefs: list[ContentBrief]      # written by planner; read by creative nodes
    creative_drafts: Annotated[list[CreativeDraft], operator.add]

    # ── Platform phase (accumulated from parallel platform agents) ────────────
    platform_posts: Annotated[list[PlatformPost], operator.add]

    # ── QA phase ──────────────────────────────────────────────────────────────
    qa_results: list[QAResult]
    approved_posts: list[PlatformPost]
    retry_count: int
    qa_post_attempts: dict[str, int]   # post_id → number of QA attempts so far

    # ── Output ────────────────────────────────────────────────────────────────
    published: list[PublishedPost]
    error: Optional[str]
