"""
Slack bot for direct content creation.

Marketing team members DM the bot or @mention it with a topic/URL/trend.
The bot runs the direct pipeline (no research phase) and posts the generated
content back in the same thread.

Setup:
  SLACK_BOT_TOKEN   — bot token (xoxb-...) with scopes:
                       app_mentions:read, im:read, im:write,
                       chat:write, files:write, channels:history
  SLACK_APP_TOKEN   — app-level token (xapp-...) with scope: connections:write
                       (only needed for Socket Mode — the default mode here)
  SLACK_CHANNEL_ID  — optional: restrict bot to this channel

Start: python main.py slack-bot
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

# ── Message parser ────────────────────────────────────────────────────────────

def _clean_topic(text: str, bot_user_id: str | None = None) -> str:
    """Strip the bot mention prefix and surrounding whitespace."""
    import re
    if bot_user_id:
        text = re.sub(rf"<@{bot_user_id}>", "", text)
    return text.strip()


def _initial_state(topic: str, run_id: str, dry_run: bool, platforms: list[str]) -> dict:
    return {
        "run_id":        run_id,
        "triggered_at":  datetime.now(timezone.utc).isoformat(),
        "dry_run":       dry_run,
        "slack_topic":   topic,
        "topic_hint":    topic,
        "target_platforms": platforms,
        "research":      [],
        "trends":        [],
        "content_briefs": [],
        "creative_drafts": [],
        "platform_posts": [],
        "qa_results":    [],
        "approved_posts": [],
        "published":     [],
        "retry_count":   0,
        "qa_post_attempts": {},
        "error":         None,
    }


# ── Slack result formatter ────────────────────────────────────────────────────

def _format_results(state: dict) -> tuple[str, list[dict]]:
    """
    Build the Slack message blocks for pipeline results.
    Returns (fallback_text, blocks_list).
    """
    run_id    = state.get("run_id", "?")
    approved  = state.get("approved_posts", [])
    published = state.get("published", [])
    qa_list   = state.get("qa_results", [])
    error     = state.get("error")

    if error:
        return (
            f"Run {run_id} failed: {error}",
            [{"type": "section", "text": {"type": "mrkdwn",
              "text": f":warning: *Run `{run_id}` failed*\n```{error}```"}}],
        )

    if not approved:
        return (
            f"Run {run_id}: no posts passed QA",
            [{"type": "section", "text": {"type": "mrkdwn",
              "text": f":x: *Run `{run_id}`* — no posts passed QA.\n"
                      "Try rephrasing the topic or check the logs."}}],
        )

    # Source: human topic (manual run) or trend (auto run)
    source = state.get("slack_topic") or state.get("topic_hint") or ""

    blocks: list[dict] = [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": f"Content ready — run {run_id}"},
        },
        {"type": "divider"},
    ]

    # QA summary line + source
    n_total    = len(qa_list)
    n_approved = len(approved)
    n_rejected = n_total - n_approved
    summary_text = (
        f":white_check_mark: {n_approved} approved   "
        f":x: {n_rejected} rejected   "
        f":mag: run `{run_id}`"
    )
    if source:
        summary_text += f"\n:pushpin: *Source:* _{source[:120]}_"
    blocks.append({
        "type": "context",
        "elements": [{"type": "mrkdwn", "text": summary_text}],
    })

    # Per-post blocks
    platform_icon = {
        "twitter": ":bird:", "instagram": ":camera:",
        "housing_news": ":house:", "youtube": ":clapper:",
    }

    # Build a map from draft_id → draft for source/trend lookup
    drafts_by_id = {d.get("id", ""): d for d in state.get("creative_drafts", [])}
    qa_by_id = {q["post_id"]: q for q in qa_list}

    for post in approved:
        platform  = post.get("platform", "unknown")
        content   = post.get("content", "")
        hashtags  = post.get("hashtags", [])
        post_id   = post.get("id", "")
        draft_id  = post.get("draft_id", "")
        draft     = drafts_by_id.get(draft_id, {})
        qa        = qa_by_id.get(post_id, {})
        er        = qa.get("pred_engagement_rate", 0)
        score     = qa.get("overall_quality_score", 0)
        icon      = platform_icon.get(platform, ":memo:")
        output    = next((p.get("output_path", "") for p in published
                          if p.get("post_id") == post_id), "")

        # Post source — trend hashtag for auto runs; human topic for manual runs
        post_source = source or draft.get("trend_hashtag") or draft.get("angle") or ""

        # Full content as it appears on platform (content + hashtags)
        hashtag_line = " ".join(
            h if h.startswith("#") else f"#{h}" for h in hashtags
        )
        full_content = content
        if hashtag_line:
            full_content = f"{content}\n\n{hashtag_line}"

        header_text = f"{icon} *{platform.upper()}*"
        if post_source:
            header_text += f"  ↗ _{post_source[:80]}_"

        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn",
                     "text": f"{header_text}\n```{full_content[:800]}```"},
        })
        meta_parts = [f"Quality: {score:.1f}/10", f"Predicted ER: {er:.1%}"]
        if output:
            meta_parts.append(f"Saved: `{output}`")
        blocks.append({
            "type": "context",
            "elements": [{"type": "mrkdwn", "text": " · ".join(meta_parts)}],
        })
        blocks.append({"type": "divider"})

    fallback = (f"Run {run_id}: {n_approved} posts ready "
                + ", ".join(p.get("platform", "") for p in approved))
    return fallback, blocks


def _collect_image_paths(state: dict) -> list[Path]:
    """Return paths to any generated image cards."""
    paths: list[Path] = []
    for post in state.get("approved_posts", []):
        extra = post.get("extra", {})
        card  = extra.get("card_path", "")
        if card and Path(card).exists():
            paths.append(Path(card))
    return paths


# ── Approve / reject helpers ─────────────────────────────────────────────────

def _extract_post_id_from_blocks(blocks: list) -> str | None:
    """Return post_id from the first action block whose block_id starts with 'post_'."""
    for block in blocks:
        block_id = block.get("block_id", "")
        if block_id.startswith("post_"):
            return block_id[len("post_"):]
    return None


async def _find_post_id_in_thread(client, channel: str, thread_ts: str) -> str | None:
    """Walk the thread's messages to find the first one with a post_ block_id."""
    try:
        resp = await client.conversations_replies(channel=channel, ts=thread_ts, limit=20)
        for msg in resp.get("messages", []):
            post_id = _extract_post_id_from_blocks(msg.get("blocks", []))
            if post_id:
                return post_id
    except Exception as exc:
        logger.warning("_find_post_id_in_thread failed: %s", exc)
    return None


