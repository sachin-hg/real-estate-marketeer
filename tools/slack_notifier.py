from __future__ import annotations

import logging
from typing import Optional

from config import get_settings

logger = logging.getLogger(__name__)


def _get_client():
    from slack_sdk import WebClient
    return WebClient(token=get_settings().slack_bot_token)


def post_publish_summary(run_id: str, posts: list[dict]) -> Optional[str]:
    """
    Post a summary of published content to the Slack channel.
    Returns the message timestamp (ts) or None if Slack is not configured.
    """
    settings = get_settings()
    if not settings.has_slack:
        logger.info("Slack not configured — skipping notification")
        return None

    try:
        client = _get_client()
        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": "Housing.com Content Published"},
            },
            {
                "type": "context",
                "elements": [{"type": "mrkdwn", "text": f"Run `{run_id}` · {len(posts)} posts"}],
            },
            {"type": "divider"},
        ]

        for post in posts:
            qa = post.get("qa", {})
            er = qa.get("pred_engagement_rate", 0)
            blocks.append({
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Platform:* {post['platform'].upper()}"},
                    {"type": "mrkdwn", "text": f"*Predicted ER:* {er:.1%}"},
                    {"type": "mrkdwn", "text": f"*Content:*\n{post['content'][:200]}..."},
                    {"type": "mrkdwn", "text": f"*Status:* {post.get('url', 'dry_run — saved locally')}"},
                ],
            })
            blocks.append({"type": "divider"})

        # Kill-switch action (15-minute window)
        blocks.append({
            "type": "context",
            "elements": [
                {"type": "mrkdwn", "text": "React :no_entry: within 15 minutes to request takedown."}
            ],
        })

        result = client.chat_postMessage(
            channel=settings.slack_channel_id,
            blocks=blocks,
            text=f"Housing.com: {len(posts)} new posts published (run {run_id})",
        )
        ts = result["ts"]
        logger.info("Slack notification sent, ts=%s", ts)
        return ts

    except Exception as exc:
        logger.error("Slack notification failed: %s", exc)
        return None


def post_error_alert(run_id: str, error: str) -> None:
    settings = get_settings()
    if not settings.has_slack:
        return
    try:
        _get_client().chat_postMessage(
            channel=settings.slack_channel_id,
            text=f":warning: Content run `{run_id}` failed: {error}",
        )
    except Exception as exc:
        logger.error("Slack error alert failed: %s", exc)
