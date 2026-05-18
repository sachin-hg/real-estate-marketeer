from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from config import get_settings
from models.state import PlatformPost, PublishedPost, WorkflowState

logger = logging.getLogger(__name__)

OUTPUT_ROOT = Path("output")


def publisher_node(state: WorkflowState) -> dict:
    """LangGraph node: publishes approved posts or saves them locally in dry-run mode."""
    settings = get_settings()
    run_dir = OUTPUT_ROOT / state["run_id"]
    run_dir.mkdir(parents=True, exist_ok=True)

    approved = state.get("approved_posts", [])
    logger.info("Publisher: %d approved posts to handle | dry_run=%s", len(approved), settings.dry_run)

    published: list[PublishedPost] = []

    for post in approved:
        mode = "dry_run" if (settings.dry_run or post["platform"] not in state.get("target_platforms", [])) else "live"
        logger.info("Publisher: handling post %s [%s] mode=%s | content_chars=%d",
                    post["id"][:8], post["platform"], mode, len(post.get("content", "")))
        logger.debug("Publisher post content preview [%s]: %s",
                     post["platform"], post.get("content", "")[:300])

        if mode == "dry_run":
            result = _save_locally(post, run_dir)
        else:
            result = _publish_to_platform(post, settings)

        logger.info("Publisher: post %s [%s] → %s",
                    post["id"][:8], post["platform"], result.get("url") or result.get("output_path", ""))
        published.append(result)
        _save_to_db(state["run_id"], post, result, state)
        if mode == "live":
            _schedule_engagement(post["id"], post["platform"], result.get("platform_post_id", ""))

    _save_run_summary(state, published, run_dir)
    logger.info("Publisher: %d posts handled, output in %s", len(published), run_dir)
    return {"published": published}


# ─── Dry-run (local save) ─────────────────────────────────────────────────────

def _save_locally(post: PlatformPost, run_dir: Path) -> PublishedPost:
    platform = post["platform"]
    out_path = run_dir / f"{platform}_post.md"

    lines = [
        f"# {platform.upper()} POST",
        f"**Draft ID:** {post.get('draft_id', 'n/a')}",
        f"**Post ID:** {post['id']}",
        "",
        "## Content",
        post["content"],
        "",
        "## Hashtags",
        " ".join(post.get("hashtags", [])),
    ]

    if post.get("internal_links"):
        lines += ["", "## Internal Links"]
        for link in post["internal_links"]:
            lines.append(f"- [{link.get('anchor_text', link['url'])}]({link['url']}) — {link.get('placement', '')}")

    if post.get("media_urls"):
        lines += ["", "## Media", *[f"- {u}" for u in post["media_urls"]]]

    if post.get("extra"):
        lines += ["", "## Extra", f"```json\n{json.dumps(post['extra'], indent=2)}\n```"]

    out_path.write_text("\n".join(lines), encoding="utf-8")
    logger.info("  [DRY RUN] %s → %s", platform, out_path)

    return {
        "post_id": post["id"],
        "platform": platform,
        "platform_post_id": f"dry_run_{post['id'][:8]}",
        "url": "dry_run",
        "output_path": str(out_path),
    }


# ─── Live publishing ──────────────────────────────────────────────────────────

def _publish_to_platform(post: PlatformPost, settings) -> PublishedPost:
    platform = post["platform"]
    try:
        if platform == "twitter" and settings.has_twitter:
            return _publish_twitter(post, settings)
        if platform == "instagram" and settings.has_instagram:
            return _publish_instagram(post, settings)
        if platform == "youtube" and settings.has_youtube:
            return _publish_youtube(post, settings)
        if platform == "housing_news" and settings.housing_cms_api_key:
            return _publish_housing_news(post, settings)
        if platform == "linkedin":
            return _publish_linkedin(post, settings)
    except Exception as exc:
        logger.error("Publishing to %s failed: %s", platform, exc)

    # Fallback to local save
    run_dir = OUTPUT_ROOT / "fallback"
    run_dir.mkdir(exist_ok=True)
    return _save_locally(post, run_dir)


def _publish_twitter(post: PlatformPost, settings) -> PublishedPost:
    import tweepy
    client = tweepy.Client(
        consumer_key=settings.twitter_api_key,
        consumer_secret=settings.twitter_api_secret,
        access_token=settings.twitter_access_token,
        access_token_secret=settings.twitter_access_token_secret,
    )
    # Twitter limit: 280 chars
    text = post["content"][:280]
    result = client.create_tweet(text=text)
    tweet_id = result.data["id"]
    url = f"https://x.com/HousingDotCom/status/{tweet_id}"
    logger.info("  [TWITTER] published tweet %s", tweet_id)
    return {"post_id": post["id"], "platform": "twitter", "platform_post_id": tweet_id, "url": url, "output_path": ""}


def _publish_instagram(post: PlatformPost, settings) -> PublishedPost:
    import httpx
    ig_id = settings.instagram_account_id
    token = settings.instagram_access_token
    image_url = post["media_urls"][0] if post.get("media_urls") else None

    if not image_url:
        logger.warning("Instagram post %s has no image — skipping live publish", post["id"])
        return _save_locally(post, OUTPUT_ROOT / "fallback")

    with httpx.Client() as client:
        # Step 1: create media object
        media_resp = client.post(
            f"https://graph.instagram.com/{ig_id}/media",
            params={"image_url": image_url, "caption": post["content"], "access_token": token},
        )
        media_id = media_resp.json()["id"]
        # Step 2: publish
        pub_resp = client.post(
            f"https://graph.instagram.com/{ig_id}/media_publish",
            params={"creation_id": media_id, "access_token": token},
        )
        ig_post_id = pub_resp.json()["id"]

    url = f"https://www.instagram.com/p/{ig_post_id}/"
    logger.info("  [INSTAGRAM] published %s", ig_post_id)
    return {"post_id": post["id"], "platform": "instagram", "platform_post_id": ig_post_id, "url": url, "output_path": ""}