async def _persist_post_action(post_id: str, action: str) -> None:
    """Write user_action to the DB for the given post."""
    try:
        from db.connection import get_db_session
        from db.models import PublishedPostRecord
        with get_db_session() as session:
            record = session.query(PublishedPostRecord).filter_by(post_id=post_id).first()
            if record:
                record.user_action = action
                session.commit()
                logger.info("Post %s user_action → %s", post_id[:8], action)
            else:
                logger.warning("_persist_post_action: post %s not in DB", post_id[:8])
    except Exception as exc:
        logger.error("_persist_post_action failed for %s: %s", post_id[:8], exc)


# ── Socket Mode bot (main entry point) ───────────────────────────────────────

def run_socket_mode_bot() -> None:
    """Start the Slack bot using Socket Mode (blocking)."""
    from dotenv import load_dotenv
    load_dotenv()

    from config import get_settings
    settings = get_settings()

    if not settings.slack_bot_token:
        raise RuntimeError("SLACK_BOT_TOKEN is not set — cannot start Slack bot")
    if not settings.slack_app_token:
        raise RuntimeError(
            "SLACK_APP_TOKEN is not set — Socket Mode requires an app-level token "
            "(xapp-...) with connections:write scope. See SETUP_KEYS.md."
        )

    try:
        from slack_bolt.async_app import AsyncApp
        from slack_bolt.adapter.socket_mode.async_handler import AsyncSocketModeHandler
    except ImportError:
        raise ImportError(
            "slack_bolt is not installed. Run: pip install slack_bolt"
        )

    app = AsyncApp(token=settings.slack_bot_token)

    # ── Event handlers ────────────────────────────────────────────────────────

    async def _handle_message(topic: str, say, thread_ts: str | None, client) -> None:
        """Core handler: run pipeline and reply in thread."""
        if not topic:
            await say(
                text="Send me a topic, URL, or trend and I'll generate content for it.",
                thread_ts=thread_ts,
            )
            return

        run_id  = str(uuid.uuid4())[:8]
        ack_msg = await say(
            text=f":hourglass_flowing_sand: On it! Creating posts for: *{topic[:80]}*\nRun `{run_id}` — give me ~60 seconds.",
            thread_ts=thread_ts,
        )
        reply_ts = (ack_msg or {}).get("ts") or thread_ts

        try:
            from workflow.direct_graph import get_direct_graph
            initial = _initial_state(
                topic=topic,
                run_id=run_id,
                dry_run=settings.dry_run,
                platforms=settings.platform_list,
            )
            dg = await get_direct_graph()
            final_state = await dg.ainvoke(initial, config={"configurable": {"thread_id": run_id}})

            fallback, blocks = _format_results(final_state)
            await client.chat_postMessage(
                channel=say.channel,
                thread_ts=reply_ts or thread_ts,
                text=fallback,
                blocks=blocks,
            )

            # Upload any generated image cards as files
            for img_path in _collect_image_paths(final_state):
                try:
                    await client.files_upload_v2(
                        channel=say.channel,
                        thread_ts=reply_ts or thread_ts,
                        file=str(img_path),
                        filename=img_path.name,
                        title=f"Card — {img_path.stem}",
                    )
                except Exception as img_exc:
                    logger.warning("Could not upload image %s: %s", img_path, img_exc)

        except Exception as exc:
            logger.error("Slack bot pipeline failed for run %s: %s", run_id, exc, exc_info=True)
            await client.chat_postMessage(
                channel=say.channel,
                thread_ts=reply_ts or thread_ts,
                text=f":warning: Run `{run_id}` failed: `{exc}`",
            )

    @app.event("app_mention")
    async def handle_mention(event, say, client, context) -> None:
        bot_uid = context.get("bot_user_id")
        topic   = _clean_topic(event.get("text", ""), bot_uid)
        thread  = event.get("thread_ts") or event.get("ts")
        logger.info("Slack mention from %s: '%s'", event.get("user"), topic[:60])
        await _handle_message(topic, say, thread, client)

    @app.event("message")
    async def handle_message_event(event, say, client, context) -> None:
        if event.get("subtype") or event.get("bot_id"):
            return

        text = (event.get("text") or "").strip()
        channel_type = event.get("channel_type", "")
        thread_ts = event.get("thread_ts")
        event_ts = event.get("ts")

        # Thread reply with "approve" or "reject" → update post user_action
        if thread_ts and thread_ts != event_ts and text.lower() in ("approve", "reject"):
            action = "approved" if text.lower() == "approve" else "rejected"
            post_id = await _find_post_id_in_thread(client, event.get("channel"), thread_ts)
            if post_id:
                await _persist_post_action(post_id, action)
                icon = ":white_check_mark:" if action == "approved" else ":x:"
                await say(text=f"{icon} Marked as *{action}*", thread_ts=thread_ts)
            return

        # DM → trigger new pipeline
        if channel_type == "im":
            topic = _clean_topic(text)
            logger.info("Slack DM from %s: '%s'", event.get("user"), topic[:60])
            await _handle_message(topic, say, event_ts, client)

    @app.event("reaction_added")
    async def handle_reaction(event, client) -> None:
        """✅ (white_check_mark) → approve; ❌ (x) → reject."""
        emoji = event.get("reaction", "")
        if emoji not in ("white_check_mark", "x"):
            return
        action = "approved" if emoji == "white_check_mark" else "rejected"
        item = event.get("item", {})
        channel = item.get("channel")
        ts = item.get("ts")
        if not channel or not ts:
            return
        try:
            resp = await client.conversations_history(
                channel=channel, latest=ts, limit=1, inclusive=True
            )
            messages = resp.get("messages", [])
            if not messages:
                return
            post_id = _extract_post_id_from_blocks(messages[0].get("blocks", []))
            if post_id:
                await _persist_post_action(post_id, action)
                logger.info("Reaction %s → post %s → %s", emoji, post_id[:8], action)
        except Exception as exc:
            logger.warning("reaction_added handler failed: %s", exc)

    # ── Start ─────────────────────────────────────────────────────────────────

    handler = AsyncSocketModeHandler(app, settings.slack_app_token)

    logger.info("Slack bot starting (Socket Mode)...")
    asyncio.run(handler.start_async())
