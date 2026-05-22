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
    "ANTHROPIC_API_KEY":  {"desc": "Anthropic Claude API key (required)", "section": "Required"},
    "TAVILY_API_KEY":     {"desc": "Tavily web search API key (required)", "section": "Required"},
    # AI Models
    "GEMINI_API_KEY":     {"desc": "Google Gemini API key — enables Gemini 2.5 Flash for fast-tier tasks (53% cheaper than Haiku)", "section": "AI Models"},
    "OPENAI_API_KEY":     {"desc": "OpenAI API key — used for DALL-E image generation", "section": "AI Models"},
    # News & Trend Research
    "SERP_API_KEY":       {"desc": "SerpAPI key (serpapi.com) — Google News India + Google Trends India (reliable, real-time)", "section": "News & Trend Research"},
    "SERPER_API_KEY":     {"desc": "Serper.dev key — fast supplementary Google News search", "section": "News & Trend Research"},
    "YOUTUBE_API_KEY":    {"desc": "YouTube Data API v3 key — trending India videos for meme/reel signals", "section": "News & Trend Research"},
    "REDDIT_CLIENT_ID":   {"desc": "Reddit OAuth app client ID", "section": "News & Trend Research"},
    "REDDIT_CLIENT_SECRET": {"desc": "Reddit OAuth app client secret", "section": "News & Trend Research"},
    # Twitter / X Trends (3-source fallback chain)
    "TWITTER_BEARER_TOKEN":       {"desc": "X/Twitter bearer token — official trends API (WOEID 23424848, India) — highest priority", "section": "Twitter Trends"},
    "APIFY_API_TOKEN":            {"desc": "Apify API token — eunit/x-twitter-trends-scraper (fallback #2)", "section": "Twitter Trends"},
    "RAPIDAPI_KEY":               {"desc": "RapidAPI key — twitter-trends-api fallback (#3)", "section": "Twitter Trends"},
    # Social Publishing (Twitter/X)
    "TWITTER_API_KEY":            {"desc": "Twitter / X API key (for posting)", "section": "Social Publishing"},
    "TWITTER_API_SECRET":         {"desc": "Twitter / X API secret", "section": "Social Publishing"},
    "TWITTER_ACCESS_TOKEN":       {"desc": "Twitter / X access token", "section": "Social Publishing"},
    "TWITTER_ACCESS_TOKEN_SECRET": {"desc": "Twitter / X access token secret", "section": "Social Publishing"},
    # Social Publishing (others)
    "INSTAGRAM_ACCOUNT_ID":   {"desc": "Instagram account ID", "section": "Social Publishing"},
    "INSTAGRAM_ACCESS_TOKEN": {"desc": "Instagram Graph API access token", "section": "Social Publishing"},
    "YOUTUBE_CHANNEL_ID":     {"desc": "YouTube channel ID for uploads", "section": "Social Publishing"},
    "HOUSING_CMS_API_KEY":    {"desc": "Housing.com CMS API key", "section": "Social Publishing"},
    "HOUSING_CMS_BASE_URL":   {"desc": "Housing.com CMS base URL", "section": "Social Publishing"},
    # Notifications / Bot
    "SLACK_BOT_TOKEN":      {"desc": "Slack bot token (xoxb-...)", "section": "Notifications / Bot"},
    "SLACK_CHANNEL_ID":     {"desc": "Slack channel ID for notifications", "section": "Notifications / Bot"},
    "SLACK_APP_TOKEN":      {"desc": "Slack app-level token (xapp-...) for Socket Mode", "section": "Notifications / Bot"},
    "SLACK_SIGNING_SECRET": {"desc": "Slack signing secret for request verification", "section": "Notifications / Bot"},
    # Infrastructure
    "DATABASE_URL":        {"desc": "SQLAlchemy database URL", "section": "Infrastructure"},
    "DRY_RUN":             {"desc": "Skip live publishing — save output to local files instead", "section": "Pipeline Behaviour", "type": "boolean"},
    "HUMAN_IN_THE_LOOP":   {"desc": "Posts stay as drafts pending human approval before publishing", "section": "Pipeline Behaviour", "type": "boolean"},
    "LOG_LEVEL":           {"desc": "Logging level (DEBUG/INFO/WARNING)", "section": "Infrastructure"},
    "MAX_CREATIVE_DRAFTS": {"desc": "Max creative drafts to generate per run", "section": "Infrastructure"},
    "TARGET_PLATFORMS":    {"desc": "Comma-separated list of target platforms", "section": "Infrastructure"},
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
            "value": _mask_value(val) if (val and meta.get("type") != "boolean") else val,
            "is_set": bool(val),
            "desc": meta.get("desc", ""),
            "section": meta.get("section", "Other"),
            "type": meta.get("type", "string"),
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

    # Invalidate the cached settings singleton so the running app picks up the new value
    # without requiring a server restart.
    try:
        from config import get_settings
        get_settings.cache_clear()
    except Exception:
        pass

    return {"ok": True, "key": key}
