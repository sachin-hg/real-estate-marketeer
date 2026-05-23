from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class UserRecord(Base):
    """Investor portal users — credentials stored as bcrypt hashes."""
    __tablename__ = "users"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    username      = Column(String(64), unique=True, nullable=False, index=True)
    password_hash = Column(String(128), nullable=False)
    role          = Column(String(32), nullable=False, default="investor")
    created_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    is_active     = Column(Boolean, default=True)


class LlmCallRecord(Base):
    """Full record of every LLM API round-trip — prompts and response stored without truncation."""
    __tablename__ = "llm_calls"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    run_id        = Column(String(36), nullable=True, index=True)
    called_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    agent         = Column(String(128), nullable=True)   # e.g. "news_creative", "qa/safety/twitter/abc123"
    model         = Column(String(64), nullable=True)
    system_prompt = Column(Text, nullable=True)          # full, no truncation
    user_message  = Column(Text, nullable=True)          # full
    response_text = Column(Text, nullable=True)          # full
    stop_reason   = Column(String(32), nullable=True)
    input_tokens  = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    cost_usd      = Column(Float, nullable=True)
    elapsed_ms    = Column(Integer, nullable=True)


class ApiCallRecord(Base):
    """Full record of every external API call — endpoint, params, and response without truncation."""
    __tablename__ = "api_calls"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    run_id        = Column(String(36), nullable=True, index=True)
    called_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    agent         = Column(String(64), nullable=True)    # tool/agent that made the call
    api_name      = Column(String(64), nullable=True)    # "tavily_search", "serpapi_news", "youtube_trending"
    endpoint      = Column(String(512), nullable=True)   # URL or method name
    params_json   = Column(Text, nullable=True)          # full request params as JSON
    response_json = Column(Text, nullable=True)          # full response as JSON (may be large)
    result_count  = Column(Integer, nullable=True)       # number of items returned
    status        = Column(String(16), nullable=True)    # "ok" | "error"
    http_status   = Column(Integer, nullable=True)
    error         = Column(Text, nullable=True)
    elapsed_ms    = Column(Integer, nullable=True)
    use_case      = Column(Text, nullable=True)          # human description: "Tavily: Karnataka RERA 2026"


class RunRecord(Base):
    """One row per pipeline run — written by the publisher at the end of each run."""
    __tablename__ = "runs"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    run_id       = Column(String(36), unique=True, nullable=False, index=True)
    status       = Column(String(32), nullable=False, default="completed")
    triggered_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    dry_run      = Column(Boolean, default=True)
    topic_hint   = Column(Text, nullable=True)
    target_platforms = Column(Text, nullable=True)   # JSON array

    research_count   = Column(Integer, default=0)
    trends_count     = Column(Integer, default=0)
    briefs_count     = Column(Integer, default=0)
    drafts_count     = Column(Integer, default=0)
    posts_attempted  = Column(Integer, default=0)
    posts_approved   = Column(Integer, default=0)
    posts_published  = Column(Integer, default=0)

    error        = Column(Text, nullable=True)
    summary_json = Column(Text, nullable=True)   # full summary.json content


class PublishedPostRecord(Base):
    __tablename__ = "published_posts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    post_id = Column(String(36), unique=True, nullable=False, index=True)
    run_id = Column(String(36), nullable=False, index=True)
    platform = Column(String(32), nullable=False, index=True)
    platform_post_id = Column(String(128), nullable=True)
    published_url = Column(String(512), nullable=True)
    output_path = Column(String(512), nullable=True)
    published_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Content
    content = Column(Text, nullable=False)
    hashtags = Column(Text, nullable=True)          # JSON string
    internal_links = Column(Text, nullable=True)    # JSON string
    media_urls = Column(Text, nullable=True)        # JSON string
    creative_angle = Column(Text, nullable=True)

    # QA scores at publish time
    qa_safety_passed = Column(Boolean, nullable=True)
    qa_re_relevance = Column(Float, nullable=True)
    qa_backlink_score = Column(Float, nullable=True)
    qa_brand_voice = Column(Float, nullable=True)
    qa_overall = Column(Float, nullable=True)

    # Predicted engagement
    pred_impressions = Column(Integer, nullable=True)
    pred_likes = Column(Integer, nullable=True)
    pred_shares = Column(Integer, nullable=True)
    pred_comments = Column(Integer, nullable=True)
    pred_ctr = Column(Float, nullable=True)
    pred_engagement_rate = Column(Float, nullable=True)
    pred_confidence = Column(Float, nullable=True)

    # Actual engagement (populated by engagement tracker)
    actual_impressions_6h = Column(Integer, nullable=True)
    actual_likes_6h = Column(Integer, nullable=True)
    actual_impressions_24h = Column(Integer, nullable=True)
    actual_likes_24h = Column(Integer, nullable=True)
    actual_shares_24h = Column(Integer, nullable=True)
    actual_comments_24h = Column(Integer, nullable=True)
    actual_ctr_24h = Column(Float, nullable=True)
    actual_saves_24h = Column(Integer, nullable=True)
    actual_impressions_7d = Column(Integer, nullable=True)
    actual_engagement_7d = Column(Float, nullable=True)    # the key feedback signal
    actual_housing_traffic = Column(Integer, nullable=True)

    # Derived
    prediction_accuracy = Column(Float, nullable=True)    # actual_er / pred_er

    # QA decision (set by QA agent)
    qa_decision          = Column(String(32), nullable=True)   # "publish" | "reject"
    post_status          = Column(String(32), nullable=True, default="published")  # "published" | "qa_rejected"
    qa_rejection_reasons = Column(Text, nullable=True)         # JSON list of rejection reasons

    # User feedback (from UI or Slack)
    user_rating      = Column(Integer, nullable=True)
    user_tags        = Column(Text, nullable=True)             # JSON list
    user_feedback    = Column(Text, nullable=True)
    user_action      = Column(String(32), nullable=True)       # "approved"|"rejected"|"flagged"
    rejection_reason = Column(Text, nullable=True)             # reason for manual rejection
    # Draft metadata
    draft_type       = Column(String(16), nullable=True)
    zomato_hook      = Column(Text, nullable=True)
    trend_hashtag    = Column(String(128), nullable=True)
    media_format     = Column(String(32), nullable=True)
    # Origin of this post — human topic (manual run) or trend/news headline (auto run)
    source_topic     = Column(Text, nullable=True)
    # Platform-specific extra fields (JSON) — stored for re-publishing in HITL mode
    extra_data             = Column(Text, nullable=True)
    # QA reasoning (serialised text from QA agent)
    qa_critique            = Column(Text, nullable=True)          # narrative: what's weak and why
    qa_quality_dimensions  = Column(Text, nullable=True)          # JSON {dim: score} per-platform breakdown
    engagement_reasoning   = Column(Text, nullable=True)          # why these numbers were predicted
    # Full TrendItem that drove this post (JSON) — volume, context, creative_hook, url
    trend_data             = Column(Text, nullable=True)
    # Cloud storage URL for the primary image asset (S3/GCS/local relative URL)
    image_cloud_url        = Column(Text, nullable=True)
