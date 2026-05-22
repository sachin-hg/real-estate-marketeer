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
    """LangGraph node: publishes approved posts OR saves as drafts in HITL mode."""
    settings = get_settings()
    run_id = state["run_id"]
    file_out = settings.enable_file_outputs
    run_dir = OUTPUT_ROOT / run_id
    if file_out:
        (run_dir / "published").mkdir(parents=True, exist_ok=True)
        (run_dir / "rejected").mkdir(parents=True, exist_ok=True)

    approved = state.get("approved_posts", [])
    all_posts = state.get("platform_posts", [])
    qa_results = state.get("qa_results", [])
    approved_ids = {p["id"] for p in approved}
    qa_by_id = {q["post_id"]: q for q in qa_results}

    logger.info("Publisher: %d approved / %d total posts | dry_run=%s | hitl=%s | file_out=%s",
                len(approved), len(all_posts), settings.dry_run, settings.human_in_the_loop, file_out)

    published: list[PublishedPost] = []

    if settings.human_in_the_loop:
        # ── HITL mode: save all advisory posts as drafts, notify humans ──────
        if file_out:
            (run_dir / "draft").mkdir(parents=True, exist_ok=True)
        for post in approved:
            if file_out:
                result = _save_locally(post, run_dir / "draft")
            else:
                result = {"post_id": post["id"], "platform": post["platform"],
                          "platform_post_id": f"draft_{post['id'][:8]}", "url": "", "output_path": ""}
            _save_to_db(run_id, post, result, state, post_status="draft", qa_decision="advisory")
            _notify_draft_slack(post, qa_by_id.get(post["id"], {}), settings, run_id)
            logger.info("Publisher [HITL]: post %s [%s] saved as draft",
                        post["id"][:8], post["platform"])

        # Safety-blocked posts still get archived
        for post in all_posts:
            if post["id"] in approved_ids:
                continue
            qa = qa_by_id.get(post["id"], {})
            if file_out:
                result = _save_rejected_locally(post, run_dir / "rejected", qa)
            else:
                result = {"post_id": post["id"], "platform": post["platform"],
                          "platform_post_id": "", "url": "", "output_path": ""}
            _save_to_db(run_id, post, result, state, post_status="qa_rejected",
                        qa_decision="reject", qa_rejection_reasons=qa.get("safety_violations", []))

        _save_run_summary(state, published, run_dir)
        logger.info("Publisher [HITL]: %d drafts queued for human review", len(approved))
        return {"published": []}

    # ── Auto-publish mode ─────────────────────────────────────────────────────
    for post in approved:
        mode = "dry_run" if (settings.dry_run or post["platform"] not in state.get("target_platforms", [])) else "live"
        logger.info("Publisher: handling post %s [%s] mode=%s | content_chars=%d",
                    post["id"][:8], post["platform"], mode, len(post.get("content", "")))
        logger.debug("Publisher post content preview [%s]: %s",
                     post["platform"], post.get("content", "")[:300])

        if mode == "dry_run":
            if file_out:
                result = _save_locally(post, run_dir / "published")
            else:
                result = {"post_id": post["id"], "platform": post["platform"],
                          "platform_post_id": f"dry_run_{post['id'][:8]}", "url": "dry_run", "output_path": ""}
        else:
            result = _publish_to_platform(post, settings)

        logger.info("Publisher: post %s [%s] → %s",
                    post["id"][:8], post["platform"], result.get("url") or result.get("output_path", ""))
        published.append(result)
        _save_to_db(run_id, post, result, state, post_status="published", qa_decision="publish")
        if mode == "live":
            _schedule_engagement(post["id"], post["platform"], result.get("platform_post_id", ""))

    # ── Rejected posts (archive for analysis) ────────────────────────────────
    for post in all_posts:
        if post["id"] in approved_ids:
            continue
        qa = qa_by_id.get(post["id"], {})
        safety_violations = qa.get("safety_violations", [])
        quality_issues = qa.get("quality_issues", [])
        rejection_reasons = safety_violations + quality_issues

        if file_out:
            result = _save_rejected_locally(post, run_dir / "rejected", qa)
        else:
            result = {"post_id": post["id"], "platform": post["platform"],
                      "platform_post_id": "", "url": "", "output_path": ""}
        _save_to_db(
            run_id, post, result, state,
            post_status="qa_rejected",
            qa_decision=qa.get("decision", "reject"),
            qa_rejection_reasons=rejection_reasons,
        )
        logger.info("Publisher: archived rejected post %s [%s] | reasons=%s",
                    post["id"][:8], post["platform"], rejection_reasons[:2])

    _save_run_summary(state, published, run_dir)
    logger.info("Publisher: %d posts handled, output in %s", len(published), run_dir)
    return {"published": published}


