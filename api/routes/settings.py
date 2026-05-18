from __future__ import annotations

import logging
import re
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/settings", tags=["settings"])

ENV_PATH = Path(__file__).parent.parent.parent / ".env"

# Key descriptions
KEY_META: dict[str, dict] = {
    # Required
    "ANTHROPIC_API_KEY": {"desc": "Anthropic Claude API key (required)", "section": "Required"},
    "TAVILY_API_KEY": {"desc": "Tavily web search API key (required)", "section": "Required"},
    # Trend Research
    "YOUTUBE_API_KEY": {"desc": "YouTube Data API v3 key", "section": "Trend Research"},
    "REDDIT_CLIENT_ID": {"desc": "Reddit OAuth app client ID", "section": "Trend Research"},
    "REDDIT_CLIENT_SECRET": {"desc": "Reddit OAuth app client secret", "section": "Trend Research"},
    "APIFY_API_TOKEN": {"desc": "Apify API token for scrapers", "section": "Trend Research"},
    # Social Publishing
    "TWITTER_API_KEY": {"desc": "Twitter / X API key", "section": "Social Publishing"},
    "TWITTER_API_SECRET": {"desc": "Twitter / X API secret", "section": "Social Publishing"},
    "TWITTER_ACCESS_TOKEN": {"desc": "Twitter / X access token", "section": "Social Publishing"},
    "TWITTER_ACCESS_TOKEN_SECRET": {"desc": "Twitter / X access token secret", "section": "Social Publishing"},
    "INSTAGRAM_ACCOUNT_ID": {"desc": "Instagram account ID", "section": "Social Publishing"},
    "INSTAGRAM_ACCESS_TOKEN": {"desc": "Instagram Graph API access token", "section": "Social Publishing"},
    "YOUTUBE_CHANNEL_ID": {"desc": "YouTube channel ID for uploads", "section": "Social Publishing"},
    "HOUSING_CMS_API_KEY": {"desc": "Housing.com CMS API key", "section": "Social Publishing"},
    "HOUSING_CMS_BASE_URL": {"desc": "Housing.com CMS base URL", "section": "Social Publishing"},
    # Notifications / Bot
    "SLACK_BOT_TOKEN": {"desc": "Slack bot token (xoxb-...)", "section": "Notifications / Bot"},
    "SLACK_CHANNEL_ID": {"desc": "Slack channel ID for notifications", "section": "Notifications / Bot"},
    "SLACK_APP_TOKEN": {"desc": "Slack app-level token (xapp-...) for Socket Mode", "section": "Notifications / Bot"},
    "SLACK_SIGNING_SECRET": {"desc": "Slack signing secret for request verification", "section": "Notifications / Bot"},
    # Infrastructure
    "DATABASE_URL": {"desc": "SQLAlchemy database URL", "section": "Infrastructure"},
    "DRY_RUN": {"desc": "Set to true to skip live publishing", "section": "Infrastructure"},
    "LOG_LEVEL": {"desc": "Logging level (DEBUG/INFO/WARNING)", "section": "Infrastructure"},
    "MAX_CREATIVE_DRAFTS": {"desc": "Max creative drafts to generate per run", "section": "Infrastructure"},
    "TARGET_PLATFORMS": {"desc": "Comma-separated list of target platforms", "section": "Infrastructure"},
}


def _mask_value(val: str) -> str:
    if len(val) >= 12:
        return val[:8] + "..." + val[-4:]
    if val:
        return "***"
    return ""


def _read_env() -> dict[str, str]:
    if not ENV_PATH.exists():
        return {}
    result: dict[str, str] = {}
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, _, val = line.partition("=")
            result[key.strip()] = val.strip().strip('"').strip("'")
    return result


@router.get("/")
def get_settings_view():
    env_vals = _read_env()
    result: dict[str, dict] = {}

    # Include known keys + any extra keys from .env
    all_keys = list(KEY_META.keys())
    for k in env_vals:
        if k not in all_keys:
            all_keys.append(k)

    for key in all_keys:
        val = env_vals.get(key, "")
        meta = KEY_META.get(key, {"desc": "", "section": "Other"})
        result[key] = {
            "value": _mask_value(val) if val else "",
            "is_set": bool(val),
            "desc": meta.get("desc", ""),
            "section": meta.get("section", "Other"),
        }

    return result


class SettingBody(BaseModel):
    key: str
    value: str


@router.post("/")
def update_setting(body: SettingBody):
    key = body.key.strip()
    value = body.value.strip()

    lines: list[str] = []
    found = False

    if ENV_PATH.exists():
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if stripped.startswith("#") or "=" not in stripped:
                lines.append(line)
                continue
            line_key = stripped.split("=", 1)[0].strip()
            if line_key == key:
                lines.append(f'{key}="{value}"')
                found = True
            else:
                lines.append(line)

    if not found:
        lines.append(f'{key}="{value}"')

    ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return {"ok": True, "key": key}
