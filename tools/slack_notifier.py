from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from config import get_settings

logger = logging.getLogger(__name__)

PLATFORM_EMOJI = {
    "twitter": ":bird:",
    "instagram": ":camera:",
    "housing_news": ":newspaper:",
    "youtube": ":movie_camera:",
    "linkedin": ":briefcase:",
}


def _get_async_client():
    from slack_sdk.web.async_client import AsyncWebClient
    return AsyncWebClient(token=get_settings().slack_bot_token)


# ─── Main entry points ────────────────────────────────────────────────────────

async def post_run_summary(state: dict) -> Optional[str]:
    """Post per-platform post messages to Slack; each approved post gets its own thread message."""
    settings = get_settings()
    if not settings.has_slack:
        logger.info("Slack not configured — skipping notification")
        return None

    try:
        client = _get_async_client()
        channel = settings.slack_channel_id
        run_id = state.get("run_id", "unknown")
        dry_run = state.get("dry_run", True)

        approved = state.get("approved_posts", [])
        all_posts = state.get("platform_posts", [])
        qa_results = state.get("qa_results", [])
        published = state.get("published", [])

        qa_by_id = {q["post_id"]: q for q in qa_results}
        published_by_id = {p["post_id"]: p for p in published}
        approved_ids = {p["id"] for p in approved}
        rejected_posts = [p for p in all_posts if p["id"] not in approved_ids]

        mode_label = ":test_tube: DRY RUN" if dry_run else ":rocket: LIVE"
        stats_text = (
            f"*{len(approved)} approved* / {len(rejected_posts)} rejected / "
            f"{len(all_posts)} total posts"
        )

        parent = await client.chat_postMessage(
            channel=channel,
            text=f"Housing.com Content Run `{run_id}` — {mode_label}",
            blocks=[
                {
                    "type": "header",
                    "text": {"type": "plain_text", "text": "Housing.com Marketeer", "emoji": True},
                },
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": f"*Run:* `{run_id}` · {mode_label}"},
                },
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": stats_text},
                },
                {"type": "divider"},
                {
                    "type": "context",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": "Each approved post is below. Use buttons to approve/reject, or reply with `approve`/`reject`.",
                        }
                    ],
                },
            ],
        )
        parent_ts = parent.get("ts") or parent.get("message", {}).get("ts", "")

        for post in approved:
            qa = qa_by_id.get(post["id"], {})
            pub = published_by_id.get(post["id"], {})
            await _post_platform_message(client, channel, parent_ts, post, qa, pub, dry_run)

        if rejected_posts:
            await _post_rejected_summary(client, channel, parent_ts, rejected_posts, qa_by_id)

        logger.info("Slack: run summary posted, parent_ts=%s", parent_ts)
        return parent_ts

    except Exception as exc:
        logger.error("Slack post_run_summary failed: %s", exc, exc_info=True)
        return None


async def post_error_alert(run_id: str, error: str) -> None:
    settings = get_settings()
    if not settings.has_slack:
        return
    try:
        client = _get_async_client()
        await client.chat_postMessage(
            channel=settings.slack_channel_id,
            text=f":warning: Content run `{run_id}` failed: {error}",
        )
    except Exception as exc:
        logger.error("Slack error alert failed: %s", exc)


# ─── Per-post dispatcher ──────────────────────────────────────────────────────

async def _post_platform_message(
    client,
    channel: str,
    parent_ts: str,
    post: dict,
    qa: dict,
    pub: dict,
    dry_run: bool,
) -> None:
    platform = post["platform"]
    try:
        dispatch = {
            "twitter": _format_twitter,
            "instagram": _format_instagram,
            "housing_news": _format_housing_news,
            "youtube": _format_youtube,
            "linkedin": _format_linkedin,
        }
        formatter = dispatch.get(platform)
        if formatter:
            blocks, fallback, image_path = formatter(post, qa, pub, dry_run)
        else:
            blocks = [{"type": "section", "text": {"type": "mrkdwn", "text": post.get("content", "")[:500]}}]
            fallback = post.get("content", "")[:200]
            image_path = None

        blocks += _meta_block(qa, pub, dry_run)
        blocks.append(_action_buttons(post["id"]))

        resp = await client.chat_postMessage(
            channel=channel,
            thread_ts=parent_ts,
            text=fallback[:300],
            blocks=blocks,
        )
        thread_ts = resp.get("ts") or resp.get("message", {}).get("ts", "")

        if image_path and Path(str(image_path)).exists():
            try:
                p = Path(str(image_path))
                await client.files_upload_v2(
                    channel=channel,
                    thread_ts=thread_ts,
                    file=str(p),
                    filename=p.name,
                    title=f"{platform.title()} card",
                )
            except Exception as img_exc:
                logger.warning("Image upload for %s failed: %s", platform, img_exc)

    except Exception as exc:
        logger.error("Failed to post %s thread message: %s", platform, exc, exc_info=True)


