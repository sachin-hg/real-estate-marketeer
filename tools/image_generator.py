from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from config import get_settings

logger = logging.getLogger(__name__)

# Style suffixes keyed by media_format; platform overrides applied separately
_STYLE_BY_FORMAT: dict[str, str] = {
    "branded_card": (
        "Style: photorealistic, clean, modern, aspirational Indian real estate, "
        "warm golden-hour lighting, no text overlays, no watermarks, "
        "professional photography aesthetic."
    ),
    "meme_overlay": (
        "Style: flat design, bold graphic, high contrast, vibrant solid-color background, "
        "no photorealism, no people, minimal detail, leave 25% empty space at top and "
        "bottom for meme text overlays, inspired by Indian social media meme formats."
    ),
    "text_only": (
        "Style: minimal flat design, single dominant muted-color background, "
        "clean modern aesthetic, suitable for text-overlay social cards, no complex imagery."
    ),
}

_STYLE_BY_PLATFORM: dict[str, str] = {
    "youtube": (
        "Style: high-contrast YouTube thumbnail, dramatic cinematic composition, "
        "vivid saturated colors that pop at small sizes, strong focal point, "
        "no text, no watermarks, designed to be eye-catching at thumbnail size."
    ),
    "housing_news": (
        "Style: editorial photography, journalistic quality, neutral professional tones, "
        "clean composition suitable for a real estate news website, "
        "no text overlays, no watermarks, documentary-style real estate or urban photography."
    ),
}

# Default fallback
_DEFAULT_STYLE = _STYLE_BY_FORMAT["branded_card"]


def _pick_style(media_format: str = "", platform: str = "") -> str:
    """Return the appropriate style suffix for the given format/platform combination."""
    if platform and platform in _STYLE_BY_PLATFORM:
        return _STYLE_BY_PLATFORM[platform]
    return _STYLE_BY_FORMAT.get(media_format, _DEFAULT_STYLE)


async def generate_image(
    prompt: str,
    size: str = "1024x1024",
    quality: str = "hd",
    save_to: Optional[Path] = None,
    media_format: str = "branded_card",
    platform: str = "",
) -> Optional[str]:
    """
    Generate an image with DALL-E 3 using platform-appropriate styling.
    Returns the image URL (or local path if save_to is provided).
    Returns None if OPENAI_API_KEY is not configured or image generation is disabled.
    """
    settings = get_settings()
    if not settings.openai_api_key:
        logger.info("OPENAI_API_KEY not set — skipping image generation")
        return None
    if not getattr(settings, "enable_image_generation", True):
        logger.info("Image generation disabled — skipping")
        return None

    try:
        import openai
        client = openai.AsyncOpenAI(api_key=settings.openai_api_key)

        style = _pick_style(media_format, platform)
        enhanced = f"{prompt}. {style}"
        logger.debug("Image gen: format=%s platform=%s style=%.60s", media_format, platform, style)

        response = await client.images.generate(
            model="dall-e-3",
            prompt=enhanced[:4000],
            size=size,
            quality=quality,
            n=1,
        )
        url = response.data[0].url
        logger.debug("Image generated: %s", url[:60])

        if save_to and url:
            await _download_image(url, save_to)
            return str(save_to)

        return url

    except Exception as exc:
        logger.error("Image generation failed: %s", exc)
        return None


async def _download_image(url: str, path: Path) -> None:
    import httpx
    import aiofiles

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.get(url)
        response.raise_for_status()
        path.parent.mkdir(parents=True, exist_ok=True)
        async with aiofiles.open(path, "wb") as f:
            await f.write(response.content)
    logger.debug("Image saved to %s", path)