# ─── Dry-run (local save) ─────────────────────────────────────────────────────

def _save_locally(post: PlatformPost, dest_dir: Path) -> PublishedPost:
    """Save an approved/published post. dest_dir should be run_dir/published/."""
    platform = post["platform"]
    post_id8 = post["id"][:8]
    out_path = dest_dir / f"{platform}_{post_id8}.md"

    lines = [
        f"# {platform.upper()} POST",
        f"**Draft ID:** {post.get('draft_id', 'n/a')}",
        f"**Post ID:** {post['id']}",
        f"**Status:** published",
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
        "platform_post_id": f"dry_run_{post_id8}",
        "url": "dry_run",
        "output_path": str(out_path),
    }


def _save_rejected_locally(post: PlatformPost, dest_dir: Path, qa: dict) -> PublishedPost:
    """Save a QA-rejected post for analysis. dest_dir should be run_dir/rejected/."""
    platform = post["platform"]
    post_id8 = post["id"][:8]
    out_path = dest_dir / f"{platform}_{post_id8}.md"

    safety_violations = qa.get("safety_violations", [])
    failing_dims = qa.get("quality_issues", [])
    critique = qa.get("critique") or qa.get("revision_notes", "")
    quality_scores = qa.get("quality_scores", {})
    overall = qa.get("overall_quality_score", 0)
    pred_er = qa.get("pred_engagement_rate", 0)

    # Detect silent API failure: all zeros, no critique, no violations, no scores
    api_failure = (
        overall == 0 and pred_er == 0
        and not critique and not safety_violations and not failing_dims
        and not quality_scores
    )

    lines = [
        f"# {platform.upper()} POST — QA REJECTED",
        f"**Draft ID:** {post.get('draft_id', 'n/a')}",
        f"**Post ID:** {post['id']}",
        f"**Status:** qa_rejected",
        f"**QA Decision:** {qa.get('decision', 'reject')}",
        f"**Quality Score:** {overall:.1f}/10",
        f"**Pred ER:** {pred_er:.1%}",
        f"**QA Attempt:** {qa.get('qa_attempt', 1)}",
        "",
    ]

    if api_failure:
        lines += [
            "## ⚠ QA Scoring Error",
            "QA API call returned empty results — likely a rate limit or auth failure during evaluation.",
            "This post was **not evaluated on content merits** and may be valid.",
            "",
        ]

    if safety_violations:
        lines += ["## Safety Violations", *[f"- {v}" for v in safety_violations], ""]

    if quality_scores:
        lines += ["## Dimension Scores"]
        for dim, score in sorted(quality_scores.items()):
            bar = "▓" * int(score) + "░" * (10 - int(score))
            lines.append(f"- **{dim}**: {score:.1f}/10  `{bar}`")
        lines += [""]

    if failing_dims:
        lines += ["## Failing Dimensions", *[f"- {d}" for d in failing_dims], ""]

    if critique:
        lines += ["## Critique", critique, ""]

    revision_instructions = qa.get("revision_instructions", [])
    if revision_instructions:
        lines += ["## Revision Instructions", *[f"{i+1}. {r}" for i, r in enumerate(revision_instructions)], ""]

    engagement_reasoning = qa.get("engagement_reasoning", "")
    if engagement_reasoning:
        lines += [
            "## Engagement Analysis",
            f"**Top element:** {qa.get('top_element', 'n/a')}  |  "
            f"**Weak element:** {qa.get('weak_element', 'n/a')}",
            engagement_reasoning,
            "",
        ]

    lines += [
        "## Content",
        post["content"],
        "",
        "## Hashtags",
        " ".join(post.get("hashtags", [])),
    ]

    if post.get("extra"):
        lines += ["", "## Extra", f"```json\n{json.dumps(post['extra'], indent=2)}\n```"]

    out_path.write_text("\n".join(lines), encoding="utf-8")

    return {
        "post_id": post["id"],
        "platform": platform,
        "platform_post_id": "",
        "url": "",
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
    fallback_dir = OUTPUT_ROOT / "fallback" / "published"
    fallback_dir.mkdir(parents=True, exist_ok=True)
    return _save_locally(post, fallback_dir)


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
    fb = OUTPUT_ROOT / "fallback" / "published"
    fb.mkdir(parents=True, exist_ok=True)
    return _save_locally(post, fb)


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

def _derive_source_topic(state: WorkflowState, draft: dict) -> str:
    """Return the human-readable origin of this post for display in the UI."""
    # Manual run: human typed a topic into Slack or the Generate UI
    manual = state.get("slack_topic") or state.get("topic_hint")
    if manual:
        return str(manual)
    # Auto/scheduled run: use the trend hashtag that drove this draft, then angle, then news headline
    trend_tag = draft.get("trend_hashtag")
    if trend_tag:
        return str(trend_tag)
    angle = draft.get("angle")
    if angle:
        return str(angle)
    # Last resort: first research headline
    research = state.get("research") or []
    if research:
        return research[0].get("headline", "")
    return ""


def _find_trend_data(state: WorkflowState, draft: dict) -> dict:
    """Return the full TrendItem that drove this draft, or {} if not found."""
    tag = draft.get("trend_hashtag", "")
    if not tag:
        return {}
    for item in state.get("trends", []):
        if item.get("hashtag") == tag:
            return dict(item)
    return {}


def _notify_draft_slack(post: PlatformPost, qa: dict, settings, run_id: str) -> None:
    """Send a Slack review-request for a HITL draft post (sync, fire-and-forget)."""
    if not settings.has_slack:
        return
    try:
        from slack_sdk import WebClient
        client = WebClient(token=settings.slack_bot_token)
        channel = settings.slack_channel_id
        platform = post["platform"]
        emoji_map = {
            "twitter": ":bird:", "instagram": ":camera:",
            "housing_news": ":newspaper:", "youtube": ":movie_camera:", "linkedin": ":briefcase:",
        }
        emoji = emoji_map.get(platform, ":pencil:")

        qa_score = qa.get("overall_quality_score", 0)
        er = qa.get("pred_engagement_rate", 0)
        critique = (qa.get("critique") or "")[:300]

        content_preview = post.get("content", "")[:400]
        hashtags = " ".join(post.get("hashtags", []))
        if hashtags:
            content_preview += f"\n\n{hashtags}"

        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": f"{emoji} Draft pending review — {platform.upper()}", "emoji": True},
            },
            {
                "type": "context",
                "elements": [{"type": "mrkdwn", "text": f"Run `{run_id[:8]}` · QA advisory: *{qa_score:.1f}/10* · Pred ER: *{er:.1%}*"}],
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"```\n{content_preview}\n```"},
            },
        ]
        if critique:
            blocks.append({
                "type": "context",
                "elements": [{"type": "mrkdwn", "text": f":speech_balloon: QA Advisory: _{critique}_"}],
            })
        blocks += [
            {"type": "divider"},
            {
                "type": "actions",
                "block_id": f"post_{post['id']}",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "✓ Approve & Publish", "emoji": True},
                        "style": "primary",
                        "value": f"approve_{post['id']}",
                        "action_id": "approve_post",
                    },
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "✕ Reject", "emoji": True},
                        "style": "danger",
                        "value": f"reject_{post['id']}",
                        "action_id": "reject_post",
                    },
                ],
            },
        ]

        client.chat_postMessage(
            channel=channel,
            text=f"[DRAFT REVIEW] {platform.upper()} post from run {run_id[:8]} — awaiting human approval",
            blocks=blocks,
        )
        logger.info("Slack draft review sent for post %s [%s]", post["id"][:8], platform)
    except Exception as exc:
        logger.warning("Slack draft notification failed for post %s: %s", post["id"][:8], exc)