# ─── Platform formatters ──────────────────────────────────────────────────────

def _format_twitter(post: dict, qa: dict, pub: dict, dry_run: bool):
    extra = post.get("extra", {})
    main_tweet = extra.get("main_tweet") or post.get("content", "")
    hashtags = " ".join(post.get("hashtags", []))
    thread_parts = extra.get("thread", [])
    is_thread = extra.get("is_thread", False)
    char_count = extra.get("char_count", len(main_tweet))

    tweet_display = main_tweet
    if hashtags and hashtags not in tweet_display:
        tweet_display = f"{tweet_display}\n\n{hashtags}"

    blocks = [
        {"type": "header", "text": {"type": "plain_text", "text": ":bird: Twitter", "emoji": True}},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"```\n{tweet_display[:400]}\n```"}},
    ]

    if char_count:
        hook_type = extra.get("hook_type", "")
        meta = f"{char_count}/280 chars"
        if hook_type:
            meta += f" · hook: _{hook_type}_"
        blocks.append({"type": "context", "elements": [{"type": "mrkdwn", "text": meta}]})

    if is_thread and thread_parts:
        thread_preview = "\n".join(f"  {i + 2}. {t[:120]}" for i, t in enumerate(thread_parts[:3]))
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*Thread ({len(thread_parts)} more):*\n{thread_preview}"},
        })

    image_path = (post.get("media_urls") or [None])[0]
    return blocks, f"[Twitter] {main_tweet[:200]}", image_path


def _format_instagram(post: dict, qa: dict, pub: dict, dry_run: bool):
    extra = post.get("extra", {})
    caption = post.get("content", "")
    card_text = extra.get("card_text", "")
    meme_concept = extra.get("meme_concept", "")
    hashtags = " ".join(post.get("hashtags", []))
    media_format = extra.get("media_format", "")
    alt_text = extra.get("alt_text", "")

    blocks = [
        {"type": "header", "text": {"type": "plain_text", "text": ":camera: Instagram", "emoji": True}},
    ]

    if card_text:
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*Card text:*\n```{card_text}```"},
        })

    caption_display = caption
    if hashtags and hashtags not in caption_display:
        caption_display = f"{caption_display}\n\n{hashtags}"

    blocks.append({
        "type": "section",
        "text": {"type": "mrkdwn", "text": f"*Caption:*\n{caption_display[:600]}"},
    })

    if meme_concept:
        blocks.append({
            "type": "context",
            "elements": [{"type": "mrkdwn", "text": f":art: _{meme_concept[:200]}_"}],
        })

    ctx_parts = []
    if media_format:
        ctx_parts.append(f"Format: `{media_format}`")
    if alt_text:
        ctx_parts.append(f"Alt: _{alt_text[:100]}_")
    if ctx_parts:
        blocks.append({"type": "context", "elements": [{"type": "mrkdwn", "text": " · ".join(ctx_parts)}]})

    image_path = (post.get("media_urls") or [None])[0]
    return blocks, f"[Instagram] {caption[:200]}", image_path


