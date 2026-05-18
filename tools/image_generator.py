from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from config import get_settings

logger = logging.getLogger(__name__)

HOUSING_STYLE_SUFFIX = (
    "Style: photorealistic, clean, modern, aspirational Indian real estate, "
    "warm golden-hour lighting, no text overlays, no watermarks, "
    "professional photography aesthetic."
)


async def generate_image(
    prompt: str,
    size: str = "1024x1024",
    quality: str = "hd",
    save_to: Optional[Path] = None,
) -> Optional[str]:
    """
    Generate an image with DALL-E 3.
    Returns the image URL (or local path if save_to is provided).
    Returns None if OPENAI_API_KEY is not configured.
    """
    settings = get_settings()
    if not settings.openai_api_key:
        logger.info("OPENAI_API_KEY not set — skipping image generation")
        return None

    try:
        import openai
        client = openai.AsyncOpenAI(api_key=settings.openai_api_key)

        enhanced = f"{prompt}. {HOUSING_STYLE_SUFFIX}"
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