def _save_to_db(
    run_id: str,
    post: PlatformPost,
    result: PublishedPost,
    state: WorkflowState,
    *,
    post_status: str = "published",
    qa_decision: str = "publish",
    qa_rejection_reasons: list[str] | None = None,
) -> None:
    try:
        from db.connection import get_db_session
        from db.models import PublishedPostRecord

        qa = next((q for q in state.get("qa_results", []) if q["post_id"] == post["id"]), {})
        draft = next((d for d in state.get("creative_drafts", []) if d["id"] == post.get("draft_id")), {})

        logger.debug(
            "DB saving post %s [%s] status=%s | qa_overall=%.1f pred_er=%.1f%%",
            post["id"][:8], post["platform"], post_status,
            qa.get("overall_quality_score", 0),
            qa.get("pred_engagement_rate", 0) * 100,
        )
        # Upload media assets to configured storage backend (R2/S3/GCS/local).
        # On cloud backends the returned URL is absolute; replace the local path
        # in media_urls so the UI can use it directly without knowing the backend.
        image_cloud_url: str | None = None
        raw_media = list(post.get("media_urls") or [])
        if raw_media:
            try:
                from tools.asset_storage import upload_asset
                from pathlib import Path as _Path
                first_media = raw_media[0]
                p = _Path(first_media)
                if p.exists() and p.is_file():
                    cloud_url = upload_asset(p, run_id, p.name)
                    image_cloud_url = cloud_url
                    if cloud_url.startswith("http"):
                        raw_media[0] = cloud_url
                        logger.info("Media uploaded to cloud: %s", cloud_url)
                    else:
                        logger.debug("Media stored locally: %s", cloud_url)
                else:
                    logger.warning("Media file not found, skipping upload: %s", p)
            except Exception as _ue:
                logger.warning("Media upload failed: %s", _ue)

        with get_db_session() as session:
            record = PublishedPostRecord(
                post_id=post["id"],
                run_id=run_id,
                platform=post["platform"],
                platform_post_id=result.get("platform_post_id", ""),
                content=post["content"],
                hashtags=json.dumps(post.get("hashtags", [])),
                internal_links=json.dumps(post.get("internal_links", [])),
                media_urls=json.dumps(raw_media or post.get("media_urls", [])),
                published_url=result.get("url", ""),
                output_path=result.get("output_path", ""),
                image_cloud_url=image_cloud_url,
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
                source_topic=_derive_source_topic(state, draft),
                qa_decision=qa_decision,
                post_status=post_status,
                qa_rejection_reasons=json.dumps(qa_rejection_reasons or []),
                qa_critique=qa.get("critique", ""),
                qa_quality_dimensions=json.dumps(qa.get("quality_scores", {})),
                engagement_reasoning=qa.get("engagement_reasoning", ""),
                trend_data=json.dumps(_find_trend_data(state, draft)),
                extra_data=json.dumps(post.get("extra") or {}),
            )
            session.add(record)
            session.commit()
        logger.info("DB saved post %s [%s] status=%s", post["id"][:8], post["platform"], post_status)
    except Exception as exc:
        logger.error("DB save failed for post %s: %s", post["id"], exc, exc_info=True)