def _format_housing_news(post: dict, qa: dict, pub: dict, dry_run: bool):
    extra = post.get("extra", {})
    seo_title = extra.get("seo_title", post.get("content", "")[:70])
    meta_desc = extra.get("meta_description", "")
    article_body = extra.get("article_body", post.get("content", ""))
    slug = extra.get("slug", "")
    internal_links = post.get("internal_links", [])

    blocks = [
        {"type": "header", "text": {"type": "plain_text", "text": ":newspaper: Housing News", "emoji": True}},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*{seo_title}*"}},
    ]

    if meta_desc:
        blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": f"_Meta:_ {meta_desc}"}})

    if slug:
        blocks.append({"type": "context", "elements": [{"type": "mrkdwn", "text": f"Slug: `{slug}`"}]})

    # Split full article across multiple blocks (Slack section block limit: 3000 chars)
    _CHUNK = 2800
    for chunk in [article_body[i:i + _CHUNK] for i in range(0, max(len(article_body), 1), _CHUNK)]:
        blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": chunk}})

    if internal_links:
        link_lines = "\n".join(
            f"• <{lnk['url']}|{lnk.get('anchor_text', lnk['url'])}> — _{lnk.get('placement', '')}_"
            for lnk in internal_links[:5]
        )
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*Internal Links:*\n{link_lines}"},
        })

    return blocks, f"[Housing News] {seo_title}", None


def _format_youtube(post: dict, qa: dict, pub: dict, dry_run: bool):
    extra = post.get("extra", {})
    shorts = extra.get("shorts_script", {})
    longform = extra.get("longform_outline", {})
    hashtags = " ".join(post.get("hashtags", []))

    blocks = [
        {"type": "header", "text": {"type": "plain_text", "text": ":movie_camera: YouTube", "emoji": True}},
    ]

    if shorts:
        hook = shorts.get("hook", "")
        body = shorts.get("body", "")
        cta = shorts.get("cta", "")
        on_screen = shorts.get("on_screen_text", "")
        seconds = shorts.get("estimated_seconds", "")

        parts = [f"*Shorts Script*" + (f" (~{seconds}s)" if seconds else "")]
        if hook:
            parts.append(f"*Hook:* {hook}")
        if body:
            parts.append(f"*Body:* {body[:200]}")
        if cta:
            parts.append(f"*CTA:* {cta}")
        if on_screen:
            parts.append(f"*On-screen:* _{on_screen[:100]}_")

        blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": "\n".join(parts)[:800]}})

    if longform:
        lf_title = longform.get("title", "")
        lf_desc = longform.get("description", "")
        chapters = longform.get("chapters", [])
        thumbnail = longform.get("thumbnail_concept", "")

        lf_parts = [f"*Long-form:* {lf_title}"]
        if lf_desc:
            lf_parts.append(f"_{lf_desc[:200]}_")
        if chapters:
            chapter_lines = "\n".join(
                f"  `{c.get('time', '')}` {c.get('title', '')}" for c in chapters[:6]
            )
            lf_parts.append(f"*Chapters:*\n{chapter_lines}")
        if thumbnail:
            lf_parts.append(f"*Thumbnail:* _{thumbnail[:150]}_")

        blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": "\n".join(lf_parts)[:900]}})

    if hashtags:
        blocks.append({"type": "context", "elements": [{"type": "mrkdwn", "text": hashtags[:300]}]})

    fallback_title = shorts.get("hook", "") or longform.get("title", "") or "YouTube post"
    return blocks, f"[YouTube] {fallback_title}", None


def _format_linkedin(post: dict, qa: dict, pub: dict, dry_run: bool):
    extra = post.get("extra", {})
    content = post.get("content", "")
    hashtags = " ".join(post.get("hashtags", []))
    employer_hook = extra.get("employer_hook", "")
    content_pillar = extra.get("content_pillar", "")
    char_count = extra.get("char_count", len(content))

    post_display = content
    if hashtags and hashtags not in post_display:
        post_display = f"{post_display}\n\n{hashtags}"

    blocks = [
        {"type": "header", "text": {"type": "plain_text", "text": ":briefcase: LinkedIn", "emoji": True}},
        {"type": "section", "text": {"type": "mrkdwn", "text": post_display[:2000]}},
    ]

    meta_parts = []
    if employer_hook:
        meta_parts.append(f"Hook: _{employer_hook[:100]}_")
    if content_pillar:
        meta_parts.append(f"Pillar: `{content_pillar}`")
    if char_count:
        meta_parts.append(f"{char_count} chars")
    if meta_parts:
        blocks.append({"type": "context", "elements": [{"type": "mrkdwn", "text": " · ".join(meta_parts)}]})

    return blocks, f"[LinkedIn] {content[:200]}", None


