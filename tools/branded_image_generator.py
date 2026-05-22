"""
PIL-based branded image card generator for Housing.com social posts.

Produces 1080x1080 PNG cards:
  - Background: rgb(94, 63, 224)  — Housing purple
  - Text: white, Rubik Bold, auto-sized to fit
  - Logo: housing.com logo, bottom-right corner

Assets are downloaded once on first call and cached in config.assets_dir.
"""
from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

CARD_SIZE = (1080, 1080)
BG_COLOR = (94, 63, 224)           # Housing purple
TEXT_COLOR = (255, 255, 255)        # white
LOGO_URL = "https://c.housingcdn.com/demand/s/client/common/assets/housing.60f7468d.jpg"
# Variable font — supports wght axis (100-900). We set wght=700 for Bold.
FONT_URL = "https://github.com/google/fonts/raw/main/ofl/rubik/Rubik%5Bwght%5D.ttf"
FONT_FILENAME = "Rubik-Variable.ttf"
PADDING = 80                        # px from each edge
LOGO_MAX_WIDTH = 140                # px
LOGO_MARGIN = 28                    # px from bottom-right corner
FONT_SIZE_START = 80
FONT_SIZE_MIN = 32


def _assets_dir() -> Path:
    try:
        from config import get_settings
        d = Path(get_settings().assets_dir)
    except Exception:
        d = Path("assets")
    d.mkdir(parents=True, exist_ok=True)
    return d


def _ensure_asset(filename: str, url: str) -> Path:
    """Download asset once and cache it. Returns local path."""
    import requests
    path = _assets_dir() / filename
    if path.exists():
        return path
    logger.info("Downloading asset: %s → %s", url, path)
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        path.write_bytes(resp.content)
        logger.info("Asset cached: %s (%d bytes)", path, len(resp.content))
    except Exception as exc:
        logger.warning("Failed to download asset %s: %s", filename, exc)
        raise
    return path


def _load_font(size: int):
    """Load Rubik Bold at given size, fallback to system font then default."""
    from PIL import ImageFont
    try:
        font_path = _ensure_asset(FONT_FILENAME, FONT_URL)
        font = ImageFont.truetype(str(font_path), size)
        # Set Bold weight on variable font (wght=700)
        try:
            font.set_variation_by_axes({"wght": 700})
        except Exception:
            pass  # Older Pillow or non-variable font — use as-is
        return font
    except Exception:
        # Fallback to common system fonts before giving up
        for fallback in ["/Library/Fonts/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc"]:
            try:
                return ImageFont.truetype(fallback, size)
            except Exception:
                continue
        return ImageFont.load_default()


def _fit_text(draw, text: str, max_width: int, max_height: int):
    """Find the largest font size where text fits in the bounding box."""
    from PIL import ImageFont
    size = FONT_SIZE_START
    while size >= FONT_SIZE_MIN:
        font = _load_font(size)
        # Use textbbox (Pillow ≥ 9.2) to measure wrapped text
        lines = _wrap_text(text, font, max_width, draw)
        line_height = size + int(size * 0.25)
        total_height = len(lines) * line_height
        if total_height <= max_height:
            return font, lines, line_height
        size -= 4
    # Last resort: use minimum size
    font = _load_font(FONT_SIZE_MIN)
    lines = _wrap_text(text, font, max_width, draw)
    line_height = FONT_SIZE_MIN + int(FONT_SIZE_MIN * 0.25)
    return font, lines, line_height


def _wrap_text(text: str, font, max_width: int, draw) -> list[str]:
    """Word-wrap text to fit max_width."""
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = (current + " " + word).strip()
        try:
            w = draw.textlength(candidate, font=font)
        except AttributeError:
            # older Pillow fallback
            w = font.getlength(candidate) if hasattr(font, "getlength") else len(candidate) * (font.size // 2)
        if w <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines if lines else [text]


def _strip_emoji(text: str) -> str:
    """Remove emoji characters that Rubik can't render (avoids □ boxes)."""
    import unicodedata
    result = []
    for ch in text:
        cat = unicodedata.category(ch)
        cp = ord(ch)
        # Keep basic latin, latin supplement, common punctuation, Devanagari
        if (cp < 0x2500) or (0x0900 <= cp <= 0x097F):
            result.append(ch)
        # Keep em-dash, en-dash, ellipsis
        elif ch in ("—", "–", "…", "₹", "•"):
            result.append(ch)
        # Drop everything else (emoji, pictographs, symbols)
    return "".join(result).strip()


def generate_branded_card(text: str, output_path: str | Path) -> Path:
    """
    Generate a 1080x1080 Housing.com branded image card synchronously.
    Returns the path to the saved PNG.
    """
    from PIL import Image, ImageDraw

    output_path = Path(output_path)
    text = _strip_emoji(text)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    img = Image.new("RGB", CARD_SIZE, color=BG_COLOR)
    draw = ImageDraw.Draw(img)

    text_area_width = CARD_SIZE[0] - 2 * PADDING
    # Reserve bottom 180px for logo area
    text_area_height = CARD_SIZE[1] - 2 * PADDING - 180

    font, lines, line_height = _fit_text(draw, text, text_area_width, text_area_height)

    total_text_height = len(lines) * line_height
    # Center text block vertically in the text area
    y_start = PADDING + (text_area_height - total_text_height) // 2

    for i, line in enumerate(lines):
        y = y_start + i * line_height
        try:
            w = draw.textlength(line, font=font)
        except AttributeError:
            w = font.getlength(line) if hasattr(font, "getlength") else len(line) * (font.size // 2)
        x = (CARD_SIZE[0] - w) // 2
        draw.text((x, y), line, font=font, fill=TEXT_COLOR)

    # Draw logo in bottom-right corner
    _draw_logo(img)

    img.save(str(output_path), "PNG")
    logger.info("Branded card saved: %s", output_path)
    return output_path


def _draw_logo(img):
    """Paste housing.com logo into bottom-right corner of img (in-place)."""
    try:
        from PIL import Image
        logo_path = _ensure_asset("housing_logo.jpg", LOGO_URL)
        logo = Image.open(logo_path).convert("RGBA")

        # Resize proportionally so width ≤ LOGO_MAX_WIDTH
        w, h = logo.size
        scale = LOGO_MAX_WIDTH / w
        new_w = int(w * scale)
        new_h = int(h * scale)
        logo = logo.resize((new_w, new_h), Image.LANCZOS)

        # Add a soft white background pill behind the logo for readability
        x = CARD_SIZE[0] - new_w - LOGO_MARGIN
        y = CARD_SIZE[1] - new_h - LOGO_MARGIN

        # Paste with alpha mask if available
        if logo.mode == "RGBA":
            img.paste(logo, (x, y), logo)
        else:
            img.paste(logo, (x, y))
    except Exception as exc:
        logger.warning("Logo overlay skipped: %s", exc)
        # Fall back to text watermark
        try:
            from PIL import ImageDraw, ImageFont
            draw = ImageDraw.Draw(img)
            wm_font = _load_font(28)
            draw.text(
                (CARD_SIZE[0] - LOGO_MARGIN - 160, CARD_SIZE[1] - LOGO_MARGIN - 36),
                "housing.com",
                font=wm_font,
                fill=(255, 255, 255, 180),
            )
        except Exception:
            pass


async def generate_branded_card_async(text: str, output_path: str | Path) -> Path:
    """Async wrapper — runs PIL work in a thread executor."""
    import contextvars
    loop = asyncio.get_event_loop()
    ctx = contextvars.copy_context()
    return await loop.run_in_executor(None, ctx.run, generate_branded_card, text, output_path)
