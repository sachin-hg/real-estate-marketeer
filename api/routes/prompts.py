from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/prompts", tags=["prompts"])

HOOKS_PATH = Path(__file__).parent.parent.parent / "prompts" / "hooks_bank.json"


def _read_bank() -> dict:
    """Read hooks_bank.json; always returns dict with 'examples' and 'negative_examples' keys."""
    if not HOOKS_PATH.exists():
        return {"examples": [], "negative_examples": []}
    try:
        raw = json.loads(HOOKS_PATH.read_text(encoding="utf-8"))
        if isinstance(raw, list):
            return {"examples": raw, "negative_examples": []}
        return raw
    except Exception as exc:
        logger.error("Failed to read hooks_bank.json: %s", exc)
        return {"examples": [], "negative_examples": []}


def _read_hooks() -> list:
    return _read_bank().get("examples", [])


def _write_hooks(examples: list) -> None:
    """Write examples list while preserving negative_examples in the file."""
    bank = _read_bank()
    bank["examples"] = examples
    HOOKS_PATH.write_text(json.dumps(bank, indent=2, ensure_ascii=False), encoding="utf-8")
    # Invalidate the example retriever LRU cache so new prompts take effect immediately
    try:
        from tools.example_retriever import _load_bank
        _load_bank.cache_clear()
    except Exception:
        pass


@router.get("/")
def list_prompts():
    return _read_hooks()


class PromptBody(BaseModel):
    id: str
    event: str
    tags: list[str]
    card: str
    caption: Optional[str] = None
    hashtags: Optional[list[str]] = None
    city_hint: Optional[str] = None
    media_format: Optional[str] = None
    meme_concept: Optional[str] = None


@router.post("/")
def create_prompt(body: PromptBody):
    hooks = _read_hooks()
    if any(h.get("id") == body.id for h in hooks):
        raise HTTPException(status_code=400, detail=f"Hook with id '{body.id}' already exists")
    new_hook = body.model_dump(exclude_none=True)
    hooks.append(new_hook)
    _write_hooks(hooks)
    return new_hook


class PromptUpdateBody(BaseModel):
    event: Optional[str] = None
    tags: Optional[list[str]] = None
    card: Optional[str] = None
    caption: Optional[str] = None
    hashtags: Optional[list[str]] = None
    city_hint: Optional[str] = None
    media_format: Optional[str] = None
    meme_concept: Optional[str] = None


@router.put("/{hook_id}")
def update_prompt(hook_id: str, body: PromptUpdateBody):
    hooks = _read_hooks()
    idx = next((i for i, h in enumerate(hooks) if h.get("id") == hook_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"Hook '{hook_id}' not found")

    update_data = body.model_dump(exclude_none=True)
    hooks[idx].update(update_data)
    _write_hooks(hooks)
    return hooks[idx]


@router.delete("/{hook_id}")
def delete_prompt(hook_id: str):
    hooks = _read_hooks()
    idx = next((i for i, h in enumerate(hooks) if h.get("id") == hook_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"Hook '{hook_id}' not found")

    removed = hooks.pop(idx)
    _write_hooks(hooks)
    return {"deleted": True, "id": hook_id, "hook": removed}