# ─── Shared Block Kit components ──────────────────────────────────────────────

def _meta_block(qa: dict, pub: dict, dry_run: bool) -> list[dict]:
    er = qa.get("pred_engagement_rate", 0)
    qa_score = qa.get("overall_quality_score", 0)
    decision = qa.get("decision", "")
    status_icon = ":white_check_mark:" if decision == "publish" else ":x:"

    url = pub.get("url", "")
    url_text = f"<{url}|View post>" if url and url != "dry_run" else (":test_tube: dry run" if dry_run else ":rocket: live")

    parts = [
        f"QA: *{qa_score:.1f}/10*",
        f"Pred ER: *{er:.1%}*",
        f"{status_icon} {decision or 'approved'}",
        url_text,
    ]

    violations = qa.get("safety_violations") or []
    if violations:
        parts.append(f":warning: {violations[0][:60]}")

    return [
        {"type": "divider"},
        {"type": "context", "elements": [{"type": "mrkdwn", "text": " · ".join(parts)}]},
    ]


def _action_buttons(post_id: str) -> dict:
    return {
        "type": "actions",
        "block_id": f"post_{post_id}",
        "elements": [
            {
                "type": "button",
                "text": {"type": "plain_text", "text": "✓ Approve", "emoji": True},
                "style": "primary",
                "value": f"approve_{post_id}",
                "action_id": "approve_post",
            },
            {
                "type": "button",
                "text": {"type": "plain_text", "text": "✕ Reject", "emoji": True},
                "style": "danger",
                "value": f"reject_{post_id}",
                "action_id": "reject_post",
            },
        ],
    }


async def _post_rejected_summary(
    client,
    channel: str,
    parent_ts: str,
    rejected_posts: list[dict],
    qa_by_id: dict,
) -> None:
    lines = [f":x: *{len(rejected_posts)} post(s) rejected by QA:*"]
    for post in rejected_posts[:10]:
        qa = qa_by_id.get(post["id"], {})
        reasons = (qa.get("safety_violations") or []) + (qa.get("quality_issues") or [])
        reason_str = "; ".join(reasons[:2]) if reasons else (qa.get("revision_notes") or "see logs")[:120]
        preview = post.get("content", "")[:80]
        lines.append(f"• *{post['platform'].upper()}* — {preview}…\n  _{reason_str}_")

    await client.chat_postMessage(
        channel=channel,
        thread_ts=parent_ts,
        text="\n".join(lines)[:3000],
    )


# ─── Legacy sync wrapper ──────────────────────────────────────────────────────

def post_publish_summary(run_id: str, posts: list[dict]) -> Optional[str]:
    """Sync shim kept for backward compatibility. New code should use post_run_summary."""
    settings = get_settings()
    if not settings.has_slack:
        return None
    try:
        from slack_sdk import WebClient
        client = WebClient(token=settings.slack_bot_token)
        blocks = [
            {"type": "header", "text": {"type": "plain_text", "text": "Housing.com Content Published"}},
            {"type": "context", "elements": [{"type": "mrkdwn", "text": f"Run `{run_id}` · {len(posts)} posts"}]},
            {"type": "divider"},
        ]
        for post in posts:
            qa = post.get("qa", {})
            er = qa.get("pred_engagement_rate", 0)
            blocks.append({
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Platform:* {post['platform'].upper()}"},
                    {"type": "mrkdwn", "text": f"*Pred ER:* {er:.1%}"},
                    {"type": "mrkdwn", "text": f"*Content:*\n{post['content'][:200]}..."},
                ],
            })
        result = client.chat_postMessage(
            channel=settings.slack_channel_id,
            blocks=blocks,
            text=f"Housing.com: {len(posts)} posts published (run {run_id})",
        )
        return result["ts"]
    except Exception as exc:
        logger.error("Slack notification failed: %s", exc)
        return None