def _publish_linkedin(post: PlatformPost, settings) -> PublishedPost:
    # LinkedIn API requires OAuth + organization URN — save locally until configured.
    logger.info("  [LINKEDIN] LinkedIn API not yet configured; saving locally")
    fb = OUTPUT_ROOT / "fallback" / "published"
    fb.mkdir(parents=True, exist_ok=True)
    return _save_locally(post, fb)


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
    approved_ids = {p["id"] for p in state.get("approved_posts", [])}
    qa_by_id = {q["post_id"]: q for q in state.get("qa_results", [])}

    rejected_posts = [
        {
            "post_id": p["id"],
            "platform": p["platform"],
            "content_preview": p.get("content", "")[:120],
            "output_path": str(run_dir / "rejected" / f"{p['platform']}_{p['id'][:8]}.md"),
            "qa_decision": qa_by_id.get(p["id"], {}).get("decision", "reject"),
            "quality_score": qa_by_id.get(p["id"], {}).get("overall_quality_score", 0),
            "pred_er": qa_by_id.get(p["id"], {}).get("pred_engagement_rate", 0),
            "rejection_reasons": (
                qa_by_id.get(p["id"], {}).get("safety_violations", []) +
                qa_by_id.get(p["id"], {}).get("quality_issues", [])
            ),
        }
        for p in state.get("platform_posts", [])
        if p["id"] not in approved_ids
    ]

    summary = {
        "run_id": state["run_id"],
        "triggered_at": state["triggered_at"],
        "dry_run": state["dry_run"],
        "research_items": len(state.get("research", [])),
        "trends_found": len(state.get("trends", [])),
        "drafts_generated": len(state.get("creative_drafts", [])),
        "posts_attempted": len(state.get("platform_posts", [])),
        "posts_approved": len(state.get("approved_posts", [])),
        "posts_rejected": len(rejected_posts),
        "posts_published": len(published),
        "published": published,
        "rejected": rejected_posts,
        "qa_summary": [
            {
                "post_id": r["post_id"],
                "platform": r["platform"],
                "decision": r["decision"],
                "quality_score": r.get("overall_quality_score", 0),
                "pred_er": r.get("pred_engagement_rate", 0),
                "violations": r.get("safety_violations", []),
                "failing_dimensions": r.get("quality_issues", []),
                "dimension_scores": r.get("quality_scores", {}),
                "critique": r.get("critique", ""),
                "engagement_reasoning": r.get("engagement_reasoning", ""),
                "top_element": r.get("top_element", ""),
                "weak_element": r.get("weak_element", ""),
            }
            for r in state.get("qa_results", [])
        ],
        # Full pipeline data — stored so RunDetail can show research/trends/briefs/drafts
        # even for completed runs loaded from DB (not in memory).
        "research": state.get("research", []),
        "trends": [
            {
                "hashtag": t.get("hashtag", ""),
                "platform": t.get("platform", ""),
                "volume": t.get("volume", ""),
                "context": t.get("context", ""),
                "creative_hook": t.get("creative_hook", ""),
                "city_hint": t.get("city_hint"),
                "tags": t.get("tags", []),
            }
            for t in state.get("trends", [])
        ],
        "content_briefs": [
            {
                "topic": b.get("topic", ""),
                "angle": b.get("angle", ""),
                "draft_type": b.get("draft_type", ""),
                "target_platforms": b.get("target_platforms", []),
                "tone": b.get("tone", ""),
                "urgency": b.get("urgency", ""),
                "source_summary": b.get("source_summary", ""),
                "city_hint": b.get("city_hint"),
                "seo_keywords": b.get("seo_keywords", []),
            }
            for b in state.get("content_briefs", [])
        ],
        "creative_drafts": [
            {
                "id": d.get("id", ""),
                "draft_type": d.get("draft_type", ""),
                "angle": d.get("angle", ""),
                "hook": d.get("hook", ""),
                "headline": d.get("headline", ""),
                "hashtags": d.get("hashtags", []),
                "trend_hashtag": d.get("trend_hashtag", ""),
                "target_platforms": d.get("target_platforms", []),
                "media_format": d.get("media_format", ""),
            }
            for d in state.get("creative_drafts", [])
        ],
    }
    try:
        if get_settings().enable_file_outputs:
            run_dir.mkdir(parents=True, exist_ok=True)
            (run_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    except Exception:
        pass
    _save_run_to_db(state, summary)


def _save_run_to_db(state: WorkflowState, summary: dict) -> None:
    """Persist run summary to the `runs` table so the web UI can load CLI runs."""
    try:
        from db.connection import get_db_session
        from db.models import RunRecord
        triggered_at = None
        if state.get("triggered_at"):
            try:
                triggered_at = datetime.fromisoformat(state["triggered_at"].replace("Z", "+00:00"))
            except Exception:
                pass
        with get_db_session() as session:
            existing = session.query(RunRecord).filter_by(run_id=state["run_id"]).first()
            if existing:
                record = existing
            else:
                record = RunRecord(run_id=state["run_id"])
                session.add(record)
            record.status          = "completed"
            record.triggered_at    = triggered_at
            record.completed_at    = datetime.now(timezone.utc)
            record.dry_run         = state.get("dry_run", True)
            record.topic_hint      = state.get("topic_hint") or state.get("slack_topic")
            record.target_platforms = json.dumps(state.get("target_platforms", []))
            record.research_count  = len(state.get("research", []))
            record.trends_count    = len(state.get("trends", []))
            record.briefs_count    = len(state.get("content_briefs", []))
            record.drafts_count    = len(state.get("creative_drafts", []))
            record.posts_attempted = summary.get("posts_attempted", 0)
            record.posts_approved  = summary.get("posts_approved", 0)
            record.posts_published = summary.get("posts_published", 0)
            record.error           = state.get("error")
            record.summary_json    = json.dumps(summary)
            session.commit()
        logger.debug("Run %s saved to DB runs table", state["run_id"])
    except Exception as exc:
        logger.warning("Failed to save run %s to DB: %s", state.get("run_id", "?"), exc)
