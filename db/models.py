from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


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

    # User feedback (from UI)
    user_rating      = Column(Integer, nullable=True)
    user_tags        = Column(Text, nullable=True)           # JSON list
    user_feedback    = Column(Text, nullable=True)
    user_action      = Column(String(32), nullable=True)     # "approved"|"rejected"|"flagged"
    rejection_reason = Column(Text, nullable=True)
    # Draft metadata
    draft_type       = Column(String(16), nullable=True)
    zomato_hook      = Column(Text, nullable=True)
    trend_hashtag    = Column(String(128), nullable=True)
    media_format     = Column(String(32), nullable=True)