def _publish_youtube(post: PlatformPost, settings) -> PublishedPost:
    # YouTube Shorts upload requires OAuth — return stub for now
    logger.info("  [YOUTUBE] YouTube upload requires OAuth; saving locally")
    return _save_locally(post, OUTPUT_ROOT / "fallback")


def _publish_housing_news(post: PlatformPost, settings) -> PublishedPost:
    import httpx
    extra = post.get("extra", {})
    payload = {
        "title": extra.get("seo_title", post["content"][:70]),
        "body": post["content"],
        "meta_description": extra.get("meta_description", ""),
        "tags": post.get("hashtags", []),
        "internal_links": post.get("internal_links", []),
        "status": "published",
    }
    with httpx.Client() as client:
        resp = client.post(
            f"{settings.housing_cms_base_url}/articles",
            json=payload,
            headers={"Authorization": f"Bearer {settings.housing_cms_api_key}"},
            timeout=30,
        )
        resp.raise_for_status()
        article_id = resp.json().get("id", "unknown")

    url = f"https://housing.com/news/article/{article_id}"
    logger.info("  [HOUSING NEWS] published article %s", article_id)
    return {"post_id": post["id"], "platform": "housing_news", "platform_post_id": article_id, "url": url, "output_path": ""}


# ─── DB + summary helpers ─────────────────────────────────────────────────────

def _save_to_db(run_id: str, post: PlatformPost, result: PublishedPost, state: WorkflowState) -> None:
    try:
        from db.connection import get_db_session
        from db.models import PublishedPostRecord

        qa = next((q for q in state.get("qa_results", []) if q["post_id"] == post["id"]), {})
        draft = next((d for d in state.get("creative_drafts", []) if d["id"] == post.get("draft_id")), {})

        logger.debug(
            "DB saving post %s [%s] | qa_overall=%.1f pred_er=%.1f%% angle='%s'",
            post["id"][:8], post["platform"],
            qa.get("overall_quality_score", 0),
            qa.get("pred_engagement_rate", 0) * 100,
            draft.get("angle", "")[:50],
        )
        with get_db_session() as session:
            record = PublishedPostRecord(
                post_id=post["id"],
                run_id=run_id,
                platform=post["platform"],
                platform_post_id=result.get("platform_post_id", ""),
                content=post["content"],
                hashtags=json.dumps(post.get("hashtags", [])),
                internal_links=json.dumps(post.get("internal_links", [])),
                media_urls=json.dumps(post.get("media_urls", [])),
                published_url=result.get("url", ""),
                output_path=result.get("output_path", ""),
                creative_angle=draft.get("angle", ""),
                qa_safety_passed=qa.get("safety_passed", True),
                qa_re_relevance=qa.get("re_relevance_score", 0),
                qa_backlink_score=qa.get("backlink_score", 0),
                qa_brand_voice=qa.get("brand_voice_score", 0),
                qa_overall=qa.get("overall_quality_score", 0),
                pred_impressions=qa.get("pred_impressions", 0),
                pred_likes=qa.get("pred_likes", 0),
                pred_shares=qa.get("pred_shares", 0),
                pred_comments=qa.get("pred_comments", 0),
                pred_ctr=qa.get("pred_ctr", 0),
                pred_engagement_rate=qa.get("pred_engagement_rate", 0),
                pred_confidence=qa.get("pred_confidence", 0),
                draft_type=draft.get("draft_type"),
                zomato_hook=draft.get("zomato_hook"),
                trend_hashtag=draft.get("trend_hashtag"),
                media_format=draft.get("media_format"),
            )
            session.add(record)
            session.commit()
        logger.info("DB saved post %s [%s]", post["id"][:8], post["platform"])
    except Exception as exc:
        logger.error("DB save failed for post %s: %s", post["id"], exc, exc_info=True)


def _publish_linkedin(post: PlatformPost, settings) -> PublishedPost:
    # LinkedIn API requires OAuth + organization URN — save locally until configured.
    logger.info("  [LINKEDIN] LinkedIn API not yet configured; saving locally")
    return _save_locally(post, OUTPUT_ROOT / "fallback")


def _schedule_engagement(post_id: str, platform: str, platform_post_id: str) -> None:
    """Schedule 6h/24h/7d engagement metric fetches after a live publish."""
    try:
        from scheduler.jobs import schedule_engagement_tracking, scheduler
        if scheduler.running:
            schedule_engagement_tracking(post_id, platform, platform_post_id)
        else:
            logger.debug("Scheduler not running — skipping engagement tracking for post %s", post_id[:8])
    except Exception as exc:
        logger.warning("Could not schedule engagement tracking for post %s: %s", post_id[:8], exc)


def _save_run_summary(state: WorkflowState, published: list[PublishedPost], run_dir: Path) -> None:
    summary = {
        "run_id": state["run_id"],
        "triggered_at": state["triggered_at"],
        "dry_run": state["dry_run"],
        "research_items": len(state.get("research", [])),
        "trends_found": len(state.get("trends", [])),
        "drafts_generated": len(state.get("creative_drafts", [])),
        "posts_attempted": len(state.get("platform_posts", [])),
        "posts_approved": len(state.get("approved_posts", [])),
        "posts_published": len(published),
        "published": published,
        "qa_summary": [
            {
                "platform": r["platform"],
                "decision": r["decision"],
                "quality_score": r.get("overall_quality_score", 0),
                "pred_er": r.get("pred_engagement_rate", 0),
            }
            for r in state.get("qa_results", [])
        ],
    }
    (run_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
