from __future__ import annotations

from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Required ──────────────────────────────────────────────────────────────
    anthropic_api_key: str = Field(..., description="Claude API key")
    tavily_api_key: str = Field(..., description="Tavily search API key")

    # ── Optional: image generation ────────────────────────────────────────────
    openai_api_key: Optional[str] = None

    # ── Optional: Google Gemini (cheaper fast-tier model) ────────────────────
    # If set, fast-tier tasks (signal extraction, QA safety) use Gemini 2.5 Flash
    # instead of Claude Haiku — 53% cost savings on structured/JSON tasks.
    gemini_api_key: Optional[str] = None

    # ── Optional: notifications + Slack bot ──────────────────────────────────
    slack_bot_token: Optional[str] = None
    slack_channel_id: Optional[str] = None
    # App-level token (xapp-...) — only needed to run the Slack bot in Socket Mode
    # Requires scope: connections:write
    # Create at: https://api.slack.com/apps → your app → Basic Information → App-Level Tokens
    slack_app_token: Optional[str] = None
    # Signing secret — used to verify incoming HTTP webhook events
    slack_signing_secret: Optional[str] = None

    # ── Optional: trend research ──────────────────────────────────────────────
    reddit_client_id: Optional[str] = None
    reddit_client_secret: Optional[str] = None
    reddit_user_agent: str = "housing-marketeer/1.0 (by /u/housingdotcom)"

    # ── Optional: social publishing ───────────────────────────────────────────
    apify_api_token: Optional[str] = None

    twitter_api_key: Optional[str] = None
    twitter_api_secret: Optional[str] = None
    twitter_access_token: Optional[str] = None
    twitter_access_token_secret: Optional[str] = None
    twitter_bearer_token: Optional[str] = None

    instagram_access_token: Optional[str] = None
    instagram_account_id: Optional[str] = None

    youtube_api_key: Optional[str] = None
    youtube_channel_id: Optional[str] = None

    housing_cms_api_key: Optional[str] = None
    housing_cms_base_url: str = "https://cms.housing.com/api/v1"

    # ── Infrastructure ────────────────────────────────────────────────────────
    database_url: str = "sqlite+aiosqlite:///./housing_content.db"
    assets_dir: str = "assets"   # fonts + logo for branded image cards

    # ── Pipeline behaviour ────────────────────────────────────────────────────
    dry_run: bool = True
    max_creative_drafts: int = 3
    target_platforms: str = "twitter,instagram,youtube,housing_news"
    max_qa_retries: int = 1
    # Resilience
    platform_agent_timeout: int = 90    # seconds: asyncio.gather timeout for all platform agents
    llm_timeout: float = 60.0           # seconds per individual LLM call before timeout
    llm_retries: int = 2                # retries on rate-limit / 5xx (backoff: 1s → 2s)
    log_level: str = "INFO"

    # ── Claude model routing ──────────────────────────────────────────────────
    model_fast: str = "claude-haiku-4-5-20251001"    # safety checks, extraction
    model_balanced: str = "claude-sonnet-4-6"         # research, QA quality, platforms
    model_creative: str = "claude-opus-4-7"           # creative, engagement prediction

    @property
    def platform_list(self) -> list[str]:
        return [p.strip() for p in self.target_platforms.split(",") if p.strip()]

    @property
    def has_images(self) -> bool:
        return bool(self.openai_api_key)

    @property
    def has_slack(self) -> bool:
        return bool(self.slack_bot_token and self.slack_channel_id)

    @property
    def has_twitter(self) -> bool:
        return all([
            self.twitter_api_key,
            self.twitter_api_secret,
            self.twitter_access_token,
            self.twitter_access_token_secret,
        ])

    @property
    def has_instagram(self) -> bool:
        return bool(self.instagram_access_token and self.instagram_account_id)

    @property
    def has_youtube(self) -> bool:
        return bool(self.youtube_api_key and self.youtube_channel_id)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
