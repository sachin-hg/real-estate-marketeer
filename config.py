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

    # ── Optional: Serper (fast news search for social trend researcher) ──────
    serper_api_key: str = ""   # SERPER_API_KEY in .env; empty = fall back to Tavily

    # ── Optional: SerpAPI (Google News + Google Trends) ──────────────────────
    # serpapi.com — separate from serper.dev above.
    # Enables: targeted India RE news + reliable Google Trends India (last 24h).
    serp_api_key: Optional[str] = None   # SERP_API_KEY in .env

    # ── Optional: RapidAPI (Twitter/X trends fallback) ───────────────────────
    rapidapi_key: Optional[str] = None   # RAPIDAPI_KEY in .env

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
    checkpoint_db_path: str = "checkpoints.db"    # LangGraph run checkpoints (separate from app DB)
    assets_dir: str = "assets"   # fonts + logo for branded image cards

    # ── Asset / media storage backend ─────────────────────────────────────────
    # "local"  — serve from output/ via FastAPI static mount (default, no extra config)
    # "s3"     — upload to AWS S3; set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
    #             AWS_S3_BUCKET, optional AWS_S3_REGION (default us-east-1)
    # "gcs"    — upload to Google Cloud Storage; set GCS_BUCKET + ADC / service account
    asset_storage_backend: str = "local"
    aws_s3_bucket: Optional[str] = None
    aws_s3_region: str = "us-east-1"
    aws_s3_prefix: str = "housing-marketeer"
    gcs_bucket: Optional[str] = None
    gcs_prefix: str = "housing-marketeer"

    # ── Product identity ──────────────────────────────────────────────────────
    app_name: str = "NAVA"   # Product name; set APP_NAME env var to override

    # ── Pipeline behaviour ────────────────────────────────────────────────────
    dry_run: bool = True
    human_in_the_loop: bool = False  # When True: posts saved as drafts, require human approval before publishing
    max_creative_drafts: int = 3
    target_platforms: str = "twitter,instagram,youtube,housing_news,linkedin"
    max_qa_retries: int = 2
    enable_checkpointing: bool = True    # LangGraph SQLite checkpointing for run resumability
    enable_planner: bool = True          # planner quality-gate node between research and creative
    enable_image_generation: bool = True  # set False to skip DALL-E calls (saves cost in dev)
    tavily_search_depth: str = "basic"   # "basic" (cheap) | "advanced" (thorough but 5× cost)
    # Resilience
    platform_agent_timeout: int = 180   # seconds: asyncio.gather timeout for all platform agents
    llm_timeout: float = 60.0           # seconds per individual LLM call before timeout
    llm_retries: int = 2                # retries on rate-limit / 5xx (backoff: 1s → 2s)
    log_level: str = "INFO"
    # Set False to skip writing markdown files and run.log to output/ — all data
    # still persists to DB. Recommended when asset_storage_backend != "local".
    enable_file_outputs: bool = True

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
